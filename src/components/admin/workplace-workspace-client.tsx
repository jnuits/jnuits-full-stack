"use client";

import {
  BriefcaseBusiness,
  Check,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Copy,
  Edit3,
  Ellipsis,
  Eye,
  FileClock,
  Globe2,
  History,
  Lock,
  Search,
  Settings2,
  ShieldCheck,
  X,
  XCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { MouseEvent } from "react";
import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import {
  bulkReviewWorkplaceRequestsAction,
  reviewWorkplaceRequestAction,
  updateMemberWorkplaceAction,
} from "@/app/admin/workplace/actions";

type ActionResult = {
  message: string;
  ok: boolean;
};

const DEFAULT_DESIGNATION = "Student";

export type WorkplaceRequestRow = {
  currentOrganization: null | string;
  designation: null | string;
  displayJnuitsId: string;
  email: null | string;
  facebookUrl: null | string;
  fullName: string;
  id: string;
  memberId: string;
  memberType: null | string;
  payload: {
    currentOrganization?: string;
    designation?: string;
    facebookUrl?: string;
    linkedinUrl?: string;
    professionalVisibility?: string;
    websiteUrl?: string;
    workLocation?: string;
  };
  professionalVisibility: null | string;
  requestedAt: string;
  reviewNote: null | string;
  reviewedAt: null | string;
  status: string;
  linkedinUrl: null | string;
  websiteUrl: null | string;
  workLocation: null | string;
};

export type WorkplaceDirectoryMember = {
  currentOrganization: null | string;
  designation: null | string;
  displayJnuitsId: string;
  email: null | string;
  facebookUrl: null | string;
  fullName: string;
  id: string;
  lifecycleStatus: null | string;
  linkedinUrl: null | string;
  portalAccessStatus: null | string;
  professionalVisibility: null | string;
  updatedAt: null | string;
  websiteUrl: null | string;
  workLocation: null | string;
};

export type WorkplaceMetrics = {
  approvedRecent: number;
  pending: number;
  privateProfiles: number;
  publicProfiles: number;
  rejectedRecent: number;
  staleProfiles: number;
};

type WorkplaceWorkspaceClientProps = {
  directoryMembers: WorkplaceDirectoryMember[];
  historyRows: WorkplaceRequestRow[];
  metrics: WorkplaceMetrics;
  page: number;
  pageSize: number;
  requests: WorkplaceRequestRow[];
  totalCount: number;
};

function humanize(value: null | string | undefined) {
  if (!value) return "Not set";
  return value
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function displayDesignation(value: null | string | undefined) {
  return value?.trim() || DEFAULT_DESIGNATION;
}

function formatDate(value: null | string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-BD", {
    dateStyle: "medium",
  }).format(new Date(value));
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return `${parts[0]?.[0] || "J"}${parts.at(-1)?.[0] || "S"}`.toUpperCase();
}

function avatarTone(id: string) {
  const tail = id.replace(/[^a-fA-F0-9]/g, "").slice(-2) || "0";
  return String(Number.parseInt(tail, 16) % 4);
}

function statusTone(status: string) {
  if (status === "approved" || status === "public") return "success";
  if (status === "rejected" || status === "private") return "danger";
  if (status === "pending" || status === "members-only") return "pending";
  if (status === "cancelled") return "inactive";
  return "active";
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
  value: number;
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

function Badge({
  kind,
  value,
}: {
  kind: "access" | "lifecycle";
  value: string;
}) {
  return (
    <span className="membership-table-badge" data-kind={kind} data-value={value}>
      {humanize(value)}
    </span>
  );
}

function RequestStatusBadge({ status }: { status: string }) {
  return <span className={`abadge abadge--${statusTone(status)}`}>{humanize(status)}</span>;
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
      <BriefcaseBusiness aria-hidden="true" size={48} />
      <h3>{title}</h3>
      <p>{description}</p>
      {action ? (
        <button
          className="ghost-button"
          onClick={() =>
            document.getElementById(action.targetId)?.scrollIntoView({
              behavior: "smooth",
            })
          }
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

function payloadSummary(row: WorkplaceRequestRow) {
  const parts = [
    row.payload.currentOrganization,
    row.payload.designation,
    row.payload.workLocation,
  ].filter(Boolean);
  if (parts.length > 0) return parts.join(" · ");

  const socialParts = [
    row.payload.facebookUrl ? "Facebook URL" : null,
    row.payload.linkedinUrl ? "LinkedIn URL" : null,
    row.payload.websiteUrl ? "Website URL" : null,
  ].filter(Boolean);

  return socialParts.length > 0 ? socialParts.join(" · ") : "No visible workplace fields";
}

function currentSummary(row: WorkplaceRequestRow | WorkplaceDirectoryMember) {
  const parts = [
    row.currentOrganization,
    displayDesignation(row.designation),
    row.workLocation,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : "No workplace data";
}

export function WorkplaceWorkspaceClient({
  directoryMembers,
  historyRows,
  metrics,
  page,
  pageSize,
  requests,
  totalCount,
}: WorkplaceWorkspaceClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [busyKey, setBusyKey] = useState("");
  const [feedback, setFeedback] = useState<ActionResult | null>(null);
  const [search, setSearch] = useState("");
  const [directorySearch, setDirectorySearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingRequestId, setEditingRequestId] = useState<string | null>(null);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [bulkMode, setBulkMode] = useState<"approved" | "rejected" | null>(null);
  const [bulkNote, setBulkNote] = useState("");
  const [menuState, setMenuState] = useState<{
    left: number;
    requestId: string;
    top: number;
  } | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const selectedRequest = requests.find((request) => request.id === editingRequestId) || null;
  const selectedMember = directoryMembers.find((member) => member.id === editingMemberId) || null;
  const filteredRequests = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return requests;
    return requests.filter((request) =>
      [
        request.fullName,
        request.displayJnuitsId,
        request.email,
        request.facebookUrl,
        request.linkedinUrl,
        request.websiteUrl,
        request.payload.facebookUrl,
        request.payload.linkedinUrl,
        request.payload.websiteUrl,
        payloadSummary(request),
        currentSummary(request),
        request.status,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle))
    );
  }, [requests, search]);
  const filteredDirectory = useMemo(() => {
    const needle = directorySearch.trim().toLowerCase();
    if (!needle) return directoryMembers;
    return directoryMembers.filter((member) =>
      [
        member.fullName,
        member.displayJnuitsId,
        member.email,
        member.currentOrganization,
        displayDesignation(member.designation),
        member.facebookUrl,
        member.linkedinUrl,
        member.websiteUrl,
        member.workLocation,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle))
    );
  }, [directoryMembers, directorySearch]);
  const allVisibleSelected =
    filteredRequests.length > 0 &&
    filteredRequests.every((request) => selectedIds.has(request.id));

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
    router.push(`/admin/workplace?${params.toString()}`);
  }

  function runAction(key: string, action: () => Promise<ActionResult>) {
    setBusyKey(key);
    startTransition(() => {
      void action()
        .then((result) => {
          setFeedback(result);
          if (result.ok) {
            setSelectedIds(new Set());
            setBulkMode(null);
            setEditingRequestId(null);
            setEditingMemberId(null);
            router.refresh();
          }
        })
        .finally(() => setBusyKey(""));
    });
  }

  function toggleSelected(requestId: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(requestId)) {
        next.delete(requestId);
      } else {
        next.add(requestId);
      }
      return next;
    });
  }

  function openMenu(requestId: string, event: MouseEvent<HTMLButtonElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    setMenuState({
      left: Math.max(12, rect.right - 190),
      requestId,
      top: rect.bottom + 6,
    });
  }

  function copyText(value: string) {
    void navigator.clipboard.writeText(value);
    setFeedback({ ok: true, message: "Copied." });
  }

  return (
    <div className="membership-db workplace-workspace grid gap-8">
      <div className="admin-page-header">
        <div>
          <p className="admin-page-header__breadcrumb">Admin / Membership</p>
          <h1 className="admin-page-header__title">Workplace Requests</h1>
          <p className="admin-page-header__desc">
            Dedicated control center for workplace requests, direct corrections,
            visibility posture, and audit history.
          </p>
        </div>
        <span className="abadge abadge--pending">
          <Clock3 size={10} /> {metrics.pending} pending
        </span>
      </div>

      {feedback ? (
        <section className="flash-panel" data-tone={feedback.ok ? "success" : "error"}>
          <p className="admin-section-label">Workplace feedback</p>
          <h2 className="mt-2 font-[family-name:var(--font-heading)] text-2xl font-semibold">
            {feedback.ok ? "Action completed" : "Action failed"}
          </h2>
          <p className="mt-1 text-sm leading-7">{feedback.message}</p>
        </section>
      ) : null}

      <div className="admin-metric-grid workplace-metric-grid">
        <MetricCard icon={Clock3} label="Pending requests" sub="Await review" tone="warning" value={metrics.pending} />
        <MetricCard icon={CheckCircle} label="Approved recent" sub="Latest decisions" tone="success" value={metrics.approvedRecent} />
        <MetricCard icon={XCircle} label="Rejected recent" sub="Latest decisions" tone="danger" value={metrics.rejectedRecent} />
        <MetricCard icon={BriefcaseBusiness} label="Public profiles" sub="Visible on directory" tone="info" value={metrics.publicProfiles} />
        <MetricCard icon={Lock} label="Private profiles" sub="Private or members-only" value={metrics.privateProfiles} />
        <MetricCard icon={ShieldCheck} label="Stale profiles" sub="Older than one year" tone="warning" value={metrics.staleProfiles} />
      </div>

      <nav className="membership-sticky-nav workplace-sticky-nav" aria-label="Workplace workspace sections">
        {[
          ["Requests", "workplace-requests"],
          ["Directory", "workplace-directory"],
          ["Review History", "workplace-history"],
          ["Settings / Guidance", "workplace-guidance"],
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

      <section className="section-band" id="workplace-requests">
        <div className="membership-table-heading">
          <div>
            <span className="eyebrow">Workplace request queue</span>
            <h2 className="mt-4 font-[family-name:var(--font-heading)] text-[clamp(2rem,3vw,2.7rem)] leading-[0.96] tracking-[-0.04em]">
              Requests and review decisions
            </h2>
          </div>
          <p>Click any row to compare requested and current workplace data.</p>
        </div>

        <div className="membership-table-toolbar">
          <div className="membership-table-search">
            <Search aria-hidden="true" size={14} />
            <input
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by member, ID, email, or workplace"
              value={search}
            />
          </div>
          <select
            aria-label="Request status"
            onChange={(event) => updateParam("status", event.target.value)}
            value={searchParams.get("status") || "pending"}
          >
            <option value="">All statuses</option>
            {["pending", "approved", "rejected", "cancelled"].map((status) => (
              <option key={status} value={status}>
                {humanize(status)}
              </option>
            ))}
          </select>
          <button
            className="ghost-button"
            onClick={() => {
              setSearch("");
              router.push("/admin/workplace");
            }}
            type="button"
          >
            Clear filters
          </button>
          <span className="membership-table-count">
            Showing {filteredRequests.length} of {totalCount} requests
          </span>
        </div>

        {selectedIds.size > 0 ? (
          <div className="membership-bulk-member-bar">
            <div className="membership-bulk-member-bar__summary">
              <Check size={14} />
              <strong>{selectedIds.size} selected</strong>
              <button
                className="admin-btn admin-btn--success"
                onClick={() => setBulkMode("approved")}
                type="button"
              >
                Approve selected
              </button>
              <button
                className="admin-btn admin-btn--danger"
                onClick={() => setBulkMode("rejected")}
                type="button"
              >
                Reject selected
              </button>
            </div>
            {bulkMode ? (
              <div className="membership-bulk-member-bar__form">
                <textarea
                  aria-label="Bulk review note"
                  onChange={(event) => setBulkNote(event.target.value)}
                  placeholder={`Reason for ${bulkMode === "approved" ? "approval" : "rejection"}`}
                  value={bulkNote}
                />
                <button
                  className={bulkMode === "approved" ? "admin-btn admin-btn--success" : "admin-btn admin-btn--danger"}
                  disabled={busyKey === "bulk-review" || isPending}
                  onClick={() =>
                    runAction("bulk-review", () =>
                      bulkReviewWorkplaceRequestsAction({
                        decision: bulkMode,
                        requestIds: Array.from(selectedIds),
                        reviewNote: bulkNote,
                      })
                    )
                  }
                  type="button"
                >
                  {busyKey === "bulk-review" ? <span className="membership-spinner" /> : "Confirm bulk review"}
                </button>
                <button className="ghost-button" onClick={() => setBulkMode(null)} type="button">
                  Cancel
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        {filteredRequests.length === 0 ? (
          <EmptyPanel
            action={{ label: "Open workplace directory", targetId: "workplace-directory" }}
            description="Pending requests will appear here when members submit workplace updates from the portal."
            title="No workplace requests in this view"
          />
        ) : (
          <div className="membership-table-shell">
            <table className="membership-table workplace-table">
              <thead>
                <tr>
                  <th className="membership-table__checkbox">
                    <input
                      aria-label="Select visible workplace requests"
                      checked={allVisibleSelected}
                      onChange={() => {
                        setSelectedIds((current) => {
                          const next = new Set(current);
                          if (allVisibleSelected) {
                            filteredRequests.forEach((request) => next.delete(request.id));
                          } else {
                            filteredRequests.forEach((request) => next.add(request.id));
                          }
                          return next;
                        });
                      }}
                      type="checkbox"
                    />
                  </th>
                  <th>Member</th>
                  <th>Requested</th>
                  <th>Current</th>
                  <th>Visibility</th>
                  <th>Submitted</th>
                  <th>Status</th>
                  <th className="membership-table__actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRequests.map((request) => (
                  <tr
                    className="membership-table-row"
                    data-editing={editingRequestId === request.id}
                    data-selected={selectedIds.has(request.id)}
                    key={request.id}
                    onClick={() => setEditingRequestId(request.id)}
                  >
                    <td className="membership-table__checkbox">
                      <input
                        aria-label={`Select ${request.fullName}'s workplace request`}
                        checked={selectedIds.has(request.id)}
                        onChange={(event) => {
                          event.stopPropagation();
                          toggleSelected(request.id);
                        }}
                        onClick={(event) => event.stopPropagation()}
                        type="checkbox"
                      />
                    </td>
                    <td>
                      <div className="membership-table-member">
                        <span className="membership-table-avatar" data-tone={avatarTone(request.memberId)}>
                          {initials(request.fullName)}
                        </span>
                        <span>
                          <strong>{request.fullName}</strong>
                          <small>
                            {request.displayJnuitsId} · {request.email || "No email"}
                          </small>
                        </span>
                      </div>
                    </td>
                    <td>{payloadSummary(request)}</td>
                    <td>{currentSummary(request)}</td>
                    <td>
                      <RequestStatusBadge status={request.payload.professionalVisibility || request.professionalVisibility || "members-only"} />
                    </td>
                    <td>{formatDate(request.requestedAt)}</td>
                    <td>
                      <RequestStatusBadge status={request.status} />
                    </td>
                    <td className="membership-table__actions" onClick={(event) => event.stopPropagation()}>
                      <div className="membership-row-actions">
                        <button
                          aria-label={`Review ${request.fullName}'s workplace request`}
                          onClick={() => setEditingRequestId(request.id)}
                          title="Review request"
                          type="button"
                        >
                          <Eye size={13} />
                        </button>
                        <button
                          aria-label={`Copy ${request.fullName}'s member ID`}
                          onClick={() => copyText(request.displayJnuitsId)}
                          title="Copy member ID"
                          type="button"
                        >
                          <Copy size={13} />
                        </button>
                        <button
                          aria-label={`Open actions for ${request.fullName}`}
                          onClick={(event) => openMenu(request.id, event)}
                          title="More actions"
                          type="button"
                        >
                          <Ellipsis size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Pagination
          page={page}
          pageSize={pageSize}
          totalCount={totalCount}
          updateParam={updateParam}
        />

        {selectedRequest ? (
          <section className="membership-edit-panel">
            <div className="membership-edit-panel__header">
              <div>
                <strong>{selectedRequest.fullName}</strong>
                <p>
                  {selectedRequest.displayJnuitsId} · {selectedRequest.email || "No email"}
                </p>
              </div>
              <button className="ghost-button" onClick={() => setEditingRequestId(null)} type="button">
                <X size={13} /> Close
              </button>
            </div>
            <div className="workplace-diff-grid">
              <div className="admin-diff-box">
                <p className="admin-diff-box__label">Requested state</p>
                {[
                  ["Organization", selectedRequest.payload.currentOrganization],
                  ["Designation", selectedRequest.payload.designation],
                  ["Location", selectedRequest.payload.workLocation],
                  ["Facebook", selectedRequest.payload.facebookUrl],
                  ["LinkedIn", selectedRequest.payload.linkedinUrl],
                  ["Website", selectedRequest.payload.websiteUrl],
                  ["Visibility", selectedRequest.payload.professionalVisibility],
                ].map(([label, value]) => (
                  <div className="admin-diff-box__item" key={label}>
                    <span className="admin-diff-box__key">{label}</span>
                    <span>{value || "No change"}</span>
                  </div>
                ))}
              </div>
              <div className="admin-diff-box">
                <p className="admin-diff-box__label">Current member state</p>
                <div className="admin-diff-box__item">
                  <span className="admin-diff-box__key">Organization</span>
                  <span>{selectedRequest.currentOrganization || "Not set"}</span>
                </div>
                <div className="admin-diff-box__item">
                  <span className="admin-diff-box__key">Designation</span>
                  <span>{displayDesignation(selectedRequest.designation)}</span>
                </div>
                <div className="admin-diff-box__item">
                  <span className="admin-diff-box__key">Location</span>
                  <span>{selectedRequest.workLocation || "Not set"}</span>
                </div>
                <div className="admin-diff-box__item">
                  <span className="admin-diff-box__key">Facebook</span>
                  <span>{selectedRequest.facebookUrl || "Not set"}</span>
                </div>
                <div className="admin-diff-box__item">
                  <span className="admin-diff-box__key">LinkedIn</span>
                  <span>{selectedRequest.linkedinUrl || "Not set"}</span>
                </div>
                <div className="admin-diff-box__item">
                  <span className="admin-diff-box__key">Website</span>
                  <span>{selectedRequest.websiteUrl || "Not set"}</span>
                </div>
                <div className="admin-diff-box__item">
                  <span className="admin-diff-box__key">Visibility</span>
                  <span>{selectedRequest.professionalVisibility || "members-only"}</span>
                </div>
              </div>
            </div>
            <label className="input-label" htmlFor="workplace-review-note">
              Review note
              <textarea
                id="workplace-review-note"
                onChange={(event) => setReviewNote(event.target.value)}
                placeholder="Decision reason or follow-up"
                rows={3}
                value={reviewNote}
              />
            </label>
            <div className="membership-edit-panel__footer">
              <div className="flex flex-wrap gap-2">
                <button
                  className="admin-btn admin-btn--success"
                  disabled={busyKey === `approve-${selectedRequest.id}` || selectedRequest.status !== "pending"}
                  onClick={() =>
                    runAction(`approve-${selectedRequest.id}`, () =>
                      reviewWorkplaceRequestAction({
                        decision: "approved",
                        requestId: selectedRequest.id,
                        reviewNote,
                      })
                    )
                  }
                  type="button"
                >
                  {busyKey === `approve-${selectedRequest.id}` ? <span className="membership-spinner" /> : "Approve"}
                </button>
                <button
                  className="admin-btn admin-btn--danger"
                  disabled={busyKey === `reject-${selectedRequest.id}` || selectedRequest.status !== "pending"}
                  onClick={() =>
                    runAction(`reject-${selectedRequest.id}`, () =>
                      reviewWorkplaceRequestAction({
                        decision: "rejected",
                        requestId: selectedRequest.id,
                        reviewNote,
                      })
                    )
                  }
                  type="button"
                >
                  {busyKey === `reject-${selectedRequest.id}` ? <span className="membership-spinner" /> : "Reject"}
                </button>
              </div>
              <span className="text-xs text-[var(--color-text-secondary)]">
                Reviewed decisions update audit history immediately.
              </span>
            </div>
          </section>
        ) : null}
      </section>

      <section className="section-band" id="workplace-directory">
        <div className="membership-table-heading">
          <div>
            <span className="eyebrow">Workplace directory</span>
            <h2 className="mt-4 font-[family-name:var(--font-heading)] text-[clamp(2rem,3vw,2.7rem)] leading-[0.96] tracking-[-0.04em]">
              Canonical member workplace records
            </h2>
          </div>
          <p>Use direct corrections for verified admin-side fixes only.</p>
        </div>

        <div className="membership-table-toolbar">
          <div className="membership-table-search">
            <Search aria-hidden="true" size={14} />
            <input
              onChange={(event) => setDirectorySearch(event.target.value)}
              placeholder="Search directory workplace records"
              value={directorySearch}
            />
          </div>
          <span className="membership-table-count">
            Showing {filteredDirectory.length} of {directoryMembers.length} members
          </span>
        </div>

        {filteredDirectory.length === 0 ? (
          <EmptyPanel
            action={{ label: "Review recent decisions", targetId: "workplace-history" }}
            description="Member workplace records will appear here after profiles are created or imported."
            title="No workplace directory records"
          />
        ) : (
          <div className="membership-table-shell">
            <table className="membership-table workplace-directory-table">
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Organization</th>
                  <th>Designation</th>
                  <th>Location</th>
                  <th>Visibility</th>
                  <th>Lifecycle</th>
                  <th>Last updated</th>
                  <th className="membership-table__actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredDirectory.map((member) => (
                  <tr
                    className="membership-table-row"
                    data-editing={editingMemberId === member.id}
                    key={member.id}
                    onClick={() => setEditingMemberId(member.id)}
                  >
                    <td>
                      <div className="membership-table-member">
                        <span className="membership-table-avatar" data-tone={avatarTone(member.id)}>
                          {initials(member.fullName)}
                        </span>
                        <span>
                          <strong>{member.fullName}</strong>
                          <small>
                            {member.displayJnuitsId} · {member.email || "No email"}
                          </small>
                        </span>
                      </div>
                    </td>
                    <td>{member.currentOrganization || "Not set"}</td>
                    <td>{displayDesignation(member.designation)}</td>
                    <td>{member.workLocation || "Not set"}</td>
                    <td>
                      <RequestStatusBadge status={member.professionalVisibility || "members-only"} />
                    </td>
                    <td>
                      <Badge kind="lifecycle" value={member.lifecycleStatus || "current"} />
                    </td>
                    <td>{formatDate(member.updatedAt)}</td>
                    <td className="membership-table__actions" onClick={(event) => event.stopPropagation()}>
                      <div className="membership-row-actions">
                        <button
                          aria-label={`Edit ${member.fullName}'s workplace profile`}
                          onClick={() => setEditingMemberId(member.id)}
                          title="Edit workplace"
                          type="button"
                        >
                          <Edit3 size={13} />
                        </button>
                        <button
                          aria-label={`Copy ${member.fullName}'s member ID`}
                          onClick={() => copyText(member.displayJnuitsId)}
                          title="Copy member ID"
                          type="button"
                        >
                          <Copy size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {selectedMember ? (
          <DirectoryEditPanel
            busy={busyKey === `member-${selectedMember.id}`}
            member={selectedMember}
            onCancel={() => setEditingMemberId(null)}
            onSave={(payload) =>
              runAction(`member-${selectedMember.id}`, () =>
                updateMemberWorkplaceAction({
                  memberId: selectedMember.id,
                  note: payload.note,
                  payload,
                })
              )
            }
          />
        ) : null}
      </section>

      <section className="section-band" id="workplace-history">
        <div className="membership-table-heading">
          <div>
            <span className="eyebrow">Review history</span>
            <h2 className="mt-4 font-[family-name:var(--font-heading)] text-[clamp(2rem,3vw,2.6rem)] leading-[0.96] tracking-[-0.04em]">
              Recent workplace decisions
            </h2>
          </div>
          <p>Compact audit trail of the latest moderated workplace changes.</p>
        </div>
        <div className="workplace-history-list">
          {historyRows.length === 0 ? (
            <EmptyPanel
              description="Approved, rejected, and cancelled workplace requests will appear here."
              title="No workplace review history yet"
            />
          ) : (
            historyRows.map((row) => (
              <article className="workplace-history-row" key={row.id}>
                <div className="workplace-history-row__member">
                  <span className="membership-table-avatar" data-tone={avatarTone(row.memberId)}>
                    {initials(row.fullName)}
                  </span>
                  <div>
                    <strong>{row.fullName}</strong>
                    <small>{row.displayJnuitsId}</small>
                  </div>
                </div>
                <div className="workplace-history-row__summary">
                  <span>Requested</span>
                  <p>{payloadSummary(row)}</p>
                  <small>Current: {currentSummary(row)}</small>
                </div>
                <div>
                  <RequestStatusBadge status={row.status} />
                </div>
                <div className="workplace-history-row__date">
                  <span>Reviewed</span>
                  <strong>{formatDate(row.reviewedAt || row.requestedAt)}</strong>
                </div>
                {row.reviewNote ? (
                  <p className="workplace-history-row__note">{row.reviewNote}</p>
                ) : null}
              </article>
            ))
          )}
        </div>
      </section>

      <section className="section-band" id="workplace-guidance">
        <div className="membership-table-heading">
          <div>
            <span className="eyebrow">Settings / guidance</span>
            <h2 className="mt-4 font-[family-name:var(--font-heading)] text-[clamp(2rem,3vw,2.6rem)] leading-[0.96] tracking-[-0.04em]">
              Workplace data rules
            </h2>
          </div>
          <p>Operational guardrails for public visibility, moderation, and audit handling.</p>
        </div>
        <div className="workplace-guidance-grid">
          <div className="workplace-guidance-list">
          {([
            [FileClock, "Moderated by default", "Portal-submitted workplace changes require admin review before member records update."],
            [Globe2, "Visibility respected", "Public surfaces continue to honor professional visibility: public, members-only, or private."],
            [History, "Direct edits audited", "Admin corrections require a note and write audit evidence for later review."],
          ] satisfies Array<[LucideIcon, string, string]>).map(([Icon, title, copy]) => (
            <article className="workplace-guidance-card" key={title}>
              <span className="workplace-guidance-card__icon">
                <Icon aria-hidden="true" size={16} />
              </span>
              <div>
                <h3>{title}</h3>
                <p>{copy}</p>
              </div>
            </article>
          ))}
          </div>
          <aside className="workplace-guidance-checklist">
            <div className="workplace-guidance-checklist__header">
              <Settings2 aria-hidden="true" size={16} />
              <div>
                <h3>Operator checklist</h3>
                <p>Use this before approving or correcting workplace data.</p>
              </div>
            </div>
            <ul>
              {[
                "Confirm the organization and designation are plausible.",
                "Keep missing designations as Student unless a role is verified.",
                "Respect the member's selected visibility before public exposure.",
                "Use the admin note to record why a direct correction was made.",
              ].map((item) => (
                <li key={item}>
                  <Check aria-hidden="true" size={13} />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </aside>
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
          <div className="membership-row-menu" ref={menuRef} style={{ left: menuState.left, top: menuState.top }}>
            <button
              onClick={() => {
                setEditingRequestId(menuState.requestId);
                setMenuState(null);
              }}
              type="button"
            >
              <Eye size={13} /> Review details
            </button>
            <button
              onClick={() => {
                const request = requests.find((row) => row.id === menuState.requestId);
                if (request) copyText(request.displayJnuitsId);
                setMenuState(null);
              }}
              type="button"
            >
              <Copy size={13} /> Copy member ID
            </button>
            <button
              onClick={() => {
                const request = requests.find((row) => row.id === menuState.requestId);
                if (request) {
                  runAction(`menu-approve-${request.id}`, () =>
                    reviewWorkplaceRequestAction({
                      decision: "approved",
                      requestId: request.id,
                      reviewNote: "Approved from workplace action menu.",
                    })
                  );
                }
                setMenuState(null);
              }}
              type="button"
            >
              <CheckCircle size={13} /> Approve
            </button>
            <button
              className="membership-row-menu__danger"
              onClick={() => {
                const request = requests.find((row) => row.id === menuState.requestId);
                if (request) {
                  runAction(`menu-reject-${request.id}`, () =>
                    reviewWorkplaceRequestAction({
                      decision: "rejected",
                      requestId: request.id,
                      reviewNote: "Rejected from workplace action menu.",
                    })
                  );
                }
                setMenuState(null);
              }}
              type="button"
            >
              <XCircle size={13} /> Reject
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}

function DirectoryEditPanel({
  busy,
  member,
  onCancel,
  onSave,
}: {
  busy: boolean;
  member: WorkplaceDirectoryMember;
  onCancel: () => void;
  onSave: (payload: {
    currentOrganization: string;
    designation: string;
    facebookUrl: string;
    linkedinUrl: string;
    note: string;
    professionalVisibility: string;
    websiteUrl: string;
    workLocation: string;
  }) => void;
}) {
  const [currentOrganization, setCurrentOrganization] = useState(member.currentOrganization || "");
  const [designation, setDesignation] = useState(displayDesignation(member.designation));
  const [workLocation, setWorkLocation] = useState(member.workLocation || "");
  const [facebookUrl, setFacebookUrl] = useState(member.facebookUrl || "");
  const [linkedinUrl, setLinkedinUrl] = useState(member.linkedinUrl || "");
  const [websiteUrl, setWebsiteUrl] = useState(member.websiteUrl || "");
  const [professionalVisibility, setProfessionalVisibility] = useState(
    member.professionalVisibility || "members-only"
  );
  const [note, setNote] = useState("");
  const [noteError, setNoteError] = useState("");
  const noteRef = useRef<HTMLTextAreaElement | null>(null);

  function handleSave() {
    if (note.trim().length < 4) {
      setNoteError("Add a short correction note before saving.");
      noteRef.current?.focus();
      return;
    }

    onSave({
      currentOrganization,
      designation,
      facebookUrl,
      linkedinUrl,
      note,
      professionalVisibility,
      websiteUrl,
      workLocation,
    });
  }

  return (
    <section className="membership-edit-panel">
      <div className="membership-edit-panel__header">
        <div>
          <strong>{member.fullName}</strong>
          <p>
            {member.displayJnuitsId} · {member.email || "No email"}
          </p>
        </div>
        <button className="ghost-button" onClick={onCancel} type="button">
          <X size={13} /> Close
        </button>
      </div>
      <div className="membership-edit-grid">
        <label htmlFor="directory-organization">
          Organization
          <input
            id="directory-organization"
            onChange={(event) => setCurrentOrganization(event.target.value)}
            value={currentOrganization}
          />
        </label>
        <label htmlFor="directory-designation">
          Designation
          <input
            id="directory-designation"
            onChange={(event) => setDesignation(event.target.value)}
            value={designation}
          />
        </label>
        <label htmlFor="directory-location">
          Work location
          <input
            id="directory-location"
            onChange={(event) => setWorkLocation(event.target.value)}
            value={workLocation}
          />
        </label>
        <label htmlFor="directory-visibility">
          Visibility
          <select
            id="directory-visibility"
            onChange={(event) => setProfessionalVisibility(event.target.value)}
            value={professionalVisibility}
          >
            <option value="public">Public</option>
            <option value="members-only">Members only</option>
            <option value="private">Private</option>
          </select>
        </label>
        <label htmlFor="directory-facebook">
          Facebook URL
          <input
            id="directory-facebook"
            onChange={(event) => setFacebookUrl(event.target.value)}
            placeholder="https://facebook.com/..."
            type="url"
            value={facebookUrl}
          />
        </label>
        <label htmlFor="directory-linkedin">
          LinkedIn URL
          <input
            id="directory-linkedin"
            onChange={(event) => setLinkedinUrl(event.target.value)}
            placeholder="https://linkedin.com/in/..."
            type="url"
            value={linkedinUrl}
          />
        </label>
        <label htmlFor="directory-website">
          Website URL
          <input
            id="directory-website"
            onChange={(event) => setWebsiteUrl(event.target.value)}
            placeholder="https://example.com"
            type="url"
            value={websiteUrl}
          />
        </label>
        <label htmlFor="directory-note" style={{ gridColumn: "1 / -1" }}>
          Admin correction note *
          <textarea
            aria-describedby="directory-note-help"
            aria-invalid={Boolean(noteError)}
            id="directory-note"
            onChange={(event) => {
              setNote(event.target.value);
              if (noteError && event.target.value.trim().length >= 4) {
                setNoteError("");
              }
            }}
            placeholder="Example: Published workplace visibility after verifying member request"
            ref={noteRef}
            rows={3}
            value={note}
          />
          <span
            className={noteError ? "membership-edit-error" : "membership-edit-help"}
            id="directory-note-help"
          >
            {noteError || "Required for audit history. Minimum 4 characters."}
          </span>
        </label>
      </div>
      <div className="membership-edit-panel__footer">
        <div className="flex flex-wrap gap-2">
          <button
            className="primary-button w-auto"
            disabled={busy}
            onClick={handleSave}
            type="button"
          >
            {busy ? <span className="membership-spinner" /> : "Save correction"}
          </button>
          <button className="ghost-button" onClick={onCancel} type="button">
            Cancel
          </button>
        </div>
        <span className="text-xs text-[var(--color-text-secondary)]">
          Direct corrections notify the member when email is available.
        </span>
      </div>
    </section>
  );
}
