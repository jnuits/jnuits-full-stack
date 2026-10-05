import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { cookies } from "next/headers";
import { isStepUpActiveForUser } from "@/lib/auth/step-up";
import { identityProfileSchema } from "@/lib/members/profile-update-policy";

import { isActiveDepartmentCode } from "@/lib/departments.server";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import { withApiGuard } from "@/lib/security/with-api-guard";
import { normalizeJnuitsIdForCreation } from "@/lib/members/jnuits-id";
import { createAdminClient } from "@/lib/supabase/admin";
import { asFlexibleClient } from "@/lib/supabase/flexible";
import { createClient } from "@/lib/supabase/server";
import { reconcileMembershipLifecycle } from "@/lib/membership/reconciliation";
import { resolveMembershipAccessMode } from "@/lib/membership/lifecycle";

const profileChangePayloadSchema = identityProfileSchema;

const emailChangePayloadSchema = z.object({
  newEmail: z.string().trim().email().max(254),
  requestType: z.literal("email_change"),
}).strict();

const jnuitsIdChangePayloadSchema = z
  .object({
    newJnuitsId: z.string().trim().max(80),
    requestType: z.literal("jnuits_id_change"),
  }).strict()
  .transform((value, context) => {
    const normalized = normalizeJnuitsIdForCreation(value.newJnuitsId);

    if (!normalized) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "JnUITS ID must use the JnUITS-YYYYSSS format.",
      });
    }

    return {
      newJnuitsId: normalized,
      requestType: value.requestType,
    };
  });

const changeRequestSchema = z.union([
  profileChangePayloadSchema,
  emailChangePayloadSchema,
  jnuitsIdChangePayloadSchema,
]);

async function requireLinkedMemberUser() {
  const supabase = await createClient();
  const { data, error: authError } = await supabase.auth.getUser();
  const userId = authError ? null : data.user?.id;

  if (!userId) {
    return {
      admin: null,
      error: NextResponse.json(
        { message: "Sign in with your claimed member account." },
        { status: 401 }
      ),
      member: null,
      userId: null,
    };
  }

  const admin = createAdminClient();
  const readMember = () => asFlexibleClient(admin)
    .from("members" as string)
    .select("id, email, jnuits_id, full_name, member_type, lifecycle_status, portal_access_status, current_membership_path_status")
    .eq("user_id", userId)
    .maybeSingle();
  let { data: member, error } = await readMember();
  if (!error && member?.portal_access_status === "active"
    && (member.lifecycle_status === "current" || member.lifecycle_status === "former")) {
    try {
      await reconcileMembershipLifecycle({ memberId: member.id });
      ({ data: member, error } = await readMember());
    } catch {
      return { admin: null, member: null, userId: null,
        error: NextResponse.json({ message: "Membership status could not be verified. Please try again later." }, { status: 503 }) };
    }
  }

  if (error || !member) {
    return {
      admin: null,
      error: NextResponse.json(
        { message: "No linked member profile exists for this account." },
        { status: 404 }
      ),
      member: null,
      userId: null,
    };
  }

  if (resolveMembershipAccessMode({
    lifecycleStatus: member.lifecycle_status ?? null,
    portalAccessStatus: member.portal_access_status ?? null,
    currentMembershipPathStatus: member.current_membership_path_status ?? null,
  }) !== "mutable") {
    return {
      admin: null,
      error: NextResponse.json(
        { message: "This profile is frozen or restricted pending admin review." },
        { status: 423 }
      ),
      member: null,
      userId: null,
    };
  }

  return {
    admin,
    error: null,
    member,
    userId,
  };
}

export async function GET() {
  const viewer = await requireLinkedMemberUser();

  if (viewer.error) {
    return viewer.error;
  }

  if (!viewer.member || !viewer.admin) {
    return NextResponse.json(
      { message: "No linked member profile exists for this account." },
      { status: 404 }
    );
  }

  const { data, error } = await viewer.admin
    .from("profile_update_requests")
    .select("id, request_type, payload, status, requested_at, reviewed_at, review_note, reviewed_by_user_id")
    .eq("member_id", viewer.member.id)
    .in("request_type", ["profile_change", "email_change", "jnuits_id_change"])
    .order("requested_at", { ascending: false })
    .limit(20);

  if (error) {
    return NextResponse.json(
      { message: "Unable to retrieve profile change requests." },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      data: data || [],
      meta: {
        member: viewer.member,
      },
    },
    { status: 200 }
  );
}

async function handlePost(request: NextRequest) {
  const viewer = await requireLinkedMemberUser();

  if (viewer.error) {
    return viewer.error;
  }

  if (!viewer.member || !viewer.admin) {
    return NextResponse.json(
      { message: "No linked member profile exists for this account." },
      { status: 404 }
    );
  }

  if (!isStepUpActiveForUser(await cookies(), viewer.userId!)) {
    return NextResponse.json({ message: "Verify your current password before requesting identity changes." }, { status: 403 });
  }

  const payload = await request.json().catch(() => null);
  const parsed = changeRequestSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      {
        message:
          parsed.error.flatten().formErrors[0] ||
          "Provide at least one valid profile field.",
      },
      { status: 400 }
    );
  }

  if ("departmentCode" in parsed.data) {
    const departmentCode = parsed.data.departmentCode?.trim().toLowerCase() || "";

    if (departmentCode && !(await isActiveDepartmentCode(departmentCode))) {
      return NextResponse.json(
        { message: "Choose a valid active department." },
        { status: 400 }
      );
    }

    parsed.data.departmentCode = departmentCode;
  }

  const requestType = parsed.data.requestType || "profile_change";
  const { data: pendingRequest } = await asFlexibleClient(viewer.admin)
    .from("profile_update_requests" as string)
    .select("id")
    .eq("member_id", viewer.member.id)
    .eq("request_type", requestType)
    .eq("status", "pending")
    .limit(1)
    .maybeSingle();

  if (pendingRequest?.id) {
    return NextResponse.json(
      {
        message:
          "You already have a pending request of this type. Wait for moderation before submitting a revised request.",
      },
      { status: 409 }
    );
  }

  const { data, error } = await viewer.admin
    .from("profile_update_requests")
    .insert({
      member_id: viewer.member.id,
      payload: parsed.data,
      request_type: requestType,
      status: "pending",
    })
    .select("id, request_type, payload, status, requested_at")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        {
          message:
            "You already have a pending request of this type. Wait for moderation before submitting a revised request.",
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { message: "Unable to submit profile change request." },
      { status: 500 }
    );
  }

  await viewer.admin.from("audit_events").insert({
    action: "member.requested_profile_change",
    actor_user_id: viewer.userId,
    entity_type: "profile_update_request",
    entity_id: data.id,
    metadata: {
        memberId: viewer.member.id,
        requestType,
      },
  });

  return NextResponse.json(
    {
      data,
      message: "Profile change request submitted for moderation.",
    },
    { status: 201 }
  );
}

export const POST = withApiGuard(handlePost, {
  rateLimit: RATE_LIMITS.profileDirect,
});
