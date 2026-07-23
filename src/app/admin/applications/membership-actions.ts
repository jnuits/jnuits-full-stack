"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { setAdminFlash } from "@/lib/admin/flash";
import { requireAdminPermission } from "@/lib/auth/session";
import { getAppBaseUrl } from "@/lib/env";
import { buildClaimProfileUrl } from "@/lib/members/claim-url";
import {
  generateInvitationCode,
  getInvitationExpiryIso,
  hashInvitationCode,
} from "@/lib/members/invitation-code";
import {
  buildMembershipApprovedEmail,
  buildMembershipRejectedEmail,
} from "@/lib/notifications/email-builders";
import { sendEmail } from "@/lib/notifications/send-email";
import { createAdminClient } from "@/lib/supabase/admin";
import { asFlexibleClient } from "@/lib/supabase/flexible";

const decisionSchema = z.object({
  applicationId: z.string().uuid(),
  reviewNote: z.string().trim().max(1500).optional().default(""),
});

type ApprovalResult = {
  invitation_id: null | string;
  jnuits_id: null | string;
  member_id: null | string;
  result_status: string;
};

function parse(formData: FormData) {
  return decisionSchema.safeParse({
    applicationId: formData.get("applicationId"),
    reviewNote: formData.get("reviewNote"),
  });
}

async function actor() {
  const auth = await requireAdminPermission("admin.membership.manage", {
    fallbackPath: "/admin/applications",
  });
  if (!auth.user?.id) redirect("/admin/login");
  return auth.user.id;
}

async function applicationIdentity(applicationId: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("membership_applications")
    .select("name, email")
    .eq("id", applicationId)
    .maybeSingle();
  return data;
}

async function finish(title: string, message: string, tone: "error" | "success") {
  revalidatePath("/admin/applications");
  revalidatePath("/admin/membership");
  await setAdminFlash({ message, title, tone });
  redirect("/admin/applications");
}

export async function approveMembershipApplication(formData: FormData) {
  const actorUserId = await actor();
  const parsed = parse(formData);
  if (!parsed.success) return finish("Approval failed", "Invalid application request.", "error");

  const identity = await applicationIdentity(parsed.data.applicationId);
  if (!identity) return finish("Approval failed", "Application not found.", "error");

  const invitationCode = generateInvitationCode();
  const expiresAt = getInvitationExpiryIso(14);
  const admin = asFlexibleClient(createAdminClient());
  const { data, error } = await admin.rpc("approve_membership_application", {
    p_actor_user_id: actorUserId,
    p_application_id: parsed.data.applicationId,
    p_invitation_code_hash: hashInvitationCode(invitationCode),
    p_invitation_expires_at: expiresAt,
    p_review_note: parsed.data.reviewNote || null,
  });
  const result = (Array.isArray(data) ? data[0] : data) as ApprovalResult | null;

  if (error || !result || !["approved", "already_approved"].includes(result.result_status)) {
    return finish("Approval failed", "The membership workflow could not be completed.", "error");
  }

  if (result.result_status === "approved" && result.jnuits_id) {
    const claimUrl = buildClaimProfileUrl({
      email: identity.email,
      invitationCode,
      jnuitsId: result.jnuits_id,
    });
    void sendEmail({
      html: buildMembershipApprovedEmail({
        applicantEmail: identity.email,
        applicantName: identity.name,
        claimUrl: new URL(claimUrl, getAppBaseUrl()).toString(),
        invitationCode,
        invitationExpiresAt: expiresAt,
        jnuitsId: result.jnuits_id,
      }),
      idempotencyKey: `membership-approval/${parsed.data.applicationId}/${result.invitation_id}`,
      subject: "Your JnUITS membership application has been approved",
      to: identity.email,
    });
  }

  return finish(
    "Application approved",
    result.result_status === "already_approved"
      ? "This application was already approved. No duplicate member or invitation was created."
      : `${identity.name} can now claim the approved member profile.`,
    "success"
  );
}

async function review(formData: FormData, target: "needs_review" | "rejected") {
  const actorUserId = await actor();
  const parsed = parse(formData);
  if (!parsed.success) return finish("Review failed", "Invalid application request.", "error");
  const identity = await applicationIdentity(parsed.data.applicationId);
  if (!identity) return finish("Review failed", "Application not found.", "error");

  const admin = asFlexibleClient(createAdminClient());
  const { data, error } = await admin.rpc("review_membership_application", {
    p_actor_user_id: actorUserId,
    p_application_id: parsed.data.applicationId,
    p_review_note: parsed.data.reviewNote || null,
    p_target_status: target,
  });
  const result = (Array.isArray(data) ? data[0] : data) as
    | { result_status?: string }
    | null;
  if (error || result?.result_status !== "updated") {
    return finish("Review failed", "The application could not be updated.", "error");
  }

  if (target === "rejected") {
    void sendEmail({
      html: buildMembershipRejectedEmail({
        applicantName: identity.name,
        reviewNote: parsed.data.reviewNote || null,
      }),
      idempotencyKey: `membership-rejection/${parsed.data.applicationId}`,
      subject: "An update on your JnUITS membership application",
      to: identity.email,
    });
  }

  return finish(
    target === "rejected" ? "Application rejected" : "Follow-up requested",
    target === "rejected"
      ? `${identity.name}'s application was rejected.`
      : `${identity.name}'s application is marked for further review.`,
    "success"
  );
}

export async function requestMembershipApplicationReview(formData: FormData) {
  return review(formData, "needs_review");
}

export async function rejectMembershipApplication(formData: FormData) {
  return review(formData, "rejected");
}
