"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getSafeAdminActionErrorMessage } from "@/lib/admin/action-error";
import { setAdminFlash } from "@/lib/admin/flash";
import { requireAdminPermission } from "@/lib/auth/session";
import { getAppBaseUrl } from "@/lib/env";
import { buildClaimProfileUrl } from "@/lib/members/claim-url";
import {
  DEFAULT_INVITATION_EXPIRY_DAYS,
  generateInvitationCode,
  getInvitationExpiryIso,
  hashInvitationCode,
} from "@/lib/members/invitation-code";
import {
  buildAlumniConversionDecisionEmail,
  buildAlumniInvitationEmail,
} from "@/lib/notifications/email-builders";
import { sendEmail } from "@/lib/notifications/send-email";
import { createAdminClient } from "@/lib/supabase/admin";
import { asFlexibleClient } from "@/lib/supabase/flexible";

const reviewSchema = z.object({
  caseId: z.string().uuid("The alumni case identifier is missing."),
  reviewNote: z.string().trim().max(1_500).optional().default(""),
});

type ApprovalResult = {
  invitation_id: null | string;
  jnuits_id: null | string;
  member_id: null | string;
  recipient_email: null | string;
  result_status: string;
};

type CaseIdentity = {
  email: null | string;
  full_name: null | string;
};

function parse(formData: FormData) {
  return reviewSchema.safeParse({
    caseId: formData.get("caseId"),
    reviewNote: formData.get("reviewNote"),
  });
}

function redirectToQueue(): never {
  redirect("/admin/applications#alumni-onboarding");
}

async function actor() {
  const auth = await requireAdminPermission("admin.membership.manage", {
    fallbackPath: "/admin/applications#alumni-onboarding",
  });
  if (!auth.user?.id) redirect("/admin/login");
  return auth.user.id;
}

async function loadIdentity(caseId: string): Promise<CaseIdentity | null> {
  const admin = asFlexibleClient(createAdminClient());
  const { data, error } = await admin
    .from("alumni_onboarding_cases" as string)
    .select("full_name, email")
    .eq("id", caseId)
    .maybeSingle();
  if (error || !data) return null;
  return data as CaseIdentity;
}

async function finish(options: {
  invitationCode?: string;
  jnuitsId?: string;
  message: string;
  title: string;
  tone: "error" | "success";
}) {
  revalidatePath("/admin/applications");
  revalidatePath("/admin/membership");
  revalidatePath("/admin/invitations");
  await setAdminFlash(options);
  redirectToQueue();
}

export async function approveAlumniOnboardingCase(formData: FormData) {
  const actorUserId = await actor();
  const parsed = parse(formData);
  if (!parsed.success) {
    return finish({
      message: parsed.error.issues[0]?.message || "The alumni case is invalid.",
      title: "Alumni approval failed",
      tone: "error",
    });
  }

  const identity = await loadIdentity(parsed.data.caseId);
  if (!identity?.email) {
    return finish({
      message: "The confirmed alumni case could not be loaded.",
      title: "Alumni approval failed",
      tone: "error",
    });
  }

  const invitationCode = generateInvitationCode();
  const expiresAt = getInvitationExpiryIso(DEFAULT_INVITATION_EXPIRY_DAYS);
  const admin = asFlexibleClient(createAdminClient());
  const { data, error } = await admin.rpc("approve_alumni_onboarding_case", {
    p_actor_user_id: actorUserId,
    p_case_id: parsed.data.caseId,
    p_invitation_code_hash: hashInvitationCode(invitationCode),
    p_invitation_expires_at: expiresAt,
    p_review_note: parsed.data.reviewNote || null,
  });
  const result = (Array.isArray(data) ? data[0] : data) as ApprovalResult | null;

  if (error || !result) {
    return finish({
      message: getSafeAdminActionErrorMessage(error, {
        context: "alumni.onboarding.approve",
        fallback: "The alumni invitation workflow could not be completed.",
      }),
      title: "Alumni approval failed",
      tone: "error",
    });
  }

  if (result.result_status === "identity_conflict") {
    return finish({
      message: "The submitted email and JnUITS ID belong to different members. Resolve the identity conflict before approval.",
      title: "Identity conflict",
      tone: "error",
    });
  }

  if (result.result_status === "current_member") {
    return finish({
      message: "This identity belongs to a current member. Alumni onboarding will not downgrade the member.",
      title: "Current member protected",
      tone: "error",
    });
  }

  if (!["approved", "reactivated", "already_approved"].includes(result.result_status)) {
    return finish({
      message: "This alumni case could not be approved in its current state.",
      title: "Alumni approval failed",
      tone: "error",
    });
  }

  const memberName = identity.full_name?.trim() || "JnUITS alumni";
  if (result.result_status === "approved" && result.invitation_id && result.jnuits_id) {
    const claimUrl = buildClaimProfileUrl({
      email: result.recipient_email || identity.email,
      invitationCode,
      jnuitsId: result.jnuits_id,
    });
    void sendEmail({
      html: buildAlumniInvitationEmail({
        alumniEmail: result.recipient_email || identity.email,
        alumniName: memberName,
        claimUrl: new URL(claimUrl, getAppBaseUrl()).toString(),
        invitationCode,
        invitationExpiresAt: expiresAt,
        jnuitsId: result.jnuits_id,
      }),
      idempotencyKey: `alumni-onboarding/${parsed.data.caseId}/${result.invitation_id}`,
      subject: "Claim your JnUITS alumni portal account",
      to: result.recipient_email || identity.email,
    });
  } else if (result.result_status === "reactivated") {
    void sendEmail({
      html: buildAlumniConversionDecisionEmail({
        approved: true,
        memberName,
        reviewNote: parsed.data.reviewNote || null,
      }),
      idempotencyKey: `alumni-reactivated/${parsed.data.caseId}`,
      subject: "Your JnUITS alumni access is active",
      to: result.recipient_email || identity.email,
    });
  }

  return finish({
    invitationCode:
      result.result_status === "approved" ? invitationCode : undefined,
    jnuitsId: result.jnuits_id || undefined,
    message:
      result.result_status === "already_approved"
        ? "This case was already approved. No duplicate member or invitation was created."
        : result.result_status === "reactivated"
          ? `${memberName}'s existing alumni account was reactivated safely.`
          : `${memberName} can now claim the alumni portal account.`,
    title: "Alumni onboarding approved",
    tone: "success",
  });
}

export async function rejectAlumniOnboardingCase(formData: FormData) {
  const actorUserId = await actor();
  const parsed = parse(formData);
  if (!parsed.success) {
    return finish({
      message: parsed.error.issues[0]?.message || "The alumni case is invalid.",
      title: "Alumni rejection failed",
      tone: "error",
    });
  }

  const identity = await loadIdentity(parsed.data.caseId);
  if (!identity) {
    return finish({
      message: "The confirmed alumni case could not be loaded.",
      title: "Alumni rejection failed",
      tone: "error",
    });
  }

  const admin = asFlexibleClient(createAdminClient());
  const { data, error } = await admin.rpc("reject_alumni_onboarding_case", {
    p_actor_user_id: actorUserId,
    p_case_id: parsed.data.caseId,
    p_review_note: parsed.data.reviewNote || null,
  });
  const result = (Array.isArray(data) ? data[0] : data) as
    | { result_status?: string }
    | null;

  if (error || !["rejected", "already_rejected"].includes(result?.result_status || "")) {
    return finish({
      message: "The alumni case could not be rejected.",
      title: "Alumni rejection failed",
      tone: "error",
    });
  }

  if (result?.result_status === "rejected" && identity.email) {
    void sendEmail({
      html: buildAlumniConversionDecisionEmail({
        approved: false,
        memberName: identity.full_name?.trim() || "JnUITS alumni applicant",
        reviewNote: parsed.data.reviewNote || null,
      }),
      idempotencyKey: `alumni-rejection/${parsed.data.caseId}`,
      subject: "An update on your JnUITS alumni onboarding",
      to: identity.email,
    });
  }

  return finish({
    message:
      result?.result_status === "already_rejected"
        ? "This alumni case was already rejected."
        : "The alumni case was rejected without exposing application details.",
    title: "Alumni onboarding rejected",
    tone: "success",
  });
}
