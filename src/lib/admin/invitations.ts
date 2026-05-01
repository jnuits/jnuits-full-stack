import "server-only";

import type { createAdminClient } from "@/lib/supabase/admin";
import { asFlexibleClient } from "@/lib/supabase/flexible";
import {
  generateInvitationCode,
  getInvitationExpiryIso,
  hashInvitationCode,
} from "@/lib/members/invitation-code";
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

export type InvitationMember = {
  email: null | string;
  full_name: null | string;
  id: string;
  is_profile_claimed?: boolean | null;
  jnuits_id: null | string;
  lifecycle_status?: null | string;
  member_type?: null | string;
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
      .eq("code_hash", codeHash)
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
    const emailResult = await sendEmail({
      html:
        options.invitationType === "alumni_direct"
          ? buildAlumniInvitationEmail({
              alumniName: memberName,
              invitationCode: invitation.code,
              invitationExpiresAt: expiresAt,
              jnuitsId,
            })
          : buildMemberInvitationEmail({
              invitationCode: invitation.code,
              invitationExpiresAt: expiresAt,
              jnuitsId,
              memberName,
            }),
      subject:
        options.invitationType === "alumni_direct"
          ? "Your JnUITS alumni portal invitation"
          : "Claim your JnUITS member account",
      to: email,
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
  const { data, error } = await flexibleAdmin
    .from("member_invitations" as string)
    .select("id, used_count, delivery_status")
    .eq("batch_id", batchId);

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data || []) as {
    delivery_status?: string | null;
    id: string;
    used_count?: number | null;
  }[];
  const issuedCount = rows.length;
  const claimedCount = rows.filter((row) => (row.used_count || 0) > 0).length;
  const failedCount = rows.filter((row) => row.delivery_status === "failed").length;

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
