import Link from "next/link";
import {
  CheckCircle2,
  Clock,
  ExternalLink,
  HelpCircle,
  ShieldAlert,
  UserCheck,
} from "lucide-react";
import { formatDhakaDateTime } from "./admin-activity-panel";

export type AdminActivityStatus =
  | "invitation_pending"
  | "never_used"
  | "not_seen_six_months"
  | "seen_recently"
  | "history_unavailable";

export type AdminActivitySummary = {
  status: AdminActivityStatus;
  observedSince: string | null;
  firstWorkspaceEntryAt: string | null;
  lastSignInAt: string | null;
  lastWorkspaceAccessAt: string | null;
  lastCompletedWorkAt: string | null;
  completedWorkCount: number | null;
  label: string;
  explanation: string;
  periodLabel: string | null;
  href?: string | null;
};

export type AdminActivitySummaryProps = {
  summary: AdminActivitySummary;
  title?: string;
  className?: string;
};

function renderStatusBadge(status: AdminActivityStatus, label: string) {
  switch (status) {
    case "seen_recently":
      return (
        <span className="abadge abadge--published inline-flex items-center gap-1">
          <CheckCircle2 size={11} aria-hidden="true" />
          <span>{label || "Seen recently"}</span>
        </span>
      );
    case "invitation_pending":
      return (
        <span className="abadge abadge--draft inline-flex items-center gap-1">
          <UserCheck size={11} aria-hidden="true" />
          <span>{label || "Invitation pending"}</span>
        </span>
      );
    case "never_used":
      return (
        <span className="abadge abadge--pending inline-flex items-center gap-1">
          <Clock size={11} aria-hidden="true" />
          <span>{label || "No workspace access recorded"}</span>
        </span>
      );
    case "not_seen_six_months":
      return (
        <span className="abadge abadge--rejected inline-flex items-center gap-1">
          <ShieldAlert size={11} aria-hidden="true" />
          <span>{label || "No access for six months"}</span>
        </span>
      );
    case "history_unavailable":
    default:
      return (
        <span className="abadge abadge--draft inline-flex items-center gap-1">
          <HelpCircle size={11} aria-hidden="true" />
          <span>{label || "History unavailable"}</span>
        </span>
      );
  }
}

export function AdminActivitySummaryView({
  summary,
  title = "Account activity & accountability summary",
  className = "",
}: AdminActivitySummaryProps) {
  return (
    <section
      aria-labelledby="activity-summary-heading"
      className={`rounded-[0.9rem] border border-[var(--line)] bg-[var(--card)] p-4 sm:p-5 shadow-sm ${className}`}
      data-testid="admin-activity-summary"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold tracking-wider text-[var(--muted-foreground)] uppercase">
            Workspace engagement
          </p>
          <h2
            id="activity-summary-heading"
            className="mt-0.5 font-[family-name:var(--font-heading)] text-base font-semibold text-[var(--foreground)]"
          >
            {title}
          </h2>
        </div>

        <div className="flex items-center gap-2">
          {renderStatusBadge(summary.status, summary.label)}
          {summary.href && (
            <Link
              href={summary.href}
              className="admin-btn admin-btn--ghost text-xs inline-flex items-center gap-1"
            >
              <span>View audit</span>
              <ExternalLink size={12} aria-hidden="true" />
            </Link>
          )}
        </div>
      </div>

      <p className="mt-2 text-xs leading-relaxed text-[var(--muted-foreground)]">
        {summary.explanation}
      </p>

      {/* Metric details grid */}
      <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-[var(--line)] bg-[color-mix(in_oklab,var(--background)_80%,var(--card))] p-3">
          <p className="text-[11px] font-medium text-[var(--muted-foreground)]">
            Last workspace access
          </p>
          <p className="mt-1 font-mono text-xs font-semibold text-[var(--foreground)]">
            {formatDhakaDateTime(summary.lastWorkspaceAccessAt)}
          </p>
          <p className="mt-0.5 text-[10px] text-[var(--muted-foreground)]">Coarse authenticated visit</p>
        </div>

        <div className="rounded-lg border border-[var(--line)] bg-[color-mix(in_oklab,var(--background)_80%,var(--card))] p-3">
          <p className="text-[11px] font-medium text-[var(--muted-foreground)]">
            Last completed action
          </p>
          <p className="mt-1 font-mono text-xs font-semibold text-[var(--foreground)]">
            {formatDhakaDateTime(summary.lastCompletedWorkAt)}
          </p>
          <p className="mt-0.5 text-[10px] text-[var(--muted-foreground)]">Privileged duty execution</p>
        </div>

        <div className="rounded-lg border border-[var(--line)] bg-[color-mix(in_oklab,var(--background)_80%,var(--card))] p-3">
          <p className="text-[11px] font-medium text-[var(--muted-foreground)]">
            First workspace entry
          </p>
          <p className="mt-1 font-mono text-xs font-semibold text-[var(--foreground)]">
            {formatDhakaDateTime(summary.firstWorkspaceEntryAt)}
          </p>
          <p className="mt-0.5 text-[10px] text-[var(--muted-foreground)]">Account activation history</p>
        </div>

        <div className="rounded-lg border border-[var(--line)] bg-[color-mix(in_oklab,var(--background)_80%,var(--card))] p-3">
          <p className="text-[11px] font-medium text-[var(--muted-foreground)]">
            {summary.periodLabel ? `Completed actions (${summary.periodLabel})` : "Completed actions"}
          </p>
          <p className="mt-1 font-mono text-xs font-semibold text-[var(--foreground)]">
            {summary.completedWorkCount !== null ? summary.completedWorkCount : "Not evaluated"}
          </p>
          <p className="mt-0.5 text-[10px] text-[var(--muted-foreground)]">
            {summary.observedSince
              ? `Observed since ${formatDhakaDateTime(summary.observedSince)}`
              : "Observation period not set"}
          </p>
        </div>
      </div>
    </section>
  );
}
