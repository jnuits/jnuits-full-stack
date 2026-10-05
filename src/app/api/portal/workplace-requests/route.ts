import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { cookies } from "next/headers";
import { isStepUpActiveForUser } from "@/lib/auth/step-up";

import { cancelWorkplaceRequest } from "@/lib/admin/workplace";
import { isMutablePortalAccess } from "@/lib/auth/session";
import type { MemberLifecycleStatus, PortalAccessStatus } from "@/lib/auth/session";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import { withApiGuard } from "@/lib/security/with-api-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { asFlexibleClient } from "@/lib/supabase/flexible";
import { reconcileMembershipLifecycle } from "@/lib/membership/reconciliation";

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

async function handlePost() {
  return NextResponse.json({ message: "Workplace changes now save directly after password verification. Refresh the profile editor.", editPath: "/portal/profile/edit" }, { status: 410, headers: { "Cache-Control": "private, no-store" } });
}

async function handlePatch(request: NextRequest, context: { userId?: string }) {
  const userId = context.userId;

  if (!userId) {
    return NextResponse.json({ message: "Authentication required." }, { status: 401 });
  }

  const viewer = await loadLinkedMember(userId);
  if (viewer.error) return viewer.error;

  if (!isStepUpActiveForUser(await cookies(), userId)) return NextResponse.json({ message: "Verify your current password before cancelling a request." }, { status: 403 });

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
