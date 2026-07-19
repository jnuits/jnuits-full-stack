"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireAdminPermission } from "@/lib/auth/session";
import { setAdminFlash } from "@/lib/admin/flash";
import { getSafeAdminActionErrorMessage } from "@/lib/admin/action-error";
import {
  issueInvitationForMember,
  type AdminClient,
  type InvitationMember,
} from "@/lib/admin/invitations";
import {
  normalizeAlumniIdentity,
  resolveAlumniMemberMatch,
} from "@/lib/forms/alumni-identity";
import {
  DEFAULT_INVITATION_EXPIRY_DAYS,
} from "@/lib/members/invitation-code";
import { normalizeJnuitsIdForCreation } from "@/lib/members/jnuits-id";
import { buildAlumniConversionDecisionEmail } from "@/lib/notifications/email-builders";
import { sendEmail } from "@/lib/notifications/send-email";
import { createAdminClient } from "@/lib/supabase/admin";
import { asFlexibleClient } from "@/lib/supabase/flexible";

type AlumniCase = {
  email: null | string;
  form_submission_id: string;
  full_name: null | string;
  id: string;
  jnuits_id: null | string;
  status: "approved" | "pending" | "rejected";
};

type AlumniMember = InvitationMember & {
  user_id: null | string;
};

const reviewSchema = z.object({
  caseId: z.string().uuid("The alumni case identifier is missing."),
  reviewNote: z.string().trim().max(1_500).optional().default(""),
});

function getFormValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function redirectToQueue(): never {
  redirect("/admin/applications#alumni-onboarding");
}

async function loadPendingCase(admin: AdminClient, caseId: string) {
  const { data, error } = await asFlexibleClient(admin)
    .from("alumni_onboarding_cases" as string)
    .select("id, form_submission_id, full_name, email, jnuits_id, status")
    .eq("id", caseId)
    .maybeSingle();

  if (error || !data) {
    throw new Error(error?.message || "The alumni onboarding case could not be loaded.");
  }

  return data as AlumniCase;
}

async function allocateAlumniJnuitsId(admin: AdminClient) {
  const { data, error } = await asFlexibleClient(admin).rpc("allocate_membership_id" as string, {
    year_block: String(new Date().getUTCFullYear()),
  });

  if (error || typeof data !== "string") {
    throw new Error(error?.message || "Unable to allocate a JnUITS ID for this alumni member.");
  }

  return data;
}

async function resolveAlumniMember(admin: AdminClient, onboardingCase: AlumniCase): Promise<AlumniMember> {
  if (!onboardingCase.email?.trim()) {
    throw new Error("This confirmed alumni case does not include an email address.");
  }

  const identity = normalizeAlumniIdentity({
    email: onboardingCase.email,
    jnuitsId: onboardingCase.jnuits_id,
  });
  const flexibleAdmin = asFlexibleClient(admin);
  const memberSelect = "id, email, full_name, jnuits_id, user_id";
  const [byEmailResult, byJnuitsIdResult] = await Promise.all([
    flexibleAdmin
      .from("members" as string)
      .select(memberSelect)
      .eq("email", identity.email)
      .maybeSingle(),
    identity.jnuitsId
      ? flexibleAdmin
          .from("members" as string)
          .select(memberSelect)
          .eq("jnuits_id", identity.jnuitsId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (byEmailResult.error || byJnuitsIdResult.error) {
    throw new Error(
      byEmailResult.error?.message ||
        byJnuitsIdResult.error?.message ||
        "Unable to check existing alumni identities."
    );
  }

  const memberByEmail = byEmailResult.data as AlumniMember | null;
  const memberByJnuitsId = byJnuitsIdResult.data as AlumniMember | null;
  const match = resolveAlumniMemberMatch(memberByEmail, memberByJnuitsId);

  if (match.kind === "conflict") {
    throw new Error(
      "The submitted email and JnUITS ID belong to different member records. Resolve the identity conflict before approval."
    );
  }

  const nowIso = new Date().toISOString();
  if (match.kind === "existing") {
    const member = match.member;
    const existingEmail = member.email?.trim().toLowerCase() || null;

    if (memberByJnuitsId && existingEmail && existingEmail !== identity.email) {
      throw new Error(
        "The matching JnUITS ID has a different email address. Verify and update the member record before issuing a claim invitation."
      );
    }

    const { error } = await flexibleAdmin
      .from("members" as string)
      .update({
        email: member.email || identity.email,
        lifecycle_changed_at: nowIso,
        lifecycle_note: "Reactivated through approved alumni onboarding.",
        lifecycle_status: "alumni",
        member_type: "alumni",
        portal_access_status: "active",
        updated_at: nowIso,
      })
      .eq("id", member.id);

    if (error) {
      throw new Error(error.message);
    }

    return {
      ...member,
      email: member.email || identity.email,
      member_type: "alumni",
      lifecycle_status: "alumni",
      portal_access_status: "active",
    };
  }

  const suppliedId = normalizeJnuitsIdForCreation(onboardingCase.jnuits_id || "");
  const jnuitsId = suppliedId || (await allocateAlumniJnuitsId(admin));
  const { data, error } = await flexibleAdmin
    .from("members" as string)
    .insert({
      email: identity.email,
      full_name: onboardingCase.full_name?.trim() || "JnUITS alumni",
      jnuits_id: jnuitsId,
      lifecycle_changed_at: nowIso,
      lifecycle_note: "Created through approved alumni onboarding.",
      lifecycle_status: "alumni",
      member_type: "alumni",
      portal_access_status: "active",
      professional_visibility: "members-only",
    })
    .select(memberSelect)
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Unable to create the alumni member record.");
  }

  return data as AlumniMember;
}

async function markAlumniCaseReviewed(options: {
  actorUserId: string;
  admin: AdminClient;
  onboardingCase: AlumniCase;
  reviewNote: string;
  status: "approved" | "rejected";
  invitationId?: null | string;
  memberId?: null | string;
}) {
  const nowIso = new Date().toISOString();
  const flexibleAdmin = asFlexibleClient(options.admin);
  const { data: updatedCase, error: caseError } = await flexibleAdmin
    .from("alumni_onboarding_cases" as string)
    .update({
      invitation_id: options.invitationId || null,
      processed_member_id: options.memberId || null,
      review_note: options.reviewNote || null,
      reviewed_at: nowIso,
      reviewed_by_user_id: options.actorUserId,
      status: options.status,
    })
    .eq("id", options.onboardingCase.id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (caseError || !updatedCase) {
    throw new Error(caseError?.message || "This alumni case has already been reviewed.");
  }

  const { data: updatedSubmission, error: submissionError } = await flexibleAdmin
    .from("form_submissions" as string)
    .update({
      review_status: options.status,
      reviewed_at: nowIso,
      reviewed_by_user_id: options.actorUserId,
    })
    .eq("id", options.onboardingCase.form_submission_id)
    .eq("review_status", "unreviewed")
    .select("id")
    .maybeSingle();

  if (submissionError || !updatedSubmission) {
    throw new Error(submissionError?.message || "The linked form submission has already been reviewed.");
  }
}

export async function approveAlumniOnboardingCase(formData: FormData) {
  const auth = await requireAdminPermission("admin.membership.manage", {
    fallbackPath: "/admin/dashboard",
  });
  const actorUserId = auth.user?.id;
  if (!actorUserId) redirect("/login");

  const parsed = reviewSchema.safeParse({
    caseId: getFormValue(formData, "caseId"),
    reviewNote: getFormValue(formData, "reviewNote"),
  });
  if (!parsed.success) {
    await setAdminFlash({
      tone: "error",
      title: "Alumni approval failed",
      message: parsed.error.issues[0]?.message || "The alumni case is invalid.",
    });
    redirectToQueue();
  }

  const admin = createAdminClient();
  try {
    const onboardingCase = await loadPendingCase(admin, parsed.data.caseId);
    if (onboardingCase.status !== "pending") {
      throw new Error("This alumni case has already been reviewed.");
    }

    const member = await resolveAlumniMember(admin, onboardingCase);
    const invitation = await issueInvitationForMember({
      actorUserId,
      admin,
      emailVariant: "alumni",
      expiresInDays: DEFAULT_INVITATION_EXPIRY_DAYS,
      invitationType: "alumni_direct",
      maxUses: 1,
      member,
      note: parsed.data.reviewNote || "Generated from alumni onboarding approval.",
    });

    await markAlumniCaseReviewed({
      actorUserId,
      admin,
      invitationId: invitation.invitationId,
      memberId: member.id,
      onboardingCase,
      reviewNote: parsed.data.reviewNote,
      status: "approved",
    });

    await asFlexibleClient(admin).from("membership_lifecycle_events" as string).insert({
      created_by_user_id: actorUserId,
      event_type: "alumni_onboarding_approved",
      member_id: member.id,
      metadata: {
        alumniCaseId: onboardingCase.id,
        invitationId: invitation.invitationId,
        invitationDeliveryStatus: invitation.deliveryStatus,
      },
      summary: "Alumni onboarding approved and claim invitation issued.",
    });
    await asFlexibleClient(admin).from("audit_events" as string).insert({
      action: "alumni.onboarding_approved",
      actor_user_id: actorUserId,
      entity_id: onboardingCase.id,
      entity_type: "alumni_onboarding_case",
      metadata: {
        invitationId: invitation.invitationId,
        memberId: member.id,
        reviewNote: parsed.data.reviewNote || null,
      },
    });

    revalidatePath("/admin");
    revalidatePath("/admin/applications");
    revalidatePath("/admin/membership");
    revalidatePath("/admin/invitations");
    await setAdminFlash({
      tone: "success",
      title: "Alumni onboarding approved",
      message:
        invitation.deliveryStatus === "failed"
          ? `${member.full_name || "The alumni member"} was approved, but the invitation email needs a retry from Invitations.`
          : `${member.full_name || "The alumni member"} can now claim the alumni portal account.`,
      invitationCode: invitation.code,
      jnuitsId: member.jnuits_id || undefined,
    });
  } catch (error) {
    await setAdminFlash({
      tone: "error",
      title: "Alumni approval failed",
      message: getSafeAdminActionErrorMessage(error, {
        context: "alumni.onboarding.approve",
        fallback: "The alumni invitation workflow could not be completed.",
      }),
    });
  }

  redirectToQueue();
}

export async function rejectAlumniOnboardingCase(formData: FormData) {
  const auth = await requireAdminPermission("admin.membership.manage", {
    fallbackPath: "/admin/dashboard",
  });
  const actorUserId = auth.user?.id;
  if (!actorUserId) redirect("/login");

  const parsed = reviewSchema.safeParse({
    caseId: getFormValue(formData, "caseId"),
    reviewNote: getFormValue(formData, "reviewNote"),
  });
  if (!parsed.success) {
    await setAdminFlash({
      tone: "error",
      title: "Alumni rejection failed",
      message: parsed.error.issues[0]?.message || "The alumni case is invalid.",
    });
    redirectToQueue();
  }

  const admin = createAdminClient();
  try {
    const onboardingCase = await loadPendingCase(admin, parsed.data.caseId);
    if (onboardingCase.status !== "pending") {
      throw new Error("This alumni case has already been reviewed.");
    }

    await markAlumniCaseReviewed({
      actorUserId,
      admin,
      onboardingCase,
      reviewNote: parsed.data.reviewNote,
      status: "rejected",
    });
    await asFlexibleClient(admin).from("audit_events" as string).insert({
      action: "alumni.onboarding_rejected",
      actor_user_id: actorUserId,
      entity_id: onboardingCase.id,
      entity_type: "alumni_onboarding_case",
      metadata: { reviewNote: parsed.data.reviewNote || null },
    });

    if (onboardingCase.email && onboardingCase.full_name) {
      void sendEmail({
        html: buildAlumniConversionDecisionEmail({
          approved: false,
          memberName: onboardingCase.full_name,
          reviewNote: parsed.data.reviewNote || null,
        }),
        subject: "An update on your JnUITS alumni onboarding",
        to: onboardingCase.email,
      });
    }

    revalidatePath("/admin");
    revalidatePath("/admin/applications");
    await setAdminFlash({
      tone: "success",
      title: "Alumni onboarding rejected",
      message: "The alumni case has been marked as rejected.",
    });
  } catch (error) {
    await setAdminFlash({
      tone: "error",
      title: "Alumni rejection failed",
      message: getSafeAdminActionErrorMessage(error, {
        context: "alumni.onboarding.reject",
        fallback: "The alumni case could not be updated.",
      }),
    });
  }

  redirectToQueue();
}