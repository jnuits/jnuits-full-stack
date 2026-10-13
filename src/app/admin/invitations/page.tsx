import { requireAdminPermission } from "@/lib/auth/session";
import { cookies } from "next/headers";

import {
  InvitationsWorkspaceClient,
  type InvitationWorkspaceAuditEvent,
  type InvitationWorkspaceBatch,
  type InvitationWorkspaceDelivery,
  type InvitationWorkspaceInvitation,
  type InvitationWorkspaceMetrics,
} from "@/components/admin/invitations-workspace-client";
import { ADMIN_FLASH_COOKIE_NAME, parseAdminFlash } from "@/lib/admin/flash";
import { formatMembershipIdForDisplay } from "@/lib/members/jnuits-id";
import { createAdminClient } from "@/lib/supabase/admin";
import { asFlexibleClient } from "@/lib/supabase/flexible";

type SearchParams = Record<string, string | string[] | undefined>;

type InvitationRow = {
  batch_id?: null | string;
  created_at: string;
  delivery_status?: null | string;
  expires_at: string;
  id: string;
  invitation_batches?:
    | {
        id?: string;
        label?: null | string;
        source?: null | string;
        status?: null | string;
      }
    | {
        id?: string;
        label?: null | string;
        source?: null | string;
        status?: null | string;
      }[]
    | null;
  invitation_type?: null | string;
  is_active: boolean;
  last_sent_at?: null | string;
  last_used_at: null | string;
  max_uses: number;
  member_id: string;
  members?:
    | {
        email?: null | string;
        full_name?: null | string;
        jnuits_id?: null | string;
        member_type?: null | string;
      }
    | {
        email?: null | string;
        full_name?: null | string;
        jnuits_id?: null | string;
        member_type?: null | string;
      }[]
    | null;
  notes: null | string;
  recipient_email_snapshot?: null | string;
  recipient_name_snapshot?: null | string;
  revoked_at: null | string;
  revocation_reason?: null | string;
  send_attempts?: number | null;
  used_count: number;
};

type BatchRow = {
  claimed_count: number;
  created_at: string;
  cycle_id: null | string;
  expires_at: null | string;
  id: string;
  issued_count: number;
  label: string;
  metadata?: Record<string, unknown> | null;
  membership_cycles?:
    | { code?: null | string; title?: null | string }
    | { code?: null | string; title?: null | string }[]
    | null;
  source: string;
  status: string;
};

type DeliveryRow = {
  created_at: string;
  error_message: null | string;
  id: string;
  invitation_id: string;
  provider_message_id: null | string;
  recipient_email: string;
  sent_at: null | string;
  status: string;
};

type AuditRow = {
  action: string;
  created_at: string;
  entity_id: null | string;
  entity_type: string;
  id: string;
};

function resolveOne<T>(relation: T | T[] | null | undefined) {
  if (!relation) {
    return null;
  }

  return Array.isArray(relation) ? relation[0] || null : relation;
}

function parseString(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

function parsePositiveInt(
  value: string | string[] | undefined,
  fallback: number,
  max: number
) {
  const parsed = Number.parseInt(parseString(value), 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, max) : fallback;
}

function parsePageSize(value: string | string[] | undefined) {
  const parsed = parsePositiveInt(value, 20, 50);
  return [15, 20, 50].includes(parsed) ? parsed : 20;
}

function parseFilter(value: string | string[] | undefined) {
  return parseString(value).trim();
}

function mapInvitation(row: InvitationRow): InvitationWorkspaceInvitation {
  const member = resolveOne(row.members);
  const batch = resolveOne(row.invitation_batches);
  const fallbackName = row.recipient_name_snapshot || "Linked member";

  return {
    batchId: row.batch_id || null,
    batchLabel: batch?.label || null,
    batchSource: batch?.source || null,
    batchStatus: batch?.status || null,
    createdAt: row.created_at,
    deliveryStatus: row.delivery_status || "pending",
    displayJnuitsId: formatMembershipIdForDisplay(member?.jnuits_id) || row.member_id,
    email: member?.email || null,
    expiresAt: row.expires_at,
    id: row.id,
    invitationType: row.invitation_type || "member_claim",
    isActive: row.is_active,
    lastSentAt: row.last_sent_at || null,
    lastUsedAt: row.last_used_at,
    maxUses: row.max_uses,
    memberId: row.member_id,
    memberName: member?.full_name || fallbackName,
    memberType: member?.member_type || null,
    notes: row.notes,
    recipientEmailSnapshot: row.recipient_email_snapshot || null,
    recipientNameSnapshot: row.recipient_name_snapshot || null,
    revokedAt: row.revoked_at,
    revocationReason: row.revocation_reason || null,
    sendAttempts: row.send_attempts || 0,
    usedCount: row.used_count,
  };
}

function mapBatch(row: BatchRow): InvitationWorkspaceBatch {
  const cycle = resolveOne(row.membership_cycles);
  const metadata = row.metadata || {};
  const failedCount =
    typeof metadata.failedCount === "number" ? metadata.failedCount : 0;

  return {
    claimedCount: row.claimed_count || 0,
    createdAt: row.created_at,
    cycleId: row.cycle_id,
    cycleLabel: cycle?.code ? `${cycle.code} · ${cycle.title || "Cycle"}` : null,
    expiresAt: row.expires_at,
    failedCount,
    id: row.id,
    issuedCount: row.issued_count || 0,
    label: row.label,
    source: row.source,
    status: row.status,
  };
}

export const metadata = { title: "Invitations — Admin | JnUITS" };

export default async function InvitationsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireAdminPermission("admin.membership.manage", { fallbackPath: "/admin/dashboard" });
  const admin = createAdminClient();
  const flexibleAdmin = asFlexibleClient(admin);
  const cookieStore = await cookies();
  const flash = parseAdminFlash(cookieStore.get(ADMIN_FLASH_COOKIE_NAME)?.value);
  const resolvedSearchParams = await searchParams;
  const page = parsePositiveInt(resolvedSearchParams.page, 1, 10_000);
  const pageSize = parsePageSize(resolvedSearchParams.pageSize);
  const statusFilter = parseFilter(resolvedSearchParams.status);
  const typeFilter = parseFilter(resolvedSearchParams.type);
  const deliveryFilter = parseFilter(resolvedSearchParams.delivery);
  const batchFilter = parseFilter(resolvedSearchParams.batch);
  const rangeFrom = (page - 1) * pageSize;
  const rangeTo = rangeFrom + pageSize - 1;
  const now = new Date();
  const soon = new Date(now);
  soon.setHours(soon.getHours() + 72);
  const nowIso = now.toISOString();
  const soonIso = soon.toISOString();

  let invitationsQuery = flexibleAdmin
    .from("member_invitations" as string)
    .select(
      "id, batch_id, member_id, created_at, expires_at, is_active, last_used_at, max_uses, notes, revoked_at, used_count, invitation_type, delivery_status, last_sent_at, send_attempts, recipient_email_snapshot, recipient_name_snapshot, revocation_reason, members(full_name, jnuits_id, email, member_type), invitation_batches(id, label, source, status)",
      { count: "exact" }
    );

  if (statusFilter === "active") {
    invitationsQuery = invitationsQuery
      .eq("is_active", true)
      .is("revoked_at", null)
      .gt("expires_at", nowIso)
      .eq("used_count", 0);
  } else if (statusFilter === "claimed") {
    invitationsQuery = invitationsQuery.gt("used_count", 0);
  } else if (statusFilter === "expired") {
    invitationsQuery = invitationsQuery.lt("expires_at", nowIso);
  } else if (statusFilter === "revoked") {
    invitationsQuery = invitationsQuery.eq("is_active", false);
  }

  if (typeFilter) {
    invitationsQuery = invitationsQuery.eq("invitation_type", typeFilter);
  }

  if (deliveryFilter) {
    invitationsQuery = invitationsQuery.eq("delivery_status", deliveryFilter);
  }

  if (batchFilter) {
    invitationsQuery = invitationsQuery.eq("batch_id", batchFilter);
  }

  const [
    invitationsResult,
    batchesResult,
    deliveriesResult,
    auditResult,
    activeCountResult,
    expiringSoonCountResult,
    claimedCountResult,
    failedDeliveryCountResult,
    revokedCountResult,
    expiredCountResult,
  ] = await Promise.all([
    invitationsQuery.order("created_at", { ascending: false }).range(rangeFrom, rangeTo),
    flexibleAdmin
      .from("invitation_batches" as string)
      .select(
        "id, cycle_id, label, source, status, issued_count, claimed_count, expires_at, metadata, created_at, membership_cycles(code, title)"
      )
      .order("created_at", { ascending: false })
      .limit(50),
    flexibleAdmin
      .from("invitation_email_deliveries" as string)
      .select("id, invitation_id, recipient_email, status, provider_message_id, error_message, sent_at, created_at")
      .order("created_at", { ascending: false })
      .limit(30),
    flexibleAdmin
      .from("audit_events" as string)
      .select("id, action, entity_type, entity_id, created_at")
      .in("entity_type", ["member_invitation", "invitation_batch"])
      .order("created_at", { ascending: false })
      .limit(30),
    flexibleAdmin
      .from("member_invitations" as string)
      .select("id", { count: "exact", head: true })
      .eq("is_active", true)
      .is("revoked_at", null)
      .gt("expires_at", nowIso),
    flexibleAdmin
      .from("member_invitations" as string)
      .select("id", { count: "exact", head: true })
      .eq("is_active", true)
      .is("revoked_at", null)
      .gt("expires_at", nowIso)
      .lte("expires_at", soonIso),
    flexibleAdmin
      .from("member_invitations" as string)
      .select("id", { count: "exact", head: true })
      .gt("used_count", 0),
    flexibleAdmin
      .from("member_invitations" as string)
      .select("id", { count: "exact", head: true })
      .eq("delivery_status", "failed"),
    flexibleAdmin
      .from("member_invitations" as string)
      .select("id", { count: "exact", head: true })
      .eq("is_active", false),
    flexibleAdmin
      .from("member_invitations" as string)
      .select("id", { count: "exact", head: true })
      .lt("expires_at", nowIso),
  ]);

  const invitationRows = (invitationsResult.data || []) as InvitationRow[];
  const batchRows = (batchesResult.data || []) as BatchRow[];
  const batches = batchRows.map(mapBatch);
  const metrics: InvitationWorkspaceMetrics = {
    active: activeCountResult.count || 0,
    batchClaimed: batches.reduce((sum, batch) => sum + batch.claimedCount, 0),
    batchIssued: batches.reduce((sum, batch) => sum + batch.issuedCount, 0),
    claimed: claimedCountResult.count || 0,
    expiringSoon: expiringSoonCountResult.count || 0,
    failedDelivery: failedDeliveryCountResult.count || 0,
    revokedOrExpired: (revokedCountResult.count || 0) + (expiredCountResult.count || 0),
  };

  const deliveries: InvitationWorkspaceDelivery[] = ((deliveriesResult.data || []) as DeliveryRow[]).map(
    (delivery) => ({
      createdAt: delivery.created_at,
      errorMessage: delivery.error_message,
      id: delivery.id,
      invitationId: delivery.invitation_id,
      providerMessageId: delivery.provider_message_id,
      recipientEmail: delivery.recipient_email,
      sentAt: delivery.sent_at,
      status: delivery.status,
    })
  );

  const auditEvents: InvitationWorkspaceAuditEvent[] = ((auditResult.data || []) as AuditRow[]).map(
    (event) => ({
      action: event.action,
      createdAt: event.created_at,
      entityId: event.entity_id,
      entityType: event.entity_type,
      id: event.id,
    })
  );

  return (
    <InvitationsWorkspaceClient
      auditEvents={auditEvents}
      batches={batches}
      deliveries={deliveries}
      flash={flash}
      invitations={invitationRows.map(mapInvitation)}
      metrics={metrics}
      page={page}
      pageSize={pageSize}
      totalCount={invitationsResult.count || invitationRows.length}
    />
  );
}
