"use client";

import Link from "next/link";
import { formatDhakaDateTime } from "@/lib/admin/activity/format";
export { formatDhakaDateTime } from "@/lib/admin/activity/format";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Clock,
  ExternalLink,
  Filter,
  Globe,
  HelpCircle,
  Laptop,
  RotateCcw,
  Shield,
  ShieldAlert,
  XCircle,
} from "lucide-react";

export type ActivityOutcome = "succeeded" | "failed" | "denied" | "unknown";

export type ActivityContext = {
  ipDisplay: string | null;
  countryDisplay: string | null;
  browser: string | null;
  os: string | null;
  deviceClass: string | null;
};

export type ActivityItem = {
  id: string;
  actionLabel: string;
  sourceLabel: string;
  provenanceLabel: string;
  occurredAt: string;
  recordedAt: string;
  actorLabel: string;
  targetLabel: string;
  outcome: ActivityOutcome;
  href?: string | null;
  context: ActivityContext | null;
  canRequestFullNetwork: boolean;
};

export type ActivityCoverage = {
  state: "current" | "delayed" | "partial" | "unavailable";
  observedSince: string | null;
  lastCollectedAt: string | null;
  message: string;
};

export type ActivityFilterState = {
  actor?: string;
  action?: string;
  outcome?: string;
  dateFrom?: string;
  dateTo?: string;
};

export type ActivityFilterOptions = {
  actors?: readonly { value: string; label: string }[];
  actions?: readonly { value: string; label: string }[];
  outcomes?: readonly { value: string; label: string }[];
};

export type AdminActivityPanelProps = {
  navigation?: { previousHref: string | null; nextHref: string | null; resetHref: string; networkHrefs: Readonly<Record<string,string>> };
  items: readonly ActivityItem[];
  coverage: ActivityCoverage;
  page: number;
  pageSize?: number;
  totalItems: number;
  filters?: ActivityFilterState;
  filterOptions?: ActivityFilterOptions;
  onFilterChange?: (filters: ActivityFilterState) => void;
  onPageChange?: (page: number) => void;
  onRequestFullNetwork?: (itemId: string) => void;
  className?: string;
};

function renderOutcomeBadge(outcome: ActivityOutcome) {
  switch (outcome) {
    case "succeeded":
      return (
        <span className="abadge abadge--published inline-flex items-center gap-1">
          <CheckCircle2 size={11} aria-hidden="true" />
          <span>Succeeded</span>
        </span>
      );
    case "failed":
      return (
        <span className="abadge abadge--rejected inline-flex items-center gap-1">
          <XCircle size={11} aria-hidden="true" />
          <span>Failed</span>
        </span>
      );
    case "denied":
      return (
        <span className="abadge abadge--pending inline-flex items-center gap-1">
          <ShieldAlert size={11} aria-hidden="true" />
          <span>Denied</span>
        </span>
      );
    case "unknown":
    default:
      return (
        <span className="abadge abadge--draft inline-flex items-center gap-1">
          <HelpCircle size={11} aria-hidden="true" />
          <span>Unknown</span>
        </span>
      );
  }
}

function renderCoverageBanner(coverage: ActivityCoverage) {
  const isUnavailable = coverage.state === "unavailable";
  const isDelayed = coverage.state === "delayed" || coverage.state === "partial";

  return (
    <div
      className={`rounded-lg border p-3.5 text-xs ${
        isUnavailable
          ? "border-amber-300/60 bg-amber-50/70 text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200"
          : isDelayed
            ? "border-blue-200 bg-blue-50/50 text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/20 dark:text-blue-200"
            : "border-[var(--line)] bg-[color-mix(in_oklab,var(--background)_80%,var(--card))] text-[var(--muted-foreground)]"
      }`}
      role="status"
      data-testid="activity-coverage-banner"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {isUnavailable ? (
            <AlertTriangle size={15} className="shrink-0 text-amber-600 dark:text-amber-400" />
          ) : (
            <Clock size={15} className="shrink-0 text-[var(--muted-foreground)]" />
          )}
          <span className="font-semibold capitalize">Coverage: {coverage.state}</span>
          <span>&mdash;</span>
          <span>{coverage.message}</span>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-[11px]">
          {coverage.observedSince && (
            <span>Observed since: {formatDhakaDateTime(coverage.observedSince)} (Asia/Dhaka)</span>
          )}
          {coverage.lastCollectedAt && (
            <span>Last collected: {formatDhakaDateTime(coverage.lastCollectedAt)}</span>
          )}
        </div>
      </div>
    </div>
  );
}

export function AdminActivityPanel({
  navigation,
  items,
  coverage,
  page,
  pageSize = 25,
  totalItems,
  filters = {},
  filterOptions = {},
  onFilterChange,
  onPageChange,
  onRequestFullNetwork,
  className = "",
}: AdminActivityPanelProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const startItem = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const endItem = Math.min(totalItems, page * pageSize);

  function handleFilterSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!onFilterChange) return;
    const formData = new FormData(e.currentTarget);
    onFilterChange({
      actor: String(formData.get("actor") ?? "").trim() || undefined,
      action: String(formData.get("action") ?? "").trim() || undefined,
      outcome: String(formData.get("outcome") ?? "").trim() || undefined,
      dateFrom: String(formData.get("from") ?? "").trim() || undefined,
      dateTo: String(formData.get("to") ?? "").trim() || undefined,
    });
  }

  function handleResetFilters() {
    if (onFilterChange) {
      onFilterChange({});
    }
  }

  return (
    <div className={`grid gap-5 ${className}`} data-testid="admin-activity-panel">
      {/* Coverage Status */}
      {renderCoverageBanner(coverage)}

      {/* Filter Toolbar */}
      <form
        action={navigation ? "/admin/audit" : undefined}
        method={navigation ? "get" : undefined}
        onSubmit={handleFilterSubmit}
        className="rounded-[0.9rem] border border-[var(--line)] bg-[var(--card)] p-4 shadow-sm"
        aria-label="Activity filter controls"
      >
        {navigation ? <><input type="hidden" name="view" value="activity"/><input type="hidden" name="page" value="1"/><input type="hidden" name="pageSize" value={pageSize}/></> : null}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-5">
          <label className="input-label text-xs" htmlFor="activity-filter-actor">
            Actor
            {filterOptions.actors ? <select id="activity-filter-actor" name="actor" defaultValue={filters.actor ?? ""} className="text-xs">
              <option value="">All actors</option>
              {filters.actor && !filterOptions.actors.some(actor => actor.value === filters.actor) ? <option value={filters.actor}>Selected actor</option> : null}
              {filterOptions.actors.map(actor => <option key={actor.value} value={actor.value}>{actor.label}</option>)}
            </select> : <input
              id="activity-filter-actor"
              name="actor"
              type="text"
              placeholder="Actor UUID"
              defaultValue={filters.actor ?? ""}
              className="text-xs"
            />}
          </label>

          <label className="input-label text-xs" htmlFor="activity-filter-action">
            Action
            <input
              id="activity-filter-action"
              name="action"
              type="text"
              placeholder="e.g. role.grant, login"
              defaultValue={filters.action ?? ""}
              className="text-xs"
            />
          </label>

          <label className="input-label text-xs" htmlFor="activity-filter-outcome">
            Outcome
            <select
              id="activity-filter-outcome"
              name="outcome"
              defaultValue={filters.outcome ?? ""}
              className="text-xs"
            >
              <option value="">All outcomes</option>
              {filterOptions?.outcomes?.length
                ? filterOptions.outcomes.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))
                : (
                    <>
                      <option value="succeeded">Succeeded</option>
                      <option value="failed">Failed</option>
                      <option value="denied">Denied</option>
                      <option value="unknown">Unknown</option>
                    </>
                  )}
            </select>
          </label>

          <label className="input-label text-xs" htmlFor="activity-filter-date-from">
            From date
            <input
              id="activity-filter-date-from"
              name="from"
              type="date"
              defaultValue={filters.dateFrom ?? ""}
              className="text-xs"
            />
          </label>

          <label className="input-label text-xs" htmlFor="activity-filter-date-to">
            To date
            <input
              id="activity-filter-date-to"
              name="to"
              type="date"
              defaultValue={filters.dateTo ?? ""}
              className="text-xs"
            />
          </label>
        </div>

        <div className="mt-3.5 flex flex-wrap items-center justify-end gap-2 border-t border-[var(--line)] pt-3">
          {navigation ? <Link href={navigation.resetHref} prefetch={false} className="ghost-button flex items-center gap-1.5 text-xs"><RotateCcw size={13} aria-hidden="true"/><span>Reset</span></Link> : <button
            type="button"
            onClick={handleResetFilters}
            className="ghost-button flex items-center gap-1.5 text-xs"
          >
            <RotateCcw size={13} aria-hidden="true" />
            <span>Reset</span>
          </button>}
          <button type="submit" className="primary-button flex items-center gap-1.5 text-xs">
            <Filter size={13} aria-hidden="true" />
            <span>Apply filters</span>
          </button>
        </div>
      </form>

      {/* Activity Items Count Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-[family-name:var(--font-heading)] text-sm font-semibold text-[var(--foreground)]">
          Audit &amp; Activity Log
        </h3>
        <span className="text-xs text-[var(--muted-foreground)]">
          Showing {startItem}&ndash;{endItem} of {totalItems} recorded events
        </span>
      </div>

      {/* Main Content: Desktop Table + Mobile Cards */}
      {items.length === 0 ? (
        <div className="empty-state rounded-[0.9rem] border border-[var(--line)] bg-[var(--card)] p-8 text-center">
          <Shield size={24} className="mx-auto text-[var(--muted-foreground)]" aria-hidden="true" />
          <p className="mt-2 text-sm font-semibold text-[var(--foreground)]">
            No activity events matched the selected filters
          </p>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">
            Try adjusting your search criteria or resetting date bounds.
          </p>
        </div>
      ) : (
        <>
          {/* Desktop Table View (hidden on small screens) */}
          <div className="hidden rounded-[0.9rem] border border-[var(--line)] bg-[var(--card)] shadow-sm md:block overflow-x-auto">
            <table className="admin-responsive-table w-full text-left text-xs" aria-label="Activity events table">
              <thead className="border-b border-[var(--line)] bg-[color-mix(in_oklab,var(--background)_80%,var(--card))] font-semibold text-[var(--muted-foreground)]">
                <tr>
                  <th scope="col" className="px-3.5 py-3">Timestamp (Dhaka)</th>
                  <th scope="col" className="px-3.5 py-3">Actor</th>
                  <th scope="col" className="px-3.5 py-3">Action</th>
                  <th scope="col" className="px-3.5 py-3">Target</th>
                  <th scope="col" className="px-3.5 py-3">Outcome</th>
                  <th scope="col" className="px-3.5 py-3">Context</th>
                  <th scope="col" className="px-3.5 py-3">Provenance</th>
                  <th scope="col" className="px-3.5 py-3 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {items.map((item) => {
                  const clientDevices = [
                    item.context?.browser,
                    item.context?.os,
                    item.context?.deviceClass,
                  ]
                    .filter(Boolean)
                    .join(" · ");

                  return (
                    <tr key={item.id} className="transition-colors hover:bg-[color-mix(in_oklab,var(--background)_60%,var(--card))]">
                      <td data-label="Timestamp (Dhaka)" className="px-3.5 py-3 whitespace-nowrap text-[var(--foreground)]">
                        {formatDhakaDateTime(item.occurredAt)}
                      </td>
                      <td data-label="Actor" className="px-3.5 py-3 font-medium text-[var(--foreground)]">
                        {item.actorLabel}
                      </td>
                      <td data-label="Action" className="px-3.5 py-3">
                        <span className="font-mono text-[11px] text-[var(--foreground)]">
                          {item.actionLabel}
                        </span>
                      </td>
                      <td data-label="Target" className="px-3.5 py-3 text-[var(--muted-foreground)]">
                        {item.targetLabel || "None"}
                      </td>
                      <td data-label="Outcome" className="px-3.5 py-3 whitespace-nowrap">
                        {renderOutcomeBadge(item.outcome)}
                      </td>
                      <td data-label="Context" className="px-3.5 py-3">
                        <div className="flex flex-col gap-0.5 text-[11px]">
                          <span>
                            {item.context?.ipDisplay || "Unknown IP"}
                            {item.context?.countryDisplay ? ` (${item.context.countryDisplay})` : ""}
                          </span>
                          {clientDevices && (
                            <span className="text-[10px] text-[var(--muted-foreground)]">
                              {clientDevices}
                            </span>
                          )}
                        </div>
                      </td>
                      <td data-label="Provenance" className="px-3.5 py-3 text-[11px] text-[var(--muted-foreground)]">
                        <span>{item.provenanceLabel}</span>
                        <span className="block text-[10px] opacity-75">via {item.sourceLabel}</span>
                      </td>
                      <td data-label="Details" className="px-3.5 py-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          {item.href && (
                            <Link
                              href={item.href}
                              className="font-semibold text-[var(--primary,#0284c7)] hover:underline inline-flex items-center gap-1"
                            >
                              <span>View</span>
                              <ExternalLink size={11} aria-hidden="true" />
                            </Link>
                          )}
                          {item.canRequestFullNetwork && navigation?.networkHrefs[item.id] ? <Link href={navigation.networkHrefs[item.id]} prefetch={false} className="ghost-button text-[11px] inline-flex items-center gap-1"><Shield size={11} aria-hidden="true"/><span>Network</span></Link> : item.canRequestFullNetwork && onRequestFullNetwork && (
                            <button
                              type="button"
                              onClick={() => onRequestFullNetwork(item.id)}
                              className="ghost-button px-2 py-1 text-[11px]"
                              title="Request full network details (requires admin.security.read)"
                            >
                              Network
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Stacked View (visible only on small screens) */}
          <div className="grid gap-2.5 md:hidden" aria-label="Mobile activity card list">
            {items.map((item) => (
              <article
                key={item.id}
                className="rounded-lg border border-[var(--line)] bg-[var(--card)] p-3.5 text-xs shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-[var(--foreground)]">
                    {item.actorLabel}
                  </span>
                  {renderOutcomeBadge(item.outcome)}
                </div>

                <div className="mt-2 grid gap-1 font-mono text-[11px]">
                  <p className="font-semibold text-[var(--foreground)]">{item.actionLabel}</p>
                  <p className="text-[var(--muted-foreground)]">Target: {item.targetLabel || "None"}</p>
                  <p className="text-[var(--muted-foreground)] font-sans">
                    {formatDhakaDateTime(item.occurredAt)} (Asia/Dhaka)
                  </p>
                </div>

                <details className="mt-2.5 border-t border-[var(--line)] pt-2 text-[11px] text-[var(--muted-foreground)]">
                  <summary className="flex cursor-pointer list-none items-center justify-between font-medium text-[var(--foreground)]">
                    <span>Provenance &amp; context details</span>
                    <ChevronDown size={12} aria-hidden="true" />
                  </summary>
                  <div className="mt-2 space-y-1 pl-1">
                    <p className="flex items-center gap-1">
                      <Globe size={11} aria-hidden="true" />
                      <span>
                        IP: {item.context?.ipDisplay || "Unknown"}
                        {item.context?.countryDisplay ? ` (${item.context.countryDisplay})` : ""}
                      </span>
                    </p>
                    <p className="flex items-center gap-1">
                      <Laptop size={11} aria-hidden="true" />
                      <span>
                        Device: {[item.context?.browser, item.context?.os, item.context?.deviceClass].filter(Boolean).join(" · ") || "Unknown device"}
                      </span>
                    </p>
                    <p>Source: {item.sourceLabel}</p>
                    <p>Provenance: {item.provenanceLabel}</p>

                    <div className="mt-2 flex flex-wrap gap-2 pt-1">
                      {item.href && (
                        <Link
                          href={item.href}
                          className="font-semibold text-[var(--primary,#0284c7)] hover:underline inline-flex items-center gap-1"
                        >
                          <span>View record</span>
                          <ExternalLink size={11} aria-hidden="true" />
                        </Link>
                      )}
                      {item.canRequestFullNetwork && navigation?.networkHrefs[item.id] ? <Link href={navigation.networkHrefs[item.id]} prefetch={false} className="ghost-button text-[11px]">Request full network</Link> : item.canRequestFullNetwork && onRequestFullNetwork && (
                        <button
                          type="button"
                          onClick={() => onRequestFullNetwork(item.id)}
                          className="ghost-button text-[11px]"
                        >
                          Request full network
                        </button>
                      )}
                    </div>
                  </div>
                </details>
              </article>
            ))}
          </div>
        </>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && onPageChange && (
        <nav
          aria-label="Activity log pagination"
          className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] pt-3 text-xs"
        >
          {navigation ? navigation.previousHref ? <Link href={navigation.previousHref} prefetch={false} className="secondary-button">Previous</Link> : <span aria-disabled="true" className="secondary-button opacity-50">Previous</span> : <button
            type="button"
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page <= 1}
            className="secondary-button"
          >
            Previous
          </button>}
          <span className="text-[var(--muted-foreground)]">
            Page {page} of {totalPages}
          </span>
          {navigation ? navigation.nextHref ? <Link href={navigation.nextHref} prefetch={false} className="secondary-button">Next</Link> : <span aria-disabled="true" className="secondary-button opacity-50">Next</span> : <button
            type="button"
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            disabled={page >= totalPages}
            className="secondary-button"
          >
            Next
          </button>}
        </nav>
      )}
    </div>
  );
}
