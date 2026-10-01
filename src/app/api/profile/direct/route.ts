import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";
import { isStepUpActiveForUser } from "@/lib/auth/step-up";
import { revalidatePublicCommitteeProjection } from "@/lib/committee/revalidation";
import { isActiveDepartmentCode } from "@/lib/departments.server";
import { createAdminClient } from "@/lib/supabase/admin";
import { asFlexibleClient } from "@/lib/supabase/flexible";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import { withApiGuard } from "@/lib/security/with-api-guard";
import { apiError } from "@/lib/errors/api-error";
import { reconcileMembershipLifecycle } from "@/lib/membership/reconciliation";
import { resolveMembershipAccessMode } from "@/lib/membership/lifecycle";

const directProfileSchema = z
  .object({
    departmentCode: z.string().trim().max(80).optional(),
    facebookUrl: z.union([z.string().trim().url(), z.literal("")]).optional(),
    fullName: z.string().trim().max(160).optional(),
    phone: z.string().trim().max(40).optional(),
    linkedinUrl: z.union([z.string().trim().url(), z.literal("")]).optional(),
    websiteUrl: z.union([z.string().trim().url(), z.literal("")]).optional(),
  })
  .refine((value) => Object.values(value).some((entry) => typeof entry === "string"), {
    message: "Provide at least one profile field to update.",
  });

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

  const departmentCode =
    parsed.data.departmentCode === undefined
      ? undefined
      : parsed.data.departmentCode.trim().toLowerCase();

  if (departmentCode && !(await isActiveDepartmentCode(departmentCode))) {
    return NextResponse.json(
      { message: "Choose a valid active department." },
      { status: 400 }
    );
  }

  const nextValues = {
    department_code:
      departmentCode === undefined
        ? member.department_code
        : departmentCode || null,
    facebook_url:
      parsed.data.facebookUrl === undefined
        ? member.facebook_url
        : parsed.data.facebookUrl || null,
    full_name:
      typeof parsed.data.fullName === "string" && parsed.data.fullName.trim()
        ? parsed.data.fullName.trim()
        : member.full_name,
    linkedin_url:
      parsed.data.linkedinUrl === undefined
        ? member.linkedin_url
        : parsed.data.linkedinUrl || null,
    phone:
      parsed.data.phone === undefined
        ? member.phone
        : parsed.data.phone.trim() || null,
    website_url:
      parsed.data.websiteUrl === undefined
        ? member.website_url
        : parsed.data.websiteUrl || null,
  };

  const changedFields = [
    nextValues.full_name !== member.full_name ? "full_name" : null,
    nextValues.department_code !== member.department_code ? "department_code" : null,
    nextValues.facebook_url !== member.facebook_url ? "facebook_url" : null,
    nextValues.phone !== member.phone ? "phone" : null,
    nextValues.linkedin_url !== member.linkedin_url ? "linkedin_url" : null,
    nextValues.website_url !== member.website_url ? "website_url" : null,
  ].filter((value): value is string => Boolean(value));

  if (changedFields.length === 0) {
    return NextResponse.json(
      { message: "No profile fields changed." },
      { status: 200 }
    );
  }

  const nowIso = new Date().toISOString();
  const { error: updateError } = await admin
    .from("members")
    .update({
      ...nextValues,
      updated_at: nowIso,
    })
    .eq("id", member.id);

  if (updateError) {
    return apiError(updateError, {
      context: "profile/direct member update",
      fallback: "Your profile could not be updated right now. Please try again.",
    });
  }

  await admin.from("membership_lifecycle_events").insert({
    member_id: member.id,
    event_type: "profile_direct_edit",
    summary: "A step-up verified direct profile edit was completed.",
    created_by_user_id: userId,
    metadata: {
      changedFields,
    },
  });

  await admin.from("audit_events").insert({
    action: "member.profile_direct_edit",
    actor_user_id: userId,
    entity_id: member.id,
    entity_type: "member",
    metadata: {
      changedFields,
      jnuitsId: member.jnuits_id,
    },
  });

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
        "Direct profile changes saved. Sensitive edits remain step-up protected.",
    },
    { status: 200 }
  );
}

export const POST = withApiGuard(handleDirectEdit, {
  rateLimit: RATE_LIMITS.profileDirect,
  requireAuth: true,
});
