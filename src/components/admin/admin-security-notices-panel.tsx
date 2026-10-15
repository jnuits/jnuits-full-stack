"use client";

import Link from "next/link";
import { useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Bell,
  Check,
  CheckCheck,
  CheckCircle2,
  ExternalLink,
  HelpCircle,
  Info,
  Mail,
} from "lucide-react";
import { formatDhakaDateTime } from "./admin-activity-panel";

export type NoticeSeverity = "info" | "warning" | "critical";

export type NoticeDeliveryStatus =
  | "pending"
  | "accepted"
  | "delivered"
  | "suppressed"
  | "failed"
  | "uncertain";

export type AdminSecurityNotice = {
  id: string;
  title: string;
  summary: string;
  actorLabel: string;
  occurredAt: string;
  severity: NoticeSeverity;
  readAt: string | null;
  href: string | null;
  deliveryStatus?: NoticeDeliveryStatus;
};

export type AdminSecurityNoticesPanelProps = {
  notices: readonly AdminSecurityNotice[];
  page: number;
  pageSize?: number;
  totalItems: number;
  unreadCount: number | null;
  availability: "available" | "unavailable";
  onMarkRead?: (noticeId: string) => Promise<void> | void;
  onMarkAllRead?: () => Promise<void> | void;
  onPageChange?: (page: number) => void;
  onFilterChange?: (filter: { severity?: string; read?: boolean }) => void;
  className?: string;
};

function renderSeverityBadge(severity: NoticeSeverity) {
  switch (severity) {
    case "critical":
      return (
        <span className="abadge abadge--rejected inline-flex items-center gap-1 font-semibold">
          <AlertCircle size={11} aria-hidden="true" />
          <span>Critical</span>
        </span>
      );
    case "warning":
      return (
        <span className="abadge abadge--pending inline-flex items-center gap-1 font-semibold">
          <AlertTriangle size={11} aria-hidden="true" />
          <span>Warning</span>
        </span>
      );
    case "info":
    default:
      return (
        <span className="abadge abadge--draft inline-flex items-center gap-1">
          <Info size={11} aria-hidden="true" />
          <span>Info</span>
        </span>
      );
  }
}

function renderDeliveryStatusBadge(status?: NoticeDeliveryStatus) {
  if (!status) return null;

  switch (status) {
    case "delivered":
      return (
        <span className="detail-chip flex items-center gap-1 text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 size={10} aria-hidden="true" />
          <span>Delivered</span>
        </span>
      );
    case "accepted":
      return (
        <span className="detail-chip flex items-center gap-1 text-sky-700 dark:text-sky-300">
          <Mail size={10} aria-hidden="true" />
          <span>Accepted by mail provider</span>
        </span>
      );
    case "suppressed":
      return (
        <span className="detail-chip flex items-center gap-1 text-amber-700 dark:text-amber-300">
          <AlertTriangle size={10} aria-hidden="true" />
          <span>Recipient suppressed</span>
        </span>
      );
    case "failed":
      return (
        <span className="detail-chip flex items-center gap-1 text-red-700 dark:text-red-300">
          <AlertCircle size={10} aria-hidden="true" />
          <span>Delivery failed</span>
        </span>
      );
    case "uncertain":
      return (
        <span className="detail-chip flex items-center gap-1 text-purple-700 dark:text-purple-300">
          <HelpCircle size={10} aria-hidden="true" />
          <span>Delivery uncertain</span>
        </span>
      );
    case "pending":
    default:
      return (
        <span className="detail-chip flex items-center gap-1 text-[var(--muted-foreground)]">
          <ClockIcon size={10} aria-hidden="true" />
          <span>Pending delivery</span>
        </span>
      );
  }
}

function ClockIcon({ size = 10, ...props }: { size?: number; [key: string]: unknown }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

export function AdminSecurityNoticesPanel({
  notices,
  page,
  pageSize = 25,
  totalItems,
  unreadCount,
  availability,
  onMarkRead,
  onMarkAllRead,
  onPageChange,
  className = "",
}: AdminSecurityNoticesPanelProps) {
  const isUnavailable = availability === "unavailable";
  const [markingIds, setMarkingIds] = useState<Set<string>>(new Set());
  const [markingAll, setMarkingAll] = useState(false);

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const startItem = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const endItem = Math.min(totalItems, page * pageSize);

  async function handleMarkSingle(id: string) {
    if (!onMarkRead || markingIds.has(id)) return;
    setMarkingIds((prev) => new Set(prev).add(id));
    try {
      await onMarkRead(id);
    } finally {
      setMarkingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  async function handleMarkAll() {
    if (!onMarkAllRead || markingAll) return;
    setMarkingAll(true);
    try {
      await onMarkAllRead();
    } finally {
      setMarkingAll(false);
    }
  }

  return (
    <div className={`grid gap-4 ${className}`} data-testid="admin-security-notices-panel">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[0.9rem] border border-[var(--line)] bg-[var(--card)] p-4 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--line)] bg-[color-mix(in_oklab,var(--background)_80%,var(--card))]"
            aria-hidden="true"
          >
            <Bell size={16} className="text-[var(--primary,#0284c7)]" />
          </div>
          <div>
            <h2 className="font-[family-name:var(--font-heading)] text-base font-semibold text-[var(--foreground)]">
              Security Notices
            </h2>
            <p className="text-xs text-[var(--muted-foreground)]">
              {isUnavailable
                ? "Notice service temporarily unavailable"
                : unreadCount !== null
                  ? `${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}`
                  : "Unread count unavailable"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isUnavailable && onMarkAllRead && unreadCount && unreadCount > 0 ? (
            <button
              type="button"
              onClick={() => void handleMarkAll()}
              disabled={markingAll}
              className="ghost-button flex items-center gap-1.5 text-xs"
            >
              <CheckCheck size={14} aria-hidden="true" />
              <span>{markingAll ? "Marking all..." : "Mark all as read"}</span>
            </button>
          ) : null}
        </div>
      </div>

      {isUnavailable ? (
        <div className="rounded-[0.9rem] border border-amber-300/60 bg-amber-50/60 p-6 text-center text-xs text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200">
          <AlertTriangle size={22} className="mx-auto text-amber-600 dark:text-amber-400" aria-hidden="true" />
          <p className="mt-2 text-sm font-semibold">Security notification inbox unavailable</p>
          <p className="mt-1 text-xs opacity-90">
            Security audit events remain accessible in the Audit Explorer. Please retry later.
          </p>
        </div>
      ) : notices.length === 0 ? (
        <div className="empty-state rounded-[0.9rem] border border-[var(--line)] bg-[var(--card)] p-8 text-center">
          <CheckCircle2 size={24} className="mx-auto text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
          <p className="mt-2 text-sm font-semibold text-[var(--foreground)]">
            No security notices in your inbox
          </p>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">
            Privileged events such as password updates and role changes will appear here.
          </p>
        </div>
      ) : (
        <div className="grid gap-2.5" role="feed" aria-label="Security notices feed">
          {notices.map((notice) => {
            const isUnread = notice.readAt === null;
            const isMarking = markingIds.has(notice.id);

            return (
              <article
                key={notice.id}
                className={`relative rounded-lg border p-4 text-xs shadow-sm transition-colors ${
                  isUnread
                    ? "border-sky-300/70 bg-[color-mix(in_oklab,var(--card)_95%,var(--primary,#0284c7))] dark:border-sky-900/50 dark:bg-[color-mix(in_oklab,var(--card)_90%,var(--primary,#0284c7))]"
                    : "border-[var(--line)] bg-[var(--card)] opacity-90"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    {renderSeverityBadge(notice.severity)}
                    {isUnread && (
                      <span className="flex h-2 w-2 rounded-full bg-[var(--primary,#0284c7)]" title="Unread notice" />
                    )}
                    <span className="font-mono text-[11px] text-[var(--muted-foreground)]">
                      {formatDhakaDateTime(notice.occurredAt)} (Asia/Dhaka)
                    </span>
                    {renderDeliveryStatusBadge(notice.deliveryStatus)}
                  </div>

                  <div className="flex items-center gap-2">
                    {isUnread && onMarkRead && (
                      <button
                        type="button"
                        onClick={() => void handleMarkSingle(notice.id)}
                        disabled={isMarking}
                        className="ghost-button flex items-center gap-1 px-2 py-1 text-[11px]"
                        aria-label={`Mark notice as read: ${notice.title}`}
                      >
                        <Check size={12} aria-hidden="true" />
                        <span>{isMarking ? "Marking..." : "Mark read"}</span>
                      </button>
                    )}
                    {notice.href && (
                      <Link
                        href={notice.href}
                        className="inline-flex items-center gap-1 font-semibold text-[var(--primary,#0284c7)] hover:underline text-[11px]"
                      >
                        <span>View</span>
                        <ExternalLink size={11} aria-hidden="true" />
                      </Link>
                    )}
                  </div>
                </div>

                <div className="mt-2.5">
                  <h3 className="font-[family-name:var(--font-heading)] text-sm font-semibold text-[var(--foreground)]">
                    {notice.title}
                  </h3>
                  <p className="mt-1 text-xs leading-relaxed text-[var(--foreground)] opacity-90">
                    {notice.summary}
                  </p>
                  <p className="mt-1.5 text-[11px] text-[var(--muted-foreground)]">
                    Actor: <span className="font-medium text-[var(--foreground)]">{notice.actorLabel}</span>
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {!isUnavailable && totalPages > 1 && onPageChange && (
        <nav
          aria-label="Security notices pagination"
          className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] pt-3 text-xs"
        >
          <button
            type="button"
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page <= 1}
            className="secondary-button"
          >
            Previous
          </button>
          <span className="text-[var(--muted-foreground)]">
            Showing {startItem}&ndash;{endItem} of {totalItems}
          </span>
          <button
            type="button"
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            disabled={page >= totalPages}
            className="secondary-button"
          >
            Next
          </button>
        </nav>
      )}
    </div>
  );
}
