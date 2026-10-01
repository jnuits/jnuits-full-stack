import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { cancelWorkplaceRequest } from "@/lib/admin/workplace";
import { isMutablePortalAccess } from "@/lib/auth/session";
import type { MemberLifecycleStatus, PortalAccessStatus } from "@/lib/auth/session";
import { buildWorkplaceRequestReceivedEmail } from "@/lib/notifications/email-builders";
import { sendEmail } from "@/lib/notifications/send-email";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import { withApiGuard } from "@/lib/security/with-api-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { asFlexibleClient } from "@/lib/supabase/flexible";
import { apiError } from "@/lib/errors/api-error";
import { reconcileMembershipLifecycle } from "@/lib/membership/reconciliation";

const workplacePayloadSchema = z
  .object({
    currentOrganization: z.string().trim().max(180).optional(),
    designation: z.string().trim().max(160).optional(),
    facebookUrl: z.string().trim().url().optional().or(z.literal("")),
    linkedinUrl: z.string().trim().url().optional().or(z.literal("")),
    professionalVisibility: z
      .enum(["public", "members-only", "private"])
      .optional()
      .default("members-only"),
    websiteUrl: z.string().trim().url().optional().or(z.literal("")),
    workLocation: z.string().trim().max(160).optional(),
  })
  .refine(
    (value) =>
      Boolean(
        value.currentOrganization ||
          value.designation ||
          value.workLocation ||
          value.facebookUrl ||
          value.linkedinUrl ||
          value.websiteUrl ||
          value.professionalVisibility
      ),
    { message: "Provide at least one workplace field to review." }
  );

const cancelSchema = z.object({
  action: z.literal("cancel"),
  requestId: z.string().trim().min(1),
});

type LinkedMember = {
  email?: null | string;
  full_name?: null | string;
  id: string;
  jnuits_id?: null | string;
  lifecycle_status?: null | string;
  member_type?: null | string;
  portal_access_status?: null | string;
  current_membership_path_status?: null | string;
};

function asLifecycle(value: unknown): MemberLifecycleStatus | null {
  return value === "current" ||
    value === "alumni" ||
    value === "former" ||
    value === "deleted"
    ? value
    : null;
}

function asPortalAccess(value: unknown): PortalAccessStatus | null {
  return value === "active" ||
    value === "frozen" ||
    value === "suspended" ||
    value === "deletion_requested" ||
    value === "deactivated"
    ? value
    : null;
}

async function loadLinkedMember(userId: string) {
  const admin = createAdminClient();
  const readMember = () => asFlexibleClient(admin)
    .from("members" as string)
    .select("id, email, jnuits_id, full_name, member_type, lifecycle_status, portal_access_status, current_membership_path_status")
    .eq("user_id", userId)
    .maybeSingle();
  let { data, error } = await readMember();
  if (!error && data?.portal_access_status === "active"
    && (data.lifecycle_status === "current" || data.lifecycle_status === "former")) {
    try {
      await reconcileMembershipLifecycle({ memberId: data.id });
      ({ data, error } = await readMember());
    } catch {
      return { admin, member: null, error: NextResponse.json({ message: "Membership status could not be verified. Please try again later." }, { status: 503 }) };
    }
  }

  if (error || !data) {
    return {
      admin,
      error: NextResponse.json(
        { message: "No linked member profile exists for this account." },
        { status: 404 }
      ),
      member: null,
    };
  }

  const member = data as LinkedMember;
  const access = {
    lifecycleStatus: asLifecycle(member.lifecycle_status),
    memberId: member.id,
    portalAccessStatus: asPortalAccess(member.portal_access_status),
    currentMembershipPathStatus: member.current_membership_path_status ?? null,
  };

  if (!isMutablePortalAccess(access)) {
    return {
      admin,
      error: NextResponse.json(
        { message: "This profile is frozen or restricted pending admin review." },
        { status: 423 }
      ),
      member: null,
    };
  }

  return { admin, error: null, member };
}

async function handleGet(_request: NextRequest, context: { userId?: string }) {
  const userId = context.userId;

  if (!userId) {
    return NextResponse.json({ message: "Authentication required." }, { status: 401 });
  }

  const viewer = await loadLinkedMember(userId);

  if (viewer.error) {
    return viewer.error;
  }

  const { data, error } = await asFlexibleClient(viewer.admin)
    .from("profile_update_requests" as string)
    .select("id, member_id, request_type, payload, status, requested_at, reviewed_at, review_note, reviewed_by_user_id")
    .eq("member_id", viewer.member!.id)
    .eq("request_type", "workplace_update")
    .order("requested_at", { ascending: false })
    .limit(20);

  if (error) {
    return NextResponse.json(
      { message: "Unable to retrieve workplace requests." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    data: data || [],
    meta: { member: viewer.member },
  });
}

async function handlePost(request: NextRequest, context: { userId?: string }) {
  const userId = context.userId;

  if (!userId) {
    return NextResponse.json({ message: "Authentication required." }, { status: 401 });
  }

  const viewer = await loadLinkedMember(userId);

  if (viewer.error) {
    return viewer.error;
  }

  const body = await request.json().catch(() => null);
  const parsed = workplacePayloadSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        message:
          parsed.error.flatten().formErrors[0] ||
          "Provide at least one valid workplace field.",
      },
      { status: 400 }
    );
  }

  const flexibleAdmin = asFlexibleClient(viewer.admin);
  const { data: pendingRequest } = await flexibleAdmin
    .from("profile_update_requests" as string)
    .select("id")
    .eq("member_id", viewer.member!.id)
    .eq("request_type", "workplace_update")
    .eq("status", "pending")
    .maybeSingle();

  if (pendingRequest?.id) {
    return NextResponse.json(
      {
        message:
          "You already have a pending workplace request. Cancel it before submitting a revised request.",
      },
      { status: 409 }
    );
  }

  const { data, error } = await flexibleAdmin
    .from("profile_update_requests" as string)
    .insert({
      member_id: viewer.member!.id,
      metadata: {
        lifecycleStatus: viewer.member!.lifecycle_status || null,
        portalAccessStatus: viewer.member!.portal_access_status || null,
      },
      payload: parsed.data,
      request_source: "portal",
      request_type: "workplace_update",
      status: "pending",
      submitted_by_user_id: userId,
    })
    .select("id, member_id, request_type, payload, status, requested_at, reviewed_at, review_note, reviewed_by_user_id")
    .single();

  if (error || !data) {
    return apiError(error ?? new Error("workplace request insert returned no data"), {
      context: "workplace-requests submit",
      fallback: "Unable to submit workplace request.",
    });
  }

  await flexibleAdmin.from("audit_events" as string).insert({
    action: "member.requested_workplace_update",
    actor_user_id: userId,
    entity_id: data.id,
    entity_type: "profile_update_request",
    metadata: {
      memberId: viewer.member!.id,
    },
  });

  if (viewer.member?.email) {
    void sendEmail({
      html: buildWorkplaceRequestReceivedEmail({
        memberName: viewer.member.full_name || "JnUITS member",
      }),
      subject: "Your JnUITS workplace request was received",
      to: viewer.member.email,
    }).catch(() => undefined);
  }

  return NextResponse.json(
    {
      data,
      message: "Workplace update request submitted for admin review.",
    },
    { status: 201 }
  );
}

async function handlePatch(request: NextRequest, context: { userId?: string }) {
  const userId = context.userId;

  if (!userId) {
    return NextResponse.json({ message: "Authentication required." }, { status: 401 });
  }

  const viewer = await loadLinkedMember(userId);
  if (viewer.error) return viewer.error;

  const body = await request.json().catch(() => null);
  const parsed = cancelSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { message: "Provide a pending workplace request to cancel." },
      { status: 400 }
    );
  }

  try {
    await cancelWorkplaceRequest({
      admin: createAdminClient(),
      requestId: parsed.data.requestId,
      userId,
    });

    return NextResponse.json({ message: "Workplace request cancelled." });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "Unable to cancel workplace request.",
      },
      { status: 400 }
    );
  }
}

export const GET = withApiGuard(handleGet, {
  requireAuth: true,
});

export const POST = withApiGuard(handlePost, {
  rateLimit: RATE_LIMITS.profileDirect,
  requireAuth: true,
});

export const PATCH = withApiGuard(handlePatch, {
  rateLimit: RATE_LIMITS.profileDirect,
  requireAuth: true,
});
