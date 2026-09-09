import "server-only";

import type { createAdminClient } from "@/lib/supabase/admin";
import { asFlexibleClient } from "@/lib/supabase/flexible";
import {
  generateInvitationCode,
  getInvitationExpiryIso,
  hashInvitationCode,
  hashInvitationCodeCandidates,
} from "@/lib/members/invitation-code";
import { buildClaimProfileUrl } from "@/lib/members/claim-url";
import {
  buildAlumniInvitationEmail,
  buildMemberInvitationEmail,
} from "@/lib/notifications/email-builders";
import { sendEmail } from "@/lib/notifications/send-email";

export type AdminClient = ReturnType<typeof createAdminClient>;

export type InvitationType =
  | "alumni_direct"
  | "bulk_csv"
  | "manual"
  | "member_claim"
  | "renewal"
  | "replacement";

export type InvitationEmailVariant = "alumni" | "member";

export type InvitationMember = {
  email: null | string;
  full_name: null | string;
  id: string;
  is_profile_claimed?: boolean | null;
  jnuits_id: null | string;
  lifecycle_status?: null | string;
  member_type?: null | string;
  portal_access_status?: null | string;
};

export type InvitationIssueResult = {
  code: string;
  deliveryError?: string;
  deliveryStatus: "failed" | "sent" | "skipped";
  expiresAt: string;
  invitationId: string;
};

export async function generateUniqueInvitationCode(admin: AdminClient) {
  const flexibleAdmin = asFlexibleClient(admin);

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = generateInvitationCode();
    const codeHash = hashInvitationCode(code);
    const { data } = await flexibleAdmin
      .from("member_invitations" as string)
      .select("id")
      .in("code_hash", hashInvitationCodeCandidates(code))
      .maybeSingle();

    if (!data) {
      return { code, codeHash };
    }
  }

  throw new Error("Unable to generate a unique invitation code.");
}

export async function persistInvitationAudit(
  admin: AdminClient,
  payload: {
    action: string;
    actor_user_id: string | null;
    entity_id: string | null;
    entity_type: string;
    metadata?: Record<string, unknown>;
  }
) {
  await asFlexibleClient(admin).from("audit_events" as string).insert({
    action: payload.action,
    actor_user_id: payload.actor_user_id,
    entity_id: payload.entity_id,
    entity_type: payload.entity_type,
    metadata: payload.metadata || {},
  });
}

export async function recordInvitationDelivery(
  admin: AdminClient,
  payload: {
    actorUserId: string;
    errorMessage?: string;
    invitationId: string;
    providerMessageId?: string;
    recipientEmail: string;
    sentAt?: string;
    status: "failed" | "pending" | "sent" | "skipped";
  }
) {
  await asFlexibleClient(admin).from("invitation_email_deliveries" as string).insert({
    created_by_user_id: payload.actorUserId,
    error_message: payload.errorMessage || null,
    invitation_id: payload.invitationId,
    provider_message_id: payload.providerMessageId || null,
    recipient_email: payload.recipientEmail,
    sent_at: payload.sentAt || null,
    status: payload.status,
  });
}

export async function issueInvitationForMember(options: {
  actorUserId: string;
  admin: AdminClient;
  batchId?: null | string;
  emailVariant?: InvitationEmailVariant;
  expiresInDays: number;
  invitationType: InvitationType;
  maxUses: number;
  member: InvitationMember;
  note?: string;
}) {
  const flexibleAdmin = asFlexibleClient(options.admin);
  const invitation = await generateUniqueInvitationCode(options.admin);
  const expiresAt = getInvitationExpiryIso(options.expiresInDays);
  const email = options.member.email?.trim().toLowerCase() || "";
  const memberName = options.member.full_name || "JnUITS member";
  const jnuitsId = options.member.jnuits_id || "JnUITS member";
  const emailVariant =
    options.emailVariant ??
    (options.invitationType === "alumni_direct" ? "alumni" : "member");

  const { data, error } = await flexibleAdmin
    .from("member_invitations" as string)
    .insert({
      batch_id: options.batchId || null,
      code_hash: invitation.codeHash,
      created_by_user_id: options.actorUserId,
      delivery_status: email ? "pending" : "skipped",
      expires_at: expiresAt,
      invitation_type: options.invitationType,
      max_uses: options.maxUses,
      member_id: options.member.id,
      notes: options.note || null,
      recipient_email_snapshot: email || null,
      recipient_name_snapshot: memberName,
      send_attempts: 0,
    })
    .select("id")
    .single();

  if (error || !data?.id) {
    throw new Error(error?.message || "Unable to create invitation.");
  }

  let deliveryStatus: InvitationIssueResult["deliveryStatus"] = "skipped";
  let deliveryError: string | undefined;
  let providerMessageId: string | undefined;
  let sentAt: string | null = null;
  let sendAttempts = 0;

  if (email) {
    sendAttempts = 1;
    const claimUrl = buildClaimProfileUrl({
      email,
      invitationCode: invitation.code,
      jnuitsId,
    });
    const emailResult = await sendEmail({
      html:
        emailVariant === "alumni"
          ? buildAlumniInvitationEmail({
              alumniName: memberName,
              alumniEmail: email,
              claimUrl,
              invitationCode: invitation.code,
              invitationExpiresAt: expiresAt,
              jnuitsId,
            })
          : buildMemberInvitationEmail({
              claimUrl,
              invitationCode: invitation.code,
              invitationExpiresAt: expiresAt,
              jnuitsId,
              memberEmail: email,
              memberName,
            }),
      subject:
        emailVariant === "alumni"
          ? "Your JnUITS alumni portal invitation"
          : "Claim your JnUITS member account",
      to: email,
      idempotencyKey: `member-invitation/${data.id}`,
    });

    deliveryStatus = emailResult.success ? "sent" : "failed";
    deliveryError = emailResult.error;
    providerMessageId = emailResult.messageId;
    sentAt = emailResult.success ? new Date().toISOString() : null;

    await recordInvitationDelivery(options.admin, {
      actorUserId: options.actorUserId,
      errorMessage: deliveryError,
      invitationId: data.id,
      providerMessageId,
      recipientEmail: email,
      sentAt: sentAt || undefined,
      status: deliveryStatus,
    });
  }

  await flexibleAdmin
    .from("member_invitations" as string)
    .update({
      delivery_status: deliveryStatus,
      last_sent_at: sentAt,
      send_attempts: sendAttempts,
    })
    .eq("id", data.id);

  return {
    code: invitation.code,
    deliveryError,
    deliveryStatus,
    expiresAt,
    invitationId: data.id,
  } satisfies InvitationIssueResult;
}

export async function revokeInvitationRecord(options: {
  actorUserId: string;
  admin: AdminClient;
  invitationId: string;
  reason?: string;
}) {
  const revokedAt = new Date().toISOString();
  const { error } = await asFlexibleClient(options.admin)
    .from("member_invitations" as string)
    .update({
      delivery_status: "revoked",
      is_active: false,
      revoked_at: revokedAt,
      revoked_by_user_id: options.actorUserId,
      revocation_reason: options.reason || null,
      updated_at: revokedAt,
    })
    .eq("id", options.invitationId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function syncInvitationBatchMetrics(admin: AdminClient, batchId: string) {
  const flexibleAdmin = asFlexibleClient(admin);
  const [issuedResult, claimedResult, failedResult] = await Promise.all([
    flexibleAdmin
      .from("member_invitations" as string)
      .select("id", { count: "exact", head: true })
      .eq("batch_id", batchId),
    flexibleAdmin
      .from("member_invitations" as string)
      .select("id", { count: "exact", head: true })
      .eq("batch_id", batchId)
      .gt("used_count", 0),
    flexibleAdmin
      .from("member_invitations" as string)
      .select("id", { count: "exact", head: true })
      .eq("batch_id", batchId)
      .in("delivery_status", ["failed", "bounced", "complained"]),
  ]);

  const countError = issuedResult.error || claimedResult.error || failedResult.error;
  if (countError) {
    throw new Error(countError.message);
  }

  const issuedCount = issuedResult.count || 0;
  const claimedCount = claimedResult.count || 0;
  const failedCount = failedResult.count || 0;

  const { error: updateError } = await flexibleAdmin
    .from("invitation_batches" as string)
    .update({
      claimed_count: claimedCount,
      issued_count: issuedCount,
      metadata: {
        failedCount,
        lastSyncedAt: new Date().toISOString(),
      },
    })
    .eq("id", batchId);

  if (updateError) {
    throw new Error(updateError.message);
  }

  return { claimedCount, failedCount, issuedCount };
}
