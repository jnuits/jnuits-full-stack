import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { directProfileSchema } from "@/lib/members/profile-update-policy";
import { isStepUpActiveForUser } from "@/lib/auth/step-up";
import { revalidatePublicCommitteeProjection } from "@/lib/committee/revalidation";
import { createAdminClient } from "@/lib/supabase/admin";
import { asFlexibleClient } from "@/lib/supabase/flexible";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import { withApiGuard } from "@/lib/security/with-api-guard";
import { apiError } from "@/lib/errors/api-error";
import { reconcileMembershipLifecycle } from "@/lib/membership/reconciliation";
import { resolveMembershipAccessMode } from "@/lib/membership/lifecycle";

async function handleDirectEdit(
  request: NextRequest,
  context: { userId?: string }
): Promise<NextResponse> {
  // userId is guaranteed by requireAuth: true in withApiGuard
  const userId = context.userId!;

  const cookieStore = await cookies();

  if (!isStepUpActiveForUser(cookieStore, userId)) {
    return NextResponse.json(
      {
        message:
          "Direct profile edits require step-up verification with your current password.",
      },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = directProfileSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        message:
          parsed.error.flatten().formErrors[0] ||
          "Provide at least one valid direct profile field.",
      },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const readMember = () => asFlexibleClient(admin)
    .from("members" as string)
    .select("id, full_name, jnuits_id, department_code, facebook_url, linkedin_url, phone, website_url, lifecycle_status, portal_access_status, current_membership_path_status")
    .eq("user_id", userId)
    .maybeSingle();
  let { data: member, error: memberError } = await readMember();
  if (!memberError && member?.portal_access_status === "active"
    && (member.lifecycle_status === "current" || member.lifecycle_status === "former")) {
    try {
      await reconcileMembershipLifecycle({ memberId: member.id });
      ({ data: member, error: memberError } = await readMember());
    } catch {
      return NextResponse.json({ message: "Membership status could not be verified. Please try again later." }, { status: 503 });
    }
  }

  if (memberError || !member) {
    return NextResponse.json(
      { message: "No linked member profile exists for this account." },
      { status: 404 }
    );
  }

  if (resolveMembershipAccessMode({
    lifecycleStatus: member.lifecycle_status ?? null,
    portalAccessStatus: member.portal_access_status ?? null,
    currentMembershipPathStatus: member.current_membership_path_status ?? null,
  }) !== "mutable") {
    return NextResponse.json(
      { message: "This profile is frozen or restricted pending admin review." },
      { status: 423 }
    );
  }

  const result = await asFlexibleClient(admin).rpc("apply_member_self_profile_update", {
    p_user_id: userId,
    p_patch: parsed.data,
  });
  if (result.error) {
    return apiError(result.error, {
      context: "profile/direct atomic save",
      status: result.error.code === "42501" ? 423 : result.error.code === "22023" ? 400 : 500,
      fallback: "Your profile could not be updated right now. Unlock editing and try again.",
    });
  }
  if (!result.data || result.data.id !== member.id) {
    return NextResponse.json({ message: "Your profile could not be updated right now." }, { status: 503 });
  }
  revalidatePath("/admin/workplace");
  revalidatePath("/members");
  revalidatePath("/profile");
  revalidatePath("/profile/edit");
  revalidatePublicCommitteeProjection();
  revalidatePath("/portal/profile");
  revalidatePath("/portal/profile/edit");

  return NextResponse.json(
    {
      data: {
        id: member.id,
      },
      message:
        "Profile changes saved. No admin approval is needed for these details.",
    },
    { status: 200 }
  );
}

export const POST = withApiGuard(handleDirectEdit, {
  rateLimit: RATE_LIMITS.profileDirect,
  requireAuth: true,
});
