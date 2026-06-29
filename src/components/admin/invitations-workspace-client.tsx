"use client";

import {
  Archive,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Copy,
  Ellipsis,
  Eye,
  Mail,
  RefreshCw,
  Search,
  ShieldAlert,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { MouseEvent } from "react";
import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import {
  bulkRevokeInvitationsAction,
  commitCsvInvitationsAction,
  createInvitationBatchAction,
  issueDirectInvitationAction,
  issueInvitationsFromBatchAction,
  previewCsvInvitationsAction,
  reissueInvitationAction,
  revokeInvitationAction,
  syncInvitationBatchMetricsAction,
  updateInvitationBatchStatusAction,
} from "@/app/admin/invitations/actions";

type AdminFlash = {
  invitationCode?: string;
  jnuitsId?: string;
  message: string;
  title: string;
  tone: string;
} | null;

type ActionResult = {
  code?: string;
  deliveryError?: string;
  deliveryStatus?: "failed" | "sent" | "skipped";
  details?: Record<string, unknown>;
  jnuitsId?: string;
  message: string;
  ok: boolean;
  recipientEmail?: string;
};

export type InvitationWorkspaceInvitation = {
  batchId: null | string;
  batchLabel: null | string;
  batchStatus: null | string;
  batchSource: null | string;
  createdAt: string;
  deliveryStatus: string;
  displayJnuitsId: string;
  email: null | string;
  expiresAt: string;
  id: string;
  invitationType: string;
  isActive: boolean;
  lastSentAt: null | string;
  lastUsedAt: null | string;
  maxUses: number;
  memberId: string;
  memberName: string;
  memberType: null | string;
  notes: null | string;
  recipientEmailSnapshot: null | string;
  recipientNameSnapshot: null | string;
  revokedAt: null | string;
  revocationReason: null | string;
  sendAttempts: number;
  usedCount: number;
};

export type InvitationWorkspaceBatch = {
  claimedCount: number;
  createdAt: string;
  cycleId: null | string;
  cycleLabel: null | string;
  expiresAt: null | string;
  failedCount: number;
  id: string;
  issuedCount: number;
  label: string;
  source: string;
  status: string;
};

export type InvitationWorkspaceCycle = {
  code: string;
  endsOn: null | string;
  id: string;
  title: string;
};

export type InvitationWorkspaceDelivery = {
  createdAt: string;
  errorMessage: null | string;
  id: string;
  invitationId: string;
  providerMessageId: null | string;
  recipientEmail: string;
  sentAt: null | string;
  status: string;
};

export type InvitationWorkspaceAuditEvent = {
  action: string;
  createdAt: string;
  entityId: null | string;
  entityType: string;
  id: string;
};

export type InvitationWorkspaceMetrics = {
  active: number;
  batchClaimed: number;
  batchIssued: number;
  claimed: number;
  expiringSoon: number;
  failedDelivery: number;
  revokedOrExpired: number;
};

type InvitationsWorkspaceClientProps = {
  batches: InvitationWorkspaceBatch[];
  cycles: InvitationWorkspaceCycle[];
  deliveries: InvitationWorkspaceDelivery[];
  flash: AdminFlash;
  invitations: InvitationWorkspaceInvitation[];
  metrics: InvitationWorkspaceMetrics;
  page: number;
  pageSize: number;
  totalCount: number;
  auditEvents: InvitationWorkspaceAuditEvent[];
};

const invitationTypeOptions = [
  { label: "Member claim", value: "member_claim" },
  { label: "Alumni direct", value: "alumni_direct" },
  { label: "Renewal", value: "renewal" },
  { label: "Replacement", value: "replacement" },
  { label: "Bulk CSV", value: "bulk_csv" },
  { label: "Manual", value: "manual" },
] as const;

const batchStatuses = ["draft", "active", "closed", "archived"] as const;

function humanize(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDateTime(value: null | string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-BD", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatDate(value: null | string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-BD", { dateStyle: "medium" }).format(new Date(value));
}

function invitationStatus(invitation: InvitationWorkspaceInvitation) {
  if (invitation.revokedAt || !invitation.isActive) return "revoked";
  if (invitation.usedCount > 0) return "claimed";
  if (new Date(invitation.expiresAt) < new Date()) return "expired";
  return "active";
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return `${parts[0]?.[0] || "J"}${parts.at(-1)?.[0] || "S"}`.toUpperCase();
}

function avatarTone(id: string) {
  const tail = id.replace(/[^a-fA-F0-9]/g, "").slice(-2) || "0";
  return String(Number.parseInt(tail, 16) % 4);
}

function detailNumber(result: ActionResult, key: string) {
  const value = result.details?.[key];
  return typeof value === "number" ? value : 0;
}

function actionTone(result: ActionResult) {
  if (!result.ok) return "error";
  if (result.deliveryStatus === "failed" || result.deliveryStatus === "skipped") {
    return "warning";
  }
  if (detailNumber(result, "failed") > 0 || detailNumber(result, "skipped") > 0) {
    return "warning";
  }
  return "success";
}

function actionTitle(result: ActionResult) {
  if (!result.ok) return "Action failed";
  if (result.deliveryStatus === "sent") return "Email sent";
  if (result.deliveryStatus === "failed") return "Email delivery failed";
  if (result.deliveryStatus === "skipped") return "Email not sent";
  if (detailNumber(result, "failed") > 0) return "Some emails failed";
  if (detailNumber(result, "issued") > 0) return "Invitations committed";
  return "Action completed";
}

function ActionFeedback({ result }: { result: ActionResult }) {
  return (
    <div className="invitation-action-feedback" data-tone={actionTone(result)} role="status">
      <strong>{actionTitle(result)}</strong>
      <span className="invitation-action-feedback__message">{result.message}</span>
      {result.recipientEmail ? <small>Recipient: {result.recipientEmail}</small> : null}
      {result.deliveryError ? <small>Delivery provider returned an error. Reissue or review the delivery ledger.</small> : null}
      {result.code ? (
        <div className="invitation-code-reveal">
          <span>
            {result.jnuitsId ? `${result.jnuitsId} · ` : ""}
            {result.code}
          </span>
        </div>
      ) : null}
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  sub,
  tone,
  value,
}: {
  icon: LucideIcon;
  label: string;
  sub: string;
  tone?: string;
  value: number | string;
}) {
  return (
    <div className="admin-metric-card" data-tone={tone}>
      <div className="admin-metric-card__icon">
        <Icon size={16} />
      </div>
      <p className="admin-metric-card__label">{label}</p>
      <p className="admin-metric-card__value">{value}</p>
      <p className="admin-metric-card__sub">{sub}</p>
    </div>
  );
}

function Badge({ kind, value }: { kind: "access" | "lifecycle"; value: string }) {
  return (
    <span className="membership-table-badge" data-kind={kind} data-value={value}>
      {humanize(value)}
    </span>
  );
}

function EmptyPanel({
  action,
  description,
  title,
}: {
  action?: { label: string; targetId: string };
  description: string;
  title: string;
}) {
  return (
    <div className="membership-empty-state">
      <Mail aria-hidden="true" size={48} />
      <h3>{title}</h3>
      <p>{description}</p>
      {action ? (
        <button
          className="ghost-button"
          onClick={() => document.getElementById(action.targetId)?.scrollIntoView({ behavior: "smooth" })}
          type="button"
        >
          {action.label}
        </button>
      ) : null}
    </div>
  );
}

function Pagination({
  page,
  pageSize,
  totalCount,
  updateParam,
}: {
  page: number;
  pageSize: number;
  totalCount: number;
  updateParam: (key: string, value: string) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const pages = Array.from({ length: Math.min(totalPages, 3) }, (_, index) => index + 1);

  return (
    <div className="membership-pagination">
      <span>
        Page {page} of {totalPages}
      </span>
      <div>
        <button
          disabled={page <= 1}
          onClick={() => updateParam("page", String(page - 1))}
          type="button"
        >
          <ChevronLeft size={13} />
        </button>
        {pages.map((item) => (
          <button
            aria-current={item === page ? "page" : undefined}
            data-current={item === page}
            key={item}
            onClick={() => updateParam("page", String(item))}
            type="button"
          >
            {item}
          </button>
        ))}
        {totalPages > 4 ? <span>…</span> : null}
        {totalPages > 3 ? (
          <button
            aria-current={totalPages === page ? "page" : undefined}
            data-current={totalPages === page}
            onClick={() => updateParam("page", String(totalPages))}
            type="button"
          >
            {totalPages}
          </button>
        ) : null}
        <button
          disabled={page >= totalPages}
          onClick={() => updateParam("page", String(page + 1))}
          type="button"
        >
          <ChevronRight size={13} />
        </button>
      </div>
      <select
        aria-label="Rows per page"
        onChange={(event) => {
          updateParam("pageSize", event.target.value);
          updateParam("page", "1");
        }}
        value={String(pageSize)}
      >
        {[15, 20, 50].map((size) => (
          <option key={size} value={size}>
            {size} / page
          </option>
        ))}
      </select>
    </div>
  );
}

export function InvitationsWorkspaceClient({
  auditEvents,
  batches,
  cycles,
  deliveries,
  flash,
  invitations,
  metrics,
  page,
  pageSize,
  totalCount,
}: InvitationsWorkspaceClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [busyKey, setBusyKey] = useState("");
  const [feedback, setFeedback] = useState<ActionResult | null>(
    flash
      ? {
          code: flash.invitationCode,
          jnuitsId: flash.jnuitsId,
          message: flash.message,
          ok: flash.tone === "success",
        }
      : null
  );
  const [feedbackKey, setFeedbackKey] = useState("");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [menuState, setMenuState] = useState<{
    invitationId: string;
    left: number;
    top: number;
  } | null>(null);
  const [bulkConfirming, setBulkConfirming] = useState(false);
  const [directJnuitsId, setDirectJnuitsId] = useState("");
  const [directEmail, setDirectEmail] = useState("");
  const [directFullName, setDirectFullName] = useState("");
  const [directType, setDirectType] = useState<"alumni_direct" | "member_claim">("member_claim");
  const [directNote, setDirectNote] = useState("");
  const [batchLabel, setBatchLabel] = useState("");
  const [batchCycleId, setBatchCycleId] = useState("");
  const [batchSource, setBatchSource] = useState("renewal");
  const [batchStatus, setBatchStatus] = useState("draft");
  const [issueBatchId, setIssueBatchId] = useState("");
  const [onlyPendingRenewal, setOnlyPendingRenewal] = useState(true);
  const [csvContent, setCsvContent] = useState("");
  const [csvType, setCsvType] = useState<"alumni_direct" | "member_claim">("member_claim");
  const [csvPreview, setCsvPreview] = useState<Record<string, unknown> | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const selectedInvitation = invitations.find((invitation) => invitation.id === editingId) || null;
  const directFeedback = feedbackKey === "direct-invite" ? feedback : null;
  const csvCommitFeedback = feedbackKey === "csv-commit" ? feedback : null;
  const deliverySummary = {
    failed: deliveries.filter((delivery) => delivery.status === "failed").length,
    sent: deliveries.filter((delivery) => delivery.status === "sent").length,
    skipped: deliveries.filter((delivery) => delivery.status === "skipped").length,
  };

  const filteredInvitations = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return invitations;
    return invitations.filter((invitation) =>
      [
        invitation.memberName,
        invitation.displayJnuitsId,
        invitation.email,
        invitation.recipientEmailSnapshot,
        invitation.batchLabel,
        invitation.invitationType,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle))
    );
  }, [invitations, search]);

  const allVisibleSelected =
    filteredInvitations.length > 0 &&
    filteredInvitations.every((invitation) => selectedIds.has(invitation.id));

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (!value) {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    if (key !== "page") {
      params.set("page", "1");
    }
    router.push(`/admin/invitations?${params.toString()}`);
  }

  function runAction(key: string, action: () => Promise<ActionResult>) {
    setBusyKey(key);
    startTransition(() => {
      void action()
        .then((result) => {
          setFeedbackKey(key);
          setFeedback(result);
          if (result.ok) {
            router.refresh();
          }
        })
        .finally(() => setBusyKey(""));
    });
  }

  function toggleSelected(invitationId: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(invitationId)) {
        next.delete(invitationId);
      } else {
        next.add(invitationId);
      }
      return next;
    });
  }

  function openMenu(invitationId: string, event: MouseEvent<HTMLButtonElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    setMenuState({
      invitationId,
      left: Math.max(12, rect.right - 184),
      top: rect.bottom + 6,
    });
  }

  function copyText(value: string) {
    void navigator.clipboard.writeText(value);
    setFeedbackKey("copy");
    setFeedback({ ok: true, message: "Copied." });
  }

  return (
    <div className="membership-db invitation-workspace grid gap-8">
      <div className="admin-page-header">
        <div>
          <p className="admin-page-header__breadcrumb">Admin / Membership</p>
          <h1 className="admin-page-header__title">Invitations</h1>
          <p className="admin-page-header__desc">
            Dedicated control center for claim codes, direct invites, batch issuance, delivery status, replacements, and revocation.
          </p>
        </div>
        <span className="abadge abadge--active">
          <Mail size={10} /> {metrics.active} active
        </span>
      </div>

      {feedback ? (
        <section className="flash-panel" data-tone={actionTone(feedback)}>
          <p className="admin-section-label">Invitation feedback</p>
          <h2 className="mt-2 font-[family-name:var(--font-heading)] text-2xl font-semibold">
            {actionTitle(feedback)}
          </h2>
          <p className="mt-1 text-sm leading-7">{feedback.message}</p>
          {feedback.recipientEmail ? (
            <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-text-secondary)]">
              Recipient: {feedback.recipientEmail}
            </p>
          ) : null}
          {feedback.deliveryError ? (
            <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--brand-rust)]">
              Delivery provider returned an error. Use the delivery ledger to reissue or investigate.
            </p>
          ) : null}
          {feedback.code ? (
            <div className="invitation-code-reveal">
              <span>
                {feedback.jnuitsId ? `${feedback.jnuitsId} · ` : ""}
                {feedback.code}
              </span>
              <button onClick={() => copyText(feedback.code || "")} type="button">
                <Copy size={13} /> Copy code
              </button>
            </div>
          ) : null}
        </section>
      ) : null}

      <div className="admin-metric-grid invitation-metric-grid">
        <MetricCard icon={Mail} label="Active" sub="Not revoked, not expired" tone="info" value={metrics.active} />
        <MetricCard icon={Clock3} label="Expiring soon" sub="Within the next 72 hours" value={metrics.expiringSoon} />
        <MetricCard icon={Check} label="Claimed" sub="Used at least once" tone="success" value={metrics.claimed} />
        <MetricCard icon={ShieldAlert} label="Failed delivery" sub="Needs operator review" tone="warning" value={metrics.failedDelivery} />
        <MetricCard icon={Archive} label="Revoked / expired" sub="No longer usable" value={metrics.revokedOrExpired} />
        <div className="admin-metric-card" data-tone="info">
          <div className="admin-metric-card__icon">
            <RefreshCw size={16} />
          </div>
          <p className="admin-metric-card__label">Batch progress</p>
          <div className="membership-batch-stat">
            <div>
              <strong>{metrics.batchClaimed}</strong>
              <span>Claimed</span>
            </div>
            <i />
            <div>
              <strong>{metrics.batchIssued}</strong>
              <span>Issued</span>
            </div>
          </div>
          {metrics.batchIssued > 0 ? (
            <div className="membership-batch-progress" aria-hidden="true">
              <span
                style={{
                  width: `${Math.min(100, Math.round((metrics.batchClaimed / metrics.batchIssued) * 100))}%`,
                }}
              />
            </div>
          ) : null}
        </div>
      </div>

      <nav className="membership-sticky-nav invitation-sticky-nav" aria-label="Invitation workspace sections">
        {[
          ["Invitations", "invitations-table"],
          ["Issue", "issue"],
          ["Batches", "batches"],
          ["Delivery", "delivery"],
          ["History", "history"],
        ].map(([label, targetId], index) => (
          <button
            className={index === 0 ? "nav-tab tab-active" : "nav-tab"}
            key={targetId}
            onClick={() => document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth" })}
            type="button"
          >
            {label}
          </button>
        ))}
      </nav>

      <section className="section-band" id="invitations-table">
        <div className="membership-table-heading">
          <div>
            <span className="eyebrow">Invitation registry</span>
            <h2 className="mt-4 font-[family-name:var(--font-heading)] text-[clamp(2rem,3vw,2.7rem)] leading-[0.96] tracking-[-0.04em]">
              Claim codes and delivery state
            </h2>
          </div>
          <p>Click any row to inspect or replace the invitation.</p>
        </div>

        <div className="membership-table-toolbar">
          <div className="membership-table-search">
            <Search aria-hidden="true" size={14} />
            <input
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by member, ID, email, or batch"
              value={search}
            />
          </div>
          <select
            aria-label="Invitation status"
            onChange={(event) => updateParam("status", event.target.value)}
            value={searchParams.get("status") || ""}
          >
            <option value="">All statuses</option>
            {["active", "claimed", "expired", "revoked"].map((status) => (
              <option key={status} value={status}>
                {humanize(status)}
              </option>
            ))}
          </select>
          <select
            aria-label="Invitation type"
            onChange={(event) => updateParam("type", event.target.value)}
            value={searchParams.get("type") || ""}
          >
            <option value="">All types</option>
            {invitationTypeOptions.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
          <select
            aria-label="Delivery status"
            onChange={(event) => updateParam("delivery", event.target.value)}
            value={searchParams.get("delivery") || ""}
          >
            <option value="">All delivery</option>
            {["pending", "sent", "failed", "skipped", "claimed", "revoked", "expired"].map((status) => (
              <option key={status} value={status}>
                {humanize(status)}
              </option>
            ))}
          </select>
          <button
            className="ghost-button"
            onClick={() => {
              setSearch("");
              router.push("/admin/invitations");
            }}
            type="button"
          >
            Clear filters
          </button>
          <span className="membership-table-count">
            Showing {filteredInvitations.length} of {totalCount} invitations
          </span>
        </div>

        {selectedIds.size > 0 ? (
          <div className="membership-bulk-member-bar">
            <div className="membership-bulk-member-bar__summary">
              <Check size={14} />
              <strong>{selectedIds.size} selected</strong>
              <button
                className="admin-btn admin-btn--danger"
                disabled={busyKey === "bulk-revoke" || isPending}
                onClick={() => {
                  if (!bulkConfirming) {
                    setBulkConfirming(true);
                    window.setTimeout(() => setBulkConfirming(false), 5000);
                    return;
                  }
                  runAction("bulk-revoke", () =>
                    bulkRevokeInvitationsAction({
                      invitationIds: Array.from(selectedIds),
                      reason: "Bulk revoked from invitations workspace.",
                    }).then((result) => {
                      if (result.ok) setSelectedIds(new Set());
                      return result;
                    })
                  );
                }}
                type="button"
              >
                {busyKey === "bulk-revoke" ? <span className="membership-spinner" /> : bulkConfirming ? "Click again to confirm" : "Revoke selected"}
              </button>
            </div>
          </div>
        ) : null}

        <div className="membership-table-shell">
          {filteredInvitations.length === 0 ? (
            <EmptyPanel
              action={{ label: "Issue invitation", targetId: "issue" }}
              description="Create a direct invite or issue a renewal batch to populate this table."
              title="No invitations match this view"
            />
          ) : (
            <table className="membership-table invitation-table">
              <thead>
                <tr>
                  <th className="membership-table__checkbox">
                    <input
                      aria-label="Select all visible invitations"
                      checked={allVisibleSelected}
                      onChange={(event) => {
                        setSelectedIds((current) => {
                          const next = new Set(current);
                          for (const invitation of filteredInvitations) {
                            if (event.target.checked) next.add(invitation.id);
                            else next.delete(invitation.id);
                          }
                          return next;
                        });
                      }}
                      type="checkbox"
                    />
                  </th>
                  <th>Recipient</th>
                  <th>Status</th>
                  <th>Type</th>
                  <th>Batch</th>
                  <th>Expires / use</th>
                  <th>Delivery</th>
                  <th className="membership-table__actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvitations.map((invitation) => {
                  const status = invitationStatus(invitation);
                  return (
                    <tr
                      className="membership-table-row"
                      data-editing={editingId === invitation.id}
                      data-selected={selectedIds.has(invitation.id)}
                      key={invitation.id}
                      onClick={() => setEditingId(invitation.id)}
                    >
                      <td className="membership-table__checkbox" data-label="Select" onClick={(event) => event.stopPropagation()}>
                        <input
                          aria-label={`Select ${invitation.memberName}`}
                          checked={selectedIds.has(invitation.id)}
                          onChange={() => toggleSelected(invitation.id)}
                          type="checkbox"
                        />
                      </td>
                      <td data-label="Recipient">
                        <div className="membership-table-member">
                          <span className="membership-table-avatar" data-tone={avatarTone(invitation.id)}>
                            {initials(invitation.memberName)}
                          </span>
                          <span>
                            <strong>{invitation.memberName}</strong>
                            <small>
                              {invitation.displayJnuitsId} · {invitation.email || invitation.recipientEmailSnapshot || "No email"}
                            </small>
                          </span>
                        </div>
                      </td>
                      <td data-label="Status">
                        <Badge kind="lifecycle" value={status} />
                      </td>
                      <td data-label="Type">{humanize(invitation.invitationType)}</td>
                      <td className="membership-table__cycle" data-label="Batch">{invitation.batchLabel || "Direct"}</td>
                      <td className="membership-table__cycle" data-label="Expires / use">
                        {formatDate(invitation.expiresAt)} · {invitation.usedCount}/{invitation.maxUses}
                      </td>
                      <td data-label="Delivery">
                        <Badge kind="access" value={invitation.deliveryStatus || "pending"} />
                      </td>
                      <td className="membership-table__actions" data-label="Actions" onClick={(event) => event.stopPropagation()}>
                        <div className="membership-row-actions">
                          <button
                            aria-label={`View ${invitation.memberName}`}
                            onClick={() => setEditingId(invitation.id)}
                            title="View invitation"
                            type="button"
                          >
                            <Eye size={13} />
                          </button>
                          <button
                            aria-label={`Reissue invitation for ${invitation.memberName}`}
                            onClick={() =>
                              runAction(`reissue-${invitation.id}`, () =>
                                reissueInvitationAction({
                                  expiresInDays: 14,
                                  invitationId: invitation.id,
                                  maxUses: Math.max(1, invitation.maxUses),
                                  reason: "Replacement issued from row action.",
                                })
                              )
                            }
                            title="Issue replacement"
                            type="button"
                          >
                            {busyKey === `reissue-${invitation.id}` ? <span className="membership-spinner" /> : <RefreshCw size={13} />}
                          </button>
                          <div className="membership-row-menu-wrap">
                            <button
                              aria-label={`More actions for ${invitation.memberName}`}
                              onClick={(event) => openMenu(invitation.id, event)}
                              title="More actions"
                              type="button"
                            >
                              <Ellipsis size={13} />
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <Pagination page={page} pageSize={pageSize} totalCount={totalCount} updateParam={updateParam} />

        {selectedInvitation ? (
          <section className="membership-inline-editor" aria-label="Invitation detail panel">
            <div className="membership-inline-editor__header">
              <div>
                <strong>{selectedInvitation.memberName}</strong>
                <small>
                  {selectedInvitation.displayJnuitsId} · {selectedInvitation.email || selectedInvitation.recipientEmailSnapshot || "No email"}
                </small>
              </div>
              <button className="ghost-button" onClick={() => setEditingId(null)} type="button">
                <X size={13} /> Close
              </button>
            </div>
            <div className="membership-inline-editor__body invitation-detail-grid">
              <label>
                Status
                <span>{humanize(invitationStatus(selectedInvitation))}</span>
              </label>
              <label>
                Type
                <span>{humanize(selectedInvitation.invitationType)}</span>
              </label>
              <label>
                Delivery
                <span>{humanize(selectedInvitation.deliveryStatus)}</span>
              </label>
              <label>
                Batch
                <span>{selectedInvitation.batchLabel || "Direct invitation"}</span>
              </label>
              <label>
                Created
                <span>{formatDateTime(selectedInvitation.createdAt)}</span>
              </label>
              <label>
                Last sent
                <span>{formatDateTime(selectedInvitation.lastSentAt)}</span>
              </label>
              <label className="membership-inline-editor__wide">
                Operator note
                <span>{selectedInvitation.notes || "No note recorded."}</span>
              </label>
              <label>
                Revocation reason
                <span>{selectedInvitation.revocationReason || "—"}</span>
              </label>
            </div>
            <div className="membership-inline-editor__footer">
              <div>
                <button
                  className="primary-button"
                  disabled={busyKey === `detail-reissue-${selectedInvitation.id}`}
                  onClick={() =>
                    runAction(`detail-reissue-${selectedInvitation.id}`, () =>
                      reissueInvitationAction({
                        expiresInDays: 14,
                        invitationId: selectedInvitation.id,
                        maxUses: Math.max(1, selectedInvitation.maxUses),
                        reason: "Replacement issued from invitation detail panel.",
                      })
                    )
                  }
                  type="button"
                >
                  {busyKey === `detail-reissue-${selectedInvitation.id}` ? <span className="membership-spinner" /> : "Issue replacement"}
                </button>
                <button
                  className="ghost-button"
                  onClick={() => copyText(selectedInvitation.displayJnuitsId)}
                  type="button"
                >
                  <Copy size={13} /> Copy member ID
                </button>
              </div>
              <button
                className="admin-btn admin-btn--danger"
                disabled={busyKey === `detail-revoke-${selectedInvitation.id}`}
                onClick={() =>
                  runAction(`detail-revoke-${selectedInvitation.id}`, () =>
                    revokeInvitationAction({
                      invitationId: selectedInvitation.id,
                      reason: "Revoked from invitation detail panel.",
                    })
                  )
                }
                type="button"
              >
                Revoke invitation
              </button>
            </div>
          </section>
        ) : null}
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]" id="issue">
        <form
          className="section-band grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            runAction("direct-invite", () =>
              issueDirectInvitationAction({
                invitationType: directType,
                maxUses: 1,
                expiresInDays: 14,
                email: directEmail,
                fullName: directFullName,
                jnuitsId: directJnuitsId,
                note: directNote,
              })
            );
          }}
        >
          <div>
            <span className="eyebrow">Direct issue</span>
            <h2 className="mt-4 font-[family-name:var(--font-heading)] text-[clamp(2rem,3vw,2.6rem)] leading-[0.96] tracking-[-0.04em]">
              Invite member or alumni
            </h2>
          </div>
          <div className="portal-form-grid">
            <label className="input-label" htmlFor="direct-invite-jnuits-id">
              JnUITS ID
              <input
                id="direct-invite-jnuits-id"
                onChange={(event) => setDirectJnuitsId(event.target.value)}
                pattern="[Jj][Nn][Uu][Ii][Tt][Ss]-[0-9]{7}|[0-9]{7}"
                placeholder="JnUITS-2026001"
                required
                title="Use JnUITS-2026001 or 2026001."
                value={directJnuitsId}
              />
            </label>
            <label className="input-label" htmlFor="direct-invite-email">
              Email ID
              <input
                id="direct-invite-email"
                onChange={(event) => setDirectEmail(event.target.value)}
                placeholder="member@example.com"
                required
                type="email"
                value={directEmail}
              />
            </label>
            <label className="input-label" htmlFor="direct-invite-full-name">
              Full name
              <input
                id="direct-invite-full-name"
                onChange={(event) => setDirectFullName(event.target.value)}
                placeholder="Member full name"
                required
                value={directFullName}
              />
            </label>
            <label className="input-label" htmlFor="direct-invite-type">
              Invite type
              <select
                id="direct-invite-type"
                onChange={(event) => setDirectType(event.target.value as "alumni_direct" | "member_claim")}
                value={directType}
              >
                <option value="member_claim">Member claim</option>
                <option value="alumni_direct">Alumni direct</option>
              </select>
            </label>
          </div>
          <div className="portal-form-grid">
            <label className="input-label" htmlFor="direct-invite-note">
              Operator note
              <input
                id="direct-invite-note"
                onChange={(event) => setDirectNote(event.target.value)}
                placeholder="Reason or source"
                value={directNote}
              />
            </label>
          </div>
          <button className="primary-button" disabled={busyKey === "direct-invite"} type="submit">
            {busyKey === "direct-invite" ? <span className="membership-spinner" /> : "Issue direct invitation"}
          </button>
          {directFeedback ? <ActionFeedback result={directFeedback} /> : null}
        </form>

        <form
          className="section-band grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            runAction("csv-commit", () =>
              commitCsvInvitationsAction({
                csvContent,
                expiresInDays: 14,
                invitationType: csvType,
                maxUses: 1,
                note: "CSV invitation import",
              })
            );
          }}
        >
          <div>
            <span className="eyebrow">CSV preview and commit</span>
            <h2 className="mt-4 font-[family-name:var(--font-heading)] text-[clamp(2rem,3vw,2.6rem)] leading-[0.96] tracking-[-0.04em]">
              Bulk invite records
            </h2>
          </div>
          <label className="input-label" htmlFor="csv-invite-type">
            Invite type
            <select
              id="csv-invite-type"
              onChange={(event) => {
                setCsvType(event.target.value as "alumni_direct" | "member_claim");
                setCsvPreview(null);
              }}
              value={csvType}
            >
              <option value="member_claim">Member claim</option>
              <option value="alumni_direct">Alumni direct</option>
            </select>
          </label>
          <label className="input-label" htmlFor="csv-content">
            CSV content
            <textarea
              id="csv-content"
              onChange={(event) => {
                setCsvContent(event.target.value);
                setCsvPreview(null);
              }}
              placeholder="jnuits_id,email,full_name&#10;JNUITS-2026001,member@example.com,Member full name"
              rows={7}
              value={csvContent}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              className="ghost-button"
              disabled={busyKey === "csv-preview" || !csvContent.trim()}
              onClick={() =>
                runAction("csv-preview", () =>
                  previewCsvInvitationsAction({
                    csvContent,
                    invitationType: csvType,
                  }).then((result) => {
                    if (result.ok) setCsvPreview(result.details || null);
                    return result;
                  })
                )
              }
              type="button"
            >
              {busyKey === "csv-preview" ? <span className="membership-spinner" /> : "Preview CSV"}
            </button>
            <button className="primary-button w-auto" disabled={busyKey === "csv-commit" || !csvContent.trim()} type="submit">
              {busyKey === "csv-commit" ? <span className="membership-spinner" /> : "Commit invitations"}
            </button>
          </div>
          {csvPreview ? (
            <p className="text-sm text-[var(--color-text-secondary)]">
              Ready {String(csvPreview.ready || 0)} · Blocked {String(csvPreview.blocked || 0)}
            </p>
          ) : null}
          {csvCommitFeedback ? <ActionFeedback result={csvCommitFeedback} /> : null}
        </form>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]" id="batches">
        <form
          className="section-band grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            runAction("create-batch", () =>
              createInvitationBatchAction({
                cycleId: batchCycleId,
                label: batchLabel,
                source: batchSource,
                status: batchStatus,
              })
            );
          }}
        >
          <div>
            <span className="eyebrow">Invitation batches</span>
            <h2 className="mt-4 font-[family-name:var(--font-heading)] text-[clamp(2rem,3vw,2.6rem)] leading-[0.96] tracking-[-0.04em]">
              Create invitation batch
            </h2>
          </div>
          <label className="input-label" htmlFor="batch-label">
            Label
            <input
              id="batch-label"
              onChange={(event) => setBatchLabel(event.target.value)}
              placeholder="Renewal outreach batch A"
              required
              value={batchLabel}
            />
          </label>
          <div className="portal-form-grid">
            <label className="input-label" htmlFor="batch-cycle">
              Linked cycle
              <select id="batch-cycle" onChange={(event) => setBatchCycleId(event.target.value)} value={batchCycleId}>
                <option value="">No cycle link</option>
                {cycles.map((cycle) => (
                  <option key={cycle.id} value={cycle.id}>
                    {cycle.code} · {cycle.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="input-label" htmlFor="batch-source">
              Source
              <select id="batch-source" onChange={(event) => setBatchSource(event.target.value)} value={batchSource}>
                <option value="manual">Manual</option>
                <option value="csv_onboarding">CSV onboarding</option>
                <option value="reconciliation">Reconciliation</option>
                <option value="renewal">Renewal</option>
              </select>
            </label>
            <label className="input-label" htmlFor="batch-status">
              Status
              <select id="batch-status" onChange={(event) => setBatchStatus(event.target.value)} value={batchStatus}>
                {batchStatuses.map((status) => (
                  <option key={status} value={status}>
                    {humanize(status)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button className="primary-button" disabled={busyKey === "create-batch"} type="submit">
            {busyKey === "create-batch" ? <span className="membership-spinner" /> : "Save batch"}
          </button>
        </form>

        <form
          className="section-band grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            runAction("issue-batch", () =>
              issueInvitationsFromBatchAction({
                batchId: issueBatchId,
                expiresInDays: 14,
                maxUses: 1,
                onlyPendingRenewal,
              })
            );
          }}
        >
          <div>
            <span className="eyebrow">Renewal queue issue</span>
            <h2 className="mt-4 font-[family-name:var(--font-heading)] text-[clamp(2rem,3vw,2.6rem)] leading-[0.96] tracking-[-0.04em]">
              Issue invitations from cycle queue
            </h2>
          </div>
          <label className="input-label" htmlFor="issue-batch">
            Batch
            <select
              id="issue-batch"
              onChange={(event) => setIssueBatchId(event.target.value)}
              required
              value={issueBatchId}
            >
              <option value="">Select batch</option>
              {batches.map((batch) => (
                <option key={batch.id} value={batch.id}>
                  {batch.label} ({batch.status})
                </option>
              ))}
            </select>
          </label>
          <label className="toggle-label" htmlFor="only-pending-renewal">
            <input
              checked={onlyPendingRenewal}
              className="toggle-input"
              id="only-pending-renewal"
              onChange={(event) => setOnlyPendingRenewal(event.target.checked)}
              type="checkbox"
            />
            <span className="toggle-track" aria-hidden="true">
              <span className="toggle-thumb" />
            </span>
            <span className="toggle-text">Pending renewal members only</span>
          </label>
          <button className="primary-button" disabled={busyKey === "issue-batch" || !issueBatchId} type="submit">
            {busyKey === "issue-batch" ? <span className="membership-spinner" /> : "Issue invitations"}
          </button>
        </form>

        <section className="section-band xl:col-span-2">
          <div className="membership-table-heading">
            <div>
              <span className="eyebrow">Batch registry</span>
              <h2 className="mt-4 font-[family-name:var(--font-heading)] text-[clamp(2rem,3vw,2.6rem)] leading-[0.96] tracking-[-0.04em]">
                Batch progress and sync controls
              </h2>
            </div>
          </div>
          <div className="grid gap-3">
            {batches.length === 0 ? (
              <EmptyPanel
                action={{ label: "Create batch", targetId: "batches" }}
                description="Create a batch above and it will appear here."
                title="No invitation batches yet"
              />
            ) : (
              batches.map((batch) => {
                const percent = batch.issuedCount > 0 ? Math.round((batch.claimedCount / batch.issuedCount) * 100) : 0;
                return (
                  <article className="invitation-batch-row" key={batch.id}>
                    <div>
                      <h3>{batch.label}</h3>
                      <p>
                        {batch.source} · {batch.status} · {batch.cycleLabel || "No cycle link"}
                      </p>
                    </div>
                    <div className="invitation-batch-row__progress">
                      <span>
                        {batch.claimedCount}/{batch.issuedCount} claimed · {batch.failedCount} failed
                      </span>
                      <i>
                        <b style={{ width: `${Math.min(100, percent)}%` }} />
                      </i>
                    </div>
                    <div className="membership-row-actions">
                      <button
                        aria-label={`Sync ${batch.label}`}
                        onClick={() => runAction(`sync-${batch.id}`, () => syncInvitationBatchMetricsAction({ batchId: batch.id }))}
                        title="Sync metrics"
                        type="button"
                      >
                        {busyKey === `sync-${batch.id}` ? <span className="membership-spinner" /> : <RefreshCw size={13} />}
                      </button>
                      {batchStatuses.map((status) => (
                        <button
                          aria-label={`Mark ${batch.label} ${status}`}
                          key={status}
                          onClick={() =>
                            runAction(`batch-${batch.id}-${status}`, () =>
                              updateInvitationBatchStatusAction({
                                batchId: batch.id,
                                nextStatus: status,
                              })
                            )
                          }
                          title={`Mark ${status}`}
                          type="button"
                        >
                          {status[0].toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </section>
      </section>

      <section className="section-band" id="delivery">
        <div>
          <span className="eyebrow">Delivery ledger</span>
          <h2 className="mt-4 font-[family-name:var(--font-heading)] text-[clamp(2rem,3vw,2.6rem)] leading-[0.96] tracking-[-0.04em]">
            Recent email delivery attempts
          </h2>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="admin-metric-card" data-tone="success">
            <p className="admin-metric-card__label">Sent</p>
            <p className="admin-metric-card__value">{deliverySummary.sent}</p>
            <p className="admin-metric-card__sub">Recent successful attempts</p>
          </div>
          <div className="admin-metric-card" data-tone="warning">
            <p className="admin-metric-card__label">Failed</p>
            <p className="admin-metric-card__value">{deliverySummary.failed}</p>
            <p className="admin-metric-card__sub">Needs resend or reissue</p>
          </div>
          <div className="admin-metric-card">
            <p className="admin-metric-card__label">Skipped</p>
            <p className="admin-metric-card__value">{deliverySummary.skipped}</p>
            <p className="admin-metric-card__sub">No deliverable address</p>
          </div>
        </div>
        <div className="mt-5 grid gap-3">
          {deliveries.length === 0 ? (
            <EmptyPanel
              description="Email attempts will appear here after invitations are issued."
              title="No delivery attempts recorded"
            />
          ) : (
            deliveries.map((delivery) => (
              <article className="route-tile" key={delivery.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3>{delivery.recipientEmail}</h3>
                    <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
                      {formatDateTime(delivery.createdAt)} · {delivery.providerMessageId || "No provider ID"}
                    </p>
                    {delivery.errorMessage ? (
                      <p className="mt-2 text-sm text-[var(--brand-rust)]">Provider reported a delivery failure. Reissue the invitation if the address is correct.</p>
                    ) : null}
                  </div>
                  <Badge kind="access" value={delivery.status} />
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      <section className="section-band" id="history">
        <div>
          <span className="eyebrow">Audit history</span>
          <h2 className="mt-4 font-[family-name:var(--font-heading)] text-[clamp(2rem,3vw,2.6rem)] leading-[0.96] tracking-[-0.04em]">
            Invitation operations history
          </h2>
        </div>
        <div className="grid gap-3">
          {auditEvents.length === 0 ? (
            <EmptyPanel description="Invitation audit events will appear here after operators take action." title="No invitation audit events yet" />
          ) : (
            auditEvents.map((event) => (
              <article className="route-tile" key={event.id}>
                <h3>{humanize(event.action.replace(/^membership\./, ""))}</h3>
                <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
                  {formatDateTime(event.createdAt)} · {event.entityType}
                  {event.entityId ? ` · ${event.entityId}` : ""}
                </p>
              </article>
            ))
          )}
        </div>
      </section>

      {menuState ? (
        <>
          <button
            aria-label="Close action menu"
            className="invitation-menu-backdrop"
            onClick={() => setMenuState(null)}
            type="button"
          />
          <div
            className="membership-row-menu"
            ref={menuRef}
            style={{ left: menuState.left, top: menuState.top }}
          >
            <button
              onClick={() => {
                setEditingId(menuState.invitationId);
                setMenuState(null);
              }}
              type="button"
            >
              <Eye size={13} /> View details
            </button>
            <button
              onClick={() => {
                const invitation = invitations.find((item) => item.id === menuState.invitationId);
                if (invitation) copyText(invitation.displayJnuitsId);
                setMenuState(null);
              }}
              type="button"
            >
              <Copy size={13} /> Copy member ID
            </button>
            <button
              onClick={() => {
                runAction(`menu-reissue-${menuState.invitationId}`, () =>
                  reissueInvitationAction({
                    expiresInDays: 14,
                    invitationId: menuState.invitationId,
                    maxUses: 1,
                    reason: "Replacement issued from action menu.",
                  })
                );
                setMenuState(null);
              }}
              type="button"
            >
              <RefreshCw size={13} /> Issue replacement
            </button>
            <button
              className="membership-row-menu__danger"
              onClick={() => {
                runAction(`menu-revoke-${menuState.invitationId}`, () =>
                  revokeInvitationAction({
                    invitationId: menuState.invitationId,
                    reason: "Revoked from action menu.",
                  })
                );
                setMenuState(null);
              }}
              type="button"
            >
              <X size={13} /> Revoke invitation
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
