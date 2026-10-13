"use client";

import {
  AlertTriangle,
  Archive,
  Check,
  CheckCircle,
  CalendarDays,
  ChevronRight,
  Clock3,
  ExternalLink,
  Eye,
  GraduationCap,
  Globe2,
  History,
  Info,
  Import,
  Loader2,
  Lock,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Settings,
  UserCheck,
  UserRoundX,
  Users,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ConfirmSubmitButton } from "@/components/admin/confirm-submit-button";
import { CommitteeLeadershipSpeechField } from "./committee-leadership-speech-field";
import { Fragment, useEffect, useMemo, useRef, useState, type ButtonHTMLAttributes, type MouseEvent, type ReactNode } from "react";
import { useFormStatus } from "react-dom";

import {
  bulkUpdateCommitteeAssignments,
  archiveAdvisorProfile,
  linkAdvisorAuthUser,
  removeCommitteeAssignment,
  saveAdvisorProfile,
  saveCommitteeAssignment,
  saveCommitteeTerm,
  setCommitteeTermCurrent,
} from "@/app/admin/committee/actions";
import {
  CommitteeMemberSearch,
  type CommitteeMemberSearchOption,
} from "@/components/admin/committee-member-search";
import { CommitteeOnboardingPanel } from "@/components/admin/committee-onboarding-panel";
import { CommitteePositionEditor } from "@/components/admin/committee-position-editor";
import type { MemberDepartmentOption } from "@/components/admin/member-profile-editor";
import { buildAdvisorDepartmentOptions } from "@/lib/committee/advisor-departments";
import {
  rolesForCommitteeTerm,
  sortCommitteeAssignmentsByTermRoles,
  type CommitteeTermPositionClientRecord,
} from "@/lib/committee/term-positions";

type AdminFlash = {
  message: string;
  title: string;
  tone: string;
} | null;

export type CommitteeTermClientRecord = {
  assignmentCount: number;
  dateConfidence: string;
  electionDate: null | string;
  endsOn: null | string;
  id: string;
  isCurrent: boolean;
  isPublic: boolean;
  slug: string;
  startsOn: string;
  status: string;
  summary: null | string;
  targetExecutiveSlots: number;
  tenureNote: null | string;
  termKind: string;
  termNumber: null | number;
  title: string;
  voterRuleNote: null | string;
};

export type CommitteeRoleClientRecord = {
  code: string;
  defaultSlots: number;
  id: string;
  minSlots: number;
  maxSlots: number;
  roleGroup: string;
  sortOrder: number;
  title: string;
  titleBn: null | string;
};

export type CommitteeAssignmentClientRecord = {
  speech: null | string;
  bio: null | string;
  displayName: null | string;
  email: null | string;
  endsOn: null | string;
  id: string;
  isPublic: boolean;
  jnuitsId: null | string;
  memberId: null | string;
  memberLifecycleStatus: null | string;
  memberName: null | string;
  memberType: null | string;
  publicTitleOverride: null | string;
  roleCode: null | string;
  roleGroup: null | string;
  roleId: string;
  roleTitle: null | string;
  roleTitleBn: null | string;
  sortOrder: number;
  startsOn: null | string;
  status: string;
  termId: string;
  termTitle: null | string;
};

export type AdvisorProfileClientRecord = {
  advisorJnuitsId: null | string;
  advisorType: string;
  avatarSecureUrl: null | string;
  bio: null | string;
  dateConfidence: string;
  department: null | string;
  designation: null | string;
  email: null | string;
  facebookUrl: null | string;
  formerTitle: null | string;
  fullName: string;
  id: string;
  isCurrent: boolean;
  isPublic: boolean;
  jnuProfileUrl: null | string;
  joinedOn: null | string;
  leftOn: null | string;
  linkedinUrl: null | string;
  phone: null | string;
  publications: string[];
  sortOrder: number;
  speech: null | string;
  statusNote: null | string;
  tenureDisplay: null | string;
  title: null | string;
  userId: null | string;
  websiteUrl: null | string;
  workExperience: string[];
};

export type CommitteeHistoryRecord = {
  action: string;
  actorUserId: null | string;
  createdAt: string;
  entityId: null | string;
  entityType: string;
  id: string;
  metadata: Record<string, unknown>;
};

type CommitteeWorkspaceClientProps = {
  advisors: AdvisorProfileClientRecord[];
  assignments: CommitteeAssignmentClientRecord[];
  departmentOptions?: readonly MemberDepartmentOption[];
  flash: AdminFlash;
  history: CommitteeHistoryRecord[];
  positions: CommitteeTermPositionClientRecord[];
  roles: CommitteeRoleClientRecord[];
  terms: CommitteeTermClientRecord[];
};

const navItems = [
  ["Terms", "committee-terms"],
  ["Positions", "committee-positions"],
  ["Executive Roster", "committee-roster"],
  ["Advisors", "committee-advisors"],
  ["Roster Intake", "committee-imports"],
  ["Validation", "committee-validation"],
  ["History", "committee-history"],
] as const;

type FloatingActionMenu =
  | {
      id: string;
      kind: "advisor" | "term";
      left: number;
      top: number;
    }
  | null;

function cx(...classes: Array<false | null | string | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function humanize(value: null | string | undefined) {
  if (!value) return "Not set";
  return value
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDate(value: null | string) {
  if (!value) return "Present";
  return new Intl.DateTimeFormat("en-BD", {
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatShortDate(value: null | string) {
  if (!value) return "Now";
  return new Intl.DateTimeFormat("en-BD", {
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatShortDateRange(start: null | string, end: null | string, fallback?: null | string) {
  if (fallback) return fallback;
  if (!start && !end) return "Not set";
  return `${formatShortDate(start)} - ${formatShortDate(end)}`;
}

function formatAuditTimestamp(value: string) {
  const date = new Date(value);
  const now = new Date();
  const time = new Intl.DateTimeFormat("en-BD", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  if (sameDay) return `Today, ${time}`;

  return `${new Intl.DateTimeFormat("en-BD", {
    day: "numeric",
    month: "short",
  }).format(date)}, ${time}`;
}

function formatOrdinal(value: null | number | undefined) {
  if (!value) return "None";
  const suffix =
    value % 100 >= 11 && value % 100 <= 13
      ? "th"
      : value % 10 === 1
        ? "st"
        : value % 10 === 2
          ? "nd"
          : value % 10 === 3
            ? "rd"
            : "th";
  return `${value}${suffix}`;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return `${parts[0]?.[0] || "J"}${parts.at(-1)?.[0] || "S"}`.toUpperCase();
}

function avatarTone(id: string) {
  const tail = id.replace(/[^a-fA-F0-9]/g, "").slice(-2) || "0";
  return Number.parseInt(tail, 16) % 4;
}

function formatAdvisorDisplayName(advisor: Pick<AdvisorProfileClientRecord, "fullName" | "title">) {
  const title = advisor.title?.trim();

  if (!title) return advisor.fullName;
  if (advisor.fullName.toLowerCase().startsWith(title.toLowerCase())) {
    return advisor.fullName;
  }

  return `${title} ${advisor.fullName}`;
}

function summarizeMetadata(metadata: Record<string, unknown>) {
  const pairs = Object.entries(metadata).slice(0, 3);
  if (pairs.length === 0) return "No metadata recorded.";

  return pairs
    .map(([key, value]) => `${humanize(key)}: ${typeof value === "object" ? JSON.stringify(value) : String(value)}`)
    .join(" · ");
}

function validateSeatCounts(
  term: CommitteeTermClientRecord | undefined,
  roles: CommitteeRoleClientRecord[],
  assignments: CommitteeAssignmentClientRecord[]
) {
  if (!term) return [];

  const roleIds = new Set(roles.map((role) => role.id));
  const publicAssignments = assignments.filter(
    (assignment) =>
      assignment.termId === term.id &&
      roleIds.has(assignment.roleId) &&
      assignment.isPublic &&
      assignment.status !== "planned"
  );
  const messages: string[] = [];

  if (publicAssignments.length !== term.targetExecutiveSlots) {
    messages.push(
      `Public roster has ${publicAssignments.length} seats; target is ${term.targetExecutiveSlots}.`
    );
  }

  for (const role of roles) {
    const count = publicAssignments.filter((assignment) => assignment.roleId === role.id).length;
    if (count < role.minSlots || count > role.maxSlots) {
      messages.push(
        `${role.title} has ${count} assignment${count === 1 ? "" : "s"}; allowed range is ${role.minSlots}-${role.maxSlots}.`
      );
    }
  }

  const unlinked = publicAssignments.filter((assignment) => !assignment.memberId);
  if (unlinked.length > 0) {
    messages.push(`${unlinked.length} public executive assignment${unlinked.length === 1 ? "" : "s"} are not linked to member records.`);
  }

  return messages;
}

function validationCategory(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes("not linked") || normalized.includes("member record")) {
    return "Data integrity";
  }

  if (normalized.includes("date") || normalized.includes("term") || normalized.includes("confidence")) {
    return "Term configuration";
  }

  return "Roster completeness";
}

function statusClasses(value: string) {
  if (["active", "current", "ok"].includes(value)) {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  }

  if (["pending", "planned", "warning"].includes(value)) {
    return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300";
  }

  if (["completed"].includes(value)) {
    return "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300";
  }

  if (["archived", "former", "frozen"].includes(value)) {
    return "border-border bg-muted text-muted-foreground";
  }

  return "border-destructive/30 bg-destructive/10 text-destructive";
}

function Badge({ value }: { value: string }) {
  const active = ["active", "current"].includes(value);

  return (
    <span className={cx("inline-flex h-6 items-center gap-1 rounded-full border px-2 text-[11px] font-semibold", statusClasses(value))}>
      {active ? <span className="size-1.5 rounded-full bg-current" /> : null}
      {humanize(value)}
    </span>
  );
}

function VisibilityBadge({ isPublic }: { isPublic: boolean }) {
  return <Badge value={isPublic ? "active" : "frozen"} />;
}

function AdvisorTypeBadge({ isCurrent = true, type }: { isCurrent?: boolean; type: string }) {
  const formerClass = !isCurrent ? "opacity-60 line-through" : "";

  if (type === "main_advisor") {
    return (
      <span className={cx("inline-flex h-6 items-center rounded-full border border-purple-500/20 bg-purple-100 px-2 text-[11px] font-semibold text-purple-700 dark:bg-purple-950/40 dark:text-purple-300", formerClass)}>
        Chief Advisor
      </span>
    );
  }

  if (type === "moderator_mentor") {
    return (
      <span className={cx("inline-flex h-6 items-center rounded-full border border-blue-500/20 bg-blue-100 px-2 text-[11px] font-semibold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300", formerClass)}>
        Moderator/Mentor
      </span>
    );
  }

  return (
    <span className={cx("inline-flex h-6 items-center rounded-full border border-amber-500/20 bg-amber-100 px-2 text-[11px] font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300", formerClass)}>
      Honorable Advisor
    </span>
  );
}

function TermStatusBadge({ term }: { term: CommitteeTermClientRecord }) {
  if (term.isCurrent) {
    return (
      <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-emerald-600 px-2.5 text-xs font-semibold text-white shadow-sm">
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-white/70" />
          <span className="relative inline-flex size-2 rounded-full bg-white" />
        </span>
        Current
      </span>
    );
  }

  if (term.status === "archived") {
    return (
      <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-zinc-100 px-2.5 text-xs font-semibold text-zinc-500 dark:bg-zinc-800/60 dark:text-zinc-300">
        <Lock className="size-2.5" aria-hidden="true" />
        Archived
      </span>
    );
  }

  return (
    <span className="inline-flex h-7 items-center rounded-full bg-blue-100 px-2.5 text-xs font-semibold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
      Completed
    </span>
  );
}

function termRowTone(term: CommitteeTermClientRecord) {
  if (term.isCurrent) return "border-l-4 border-l-emerald-500";
  if (term.status === "archived") return "border-l-4 border-l-zinc-300 dark:border-l-zinc-700";
  return "border-l-4 border-l-blue-400";
}

function AvatarToken({ id, name, size = "sm" }: { id: string; name: string; size?: "md" | "sm" }) {
  const tones = [
    "bg-primary/10 text-primary",
    "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    "bg-amber-500/10 text-amber-700 dark:text-amber-300",
    "bg-violet-500/10 text-violet-700 dark:text-violet-300",
  ];

  return (
    <span className={cx(
      "inline-flex shrink-0 items-center justify-center rounded-full border border-background font-semibold shadow-sm",
      size === "md" ? "size-10 text-xs" : "size-7 text-[10px]",
      tones[avatarTone(id)]
    )}>
      {initials(name)}
    </span>
  );
}

function SectionShell({
  actions,
  children,
  id,
  label,
  title,
}: {
  actions?: ReactNode;
  children: ReactNode;
  id: (typeof navItems)[number][1];
  label: string;
  title: string;
}) {
  return (
    <section className="scroll-mt-28" id={id}>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-2">
          <span className="w-fit rounded-full border border-primary/15 bg-primary/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
            {label}
          </span>
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h2>
        </div>
        {actions ? <div className="flex flex-wrap items-center justify-end gap-2">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}

function TableCard({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-[0_18px_50px_color-mix(in_oklab,var(--foreground)_8%,transparent)]">
      {children}
    </div>
  );
}

function EmptyPanel({
  action,
  description,
  icon = Users,
  title,
}: {
  action?: ReactNode;
  description: string;
  icon?: LucideIcon;
  title: string;
}) {
  const Icon = icon;

  return (
    <div className="flex min-h-[220px] flex-col items-center justify-center gap-4 px-8 py-14 text-center">
      <div className="rounded-full border border-border bg-muted/50 p-5 text-muted-foreground shadow-sm">
        <Icon aria-hidden="true" size={38} />
      </div>
      <div>
        <h3 className="text-base font-semibold">{title}</h3>
        <p className="mt-1 max-w-md text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}

function GhostButton({ children, className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cx(
        "inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-border bg-background px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

function PrimaryButton({ children, className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cx(
        "inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

function SubmitButton({
  children,
  className,
  disabled,
  pendingLabel = "Saving...",
  ...props
}: {
  children: ReactNode;
  className?: string;
  pendingLabel?: string;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type">) {
  const { pending } = useFormStatus();

  return (
    <button
      className={cx(
        "inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60",
        className
      )}
      disabled={pending || disabled}
      type="submit"
      {...props}
    >
      {pending ? (
        <>
          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </button>
  );
}

function GhostSubmitButton({
  children,
  className,
  disabled,
  pendingLabel = "Saving...",
  ...props
}: {
  children: ReactNode;
  className?: string;
  pendingLabel?: string;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type">) {
  const { pending } = useFormStatus();

  return (
    <button
      className={cx(
        "inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-border bg-background px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60",
        className
      )}
      disabled={pending || disabled}
      type="submit"
      {...props}
    >
      {pending ? (
        <>
          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </button>
  );
}

function Field({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <label className={cx("flex flex-col gap-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground", className)}>
      {children}
    </label>
  );
}

function PanelInput({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cx(
        "h-9 rounded-lg border border-border bg-background px-3 py-0 leading-normal text-sm font-medium normal-case tracking-normal text-foreground shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-60",
        className
      )}
      {...props}
    />
  );
}

function PanelSelect({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cx(
        "h-9 rounded-lg border border-border bg-background px-3 py-0 leading-normal text-sm font-medium normal-case tracking-normal text-foreground shadow-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-60",
        className
      )}
      {...props}
    />
  );
}

function PanelTextarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cx(
        "min-h-[84px] rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium normal-case tracking-normal text-foreground shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/15",
        className
      )}
      {...props}
    />
  );
}

function MicroLabel({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-2 border-t border-border pt-4">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        {children}
      </span>
    </div>
  );
}

function formatDisplayDate(value: null | string) {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-BD", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function computeTenureDisplay(joinedOn: string, leftOn: string) {
  if (!joinedOn && !leftOn) return "Not set";
  return `${formatDisplayDate(joinedOn) || "Not set"} - ${formatDisplayDate(leftOn) || "Present"}`;
}

function CommitteeDateField({
  defaultValue,
  disabled,
  helper,
  name,
  onValueChange,
  required,
}: {
  defaultValue?: null | string;
  disabled?: boolean;
  helper?: string;
  name: string;
  onValueChange?: (value: string) => void;
  required?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(defaultValue || "");
  const [draft, setDraft] = useState(defaultValue || "");

  return (
    <div className="relative">
      <input name={name} required={required} type="hidden" value={value} />
      <button
        className="flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 text-left text-sm font-medium normal-case tracking-normal text-foreground shadow-sm outline-none transition-colors hover:bg-muted/40 focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={disabled}
        onClick={() => {
          setDraft(value);
          setOpen((current) => !current);
        }}
        type="button"
      >
        <span className={cx(!value && "italic text-muted-foreground")}>
          {value ? formatDisplayDate(value) : "Pick a date"}
        </span>
        <CalendarDays className="size-3.5 text-muted-foreground" aria-hidden="true" />
      </button>
      {helper ? <p className="mt-1 text-xs normal-case tracking-normal text-muted-foreground">{helper}</p> : null}
      {open ? (
        <>
          <button
            aria-label="Close date picker"
            className="fixed inset-0 z-40 cursor-default bg-transparent"
            onClick={() => setOpen(false)}
            type="button"
          />
          <div className="absolute left-0 top-[calc(100%+6px)] z-50 w-64 rounded-xl border border-border bg-popover p-3 text-popover-foreground shadow-xl">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Date</p>
            <PanelInput
              aria-label="Date in YYYY-MM-DD format"
              className="w-full"
              onChange={(event) => setDraft(event.target.value)}
              pattern="\d{4}-\d{2}-\d{2}"
              placeholder="YYYY-MM-DD"
              value={draft}
            />
            <p className="mt-2 text-xs text-muted-foreground">Use ISO format. Displayed as {draft ? formatDisplayDate(draft) : "Mar 16, 2026"}.</p>
            <div className="mt-3 flex justify-between gap-2">
              <GhostButton
                className="h-8"
                onClick={() => {
                  setDraft("");
                  setValue("");
                  onValueChange?.("");
                  setOpen(false);
                }}
                type="button"
              >
                Clear
              </GhostButton>
              <PrimaryButton
                className="h-8"
                onClick={() => {
                  setValue(draft);
                  onValueChange?.(draft);
                  setOpen(false);
                }}
                type="button"
              >
                Apply
              </PrimaryButton>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

function SwitchField({
  checkedLabel,
  defaultChecked,
  falseValue = "false",
  name,
  offLabel,
  onLabel,
  trueValue = "true",
}: {
  checkedLabel?: string;
  defaultChecked: boolean;
  falseValue?: string;
  name: string;
  offLabel: string;
  onLabel: string;
  trueValue?: string;
}) {
  const [checked, setChecked] = useState(defaultChecked);

  return (
    <div className="w-full">
      <input name={name} type="hidden" value={checked ? trueValue : falseValue} />
      <button
        aria-pressed={checked}
        className="flex w-full items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        onClick={() => setChecked((current) => !current)}
        type="button"
      >
        <span className="min-w-0">
          <span className="block text-sm font-medium normal-case tracking-normal text-foreground">{checked ? onLabel : offLabel}</span>
          {checkedLabel ? <span className="block text-xs normal-case tracking-normal text-muted-foreground">{checkedLabel}</span> : null}
        </span>
        <span
          className={cx(
            "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border p-0.5 transition-colors",
            checked ? "border-emerald-500/30 bg-emerald-500" : "border-border bg-muted"
          )}
        >
          <span className={cx("size-4 rounded-full bg-background shadow transition-transform", checked && "translate-x-5")} />
        </span>
      </button>
    </div>
  );
}

function TextareaWithCount({
  defaultValue,
  helper,
  label,
  name,
  placeholder,
  rows = 5,
}: {
  defaultValue?: string;
  helper: string;
  label: string;
  name: string;
  placeholder: string;
  rows?: number;
}) {
  const [value, setValue] = useState(defaultValue || "");
  const lineCount = value.trim() ? value.trim().split(/\r?\n/).length : 0;

  return (
    <Field>
      <span className="text-sm normal-case tracking-normal text-foreground">{label}</span>
      <PanelTextarea
        name={name}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder}
        rows={rows}
        value={value}
      />
      <span className="flex justify-between gap-3 text-xs normal-case tracking-normal text-muted-foreground">
        <span>{helper}</span>
        <span>{value.length} chars · {lineCount} lines</span>
      </span>
    </Field>
  );
}

function IconInput({
  defaultValue,
  helper,
  label,
  name,
  placeholder,
  type = "url",
}: {
  defaultValue?: null | string;
  helper?: string;
  label: string;
  name: string;
  placeholder?: string;
  type?: React.HTMLInputTypeAttribute;
}) {
  return (
    <Field>
      {label}
      <span className="relative">
        <ExternalLink className="pointer-events-none absolute left-3 top-1/2 size-3 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <PanelInput className="w-full pl-8" defaultValue={defaultValue || ""} name={name} placeholder={placeholder} type={type} />
      </span>
      {helper ? <span className="text-xs normal-case tracking-normal text-muted-foreground">{helper}</span> : null}
    </Field>
  );
}

function seatsTone(percent: number) {
  if (percent < 50) return "bg-destructive";
  if (percent < 80) return "bg-amber-500";
  return "bg-emerald-500";
}

function ProgressLine({ percent }: { percent: number }) {
  return (
    <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
      <div
        className={cx("h-full rounded-full transition-all", seatsTone(percent))}
        style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
      />
    </div>
  );
}

function MetricStrip({
  currentAdvisorsCount,
  currentTerm,
  formerAdvisorsCount,
  historyCount,
  onHistoryClick,
  validationCount,
}: {
  currentAdvisorsCount: number;
  currentTerm: CommitteeTermClientRecord | undefined;
  formerAdvisorsCount: number;
  historyCount: number;
  onHistoryClick: () => void;
  validationCount: number;
}) {
  const seatsValue = currentTerm ? `${currentTerm.assignmentCount}/${currentTerm.targetExecutiveSlots}` : "0/21";
  const seatsPercent = currentTerm?.targetExecutiveSlots
    ? (currentTerm.assignmentCount / currentTerm.targetExecutiveSlots) * 100
    : 0;
  const cells = [
    {
      icon: Clock3,
      label: "Current Term",
      value: formatOrdinal(currentTerm?.termNumber),
      sub: (
        <span className="inline-flex items-center gap-1">
          <span className="size-1.5 rounded-full bg-emerald-500" /> Active
        </span>
      ),
    },
    {
      icon: Users,
      label: "Seats Filled",
      value: seatsValue,
      sub: <ProgressLine percent={seatsPercent} />,
    },
    {
      icon: validationCount > 0 ? AlertTriangle : CheckCircle,
      label: "Validation Blockers",
      value: validationCount,
      valueClass: validationCount > 0 ? "text-destructive" : "text-emerald-600 dark:text-emerald-300",
      sub: "blocking publication",
    },
    {
      icon: GraduationCap,
      label: "Current Advisors",
      value: currentAdvisorsCount,
      sub: "serving now",
    },
    {
      icon: Archive,
      label: "Former Advisors",
      value: formerAdvisorsCount,
      sub: "in archive",
    },
    {
      icon: History,
      label: "Recent Events",
      value: historyCount,
      sub: "audit entries",
      onClick: onHistoryClick,
    },
  ];

  return (
    <div className="grid overflow-hidden rounded-2xl border border-border bg-card shadow-[0_18px_50px_color-mix(in_oklab,var(--foreground)_7%,transparent)] sm:grid-cols-2 lg:flex">
      {cells.map((cell, index) => {
        const Icon = cell.icon;
        const isValidation = cell.label === "Validation Blockers" && validationCount > 0;
        const isRecent = Boolean(cell.onClick);
        const content = (
          <div className="relative flex h-24 min-w-0 flex-col justify-center px-5 py-4">
            <div className="flex min-w-0 items-center justify-between gap-3">
              <p className={cx("truncate text-3xl font-bold leading-none tabular-nums tracking-tight", cell.valueClass, isValidation && "text-red-600 dark:text-red-400")}>{cell.value}</p>
              <Icon className={cx("size-4 shrink-0", isValidation ? "text-red-500" : "text-muted-foreground")} aria-hidden="true" />
            </div>
            <p className="mt-2 truncate text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{cell.label}</p>
            <div className="mt-0.5 truncate text-xs text-muted-foreground">{cell.sub}</div>
            {isRecent ? <ChevronRight className="absolute bottom-4 right-5 size-3.5 text-muted-foreground" aria-hidden="true" /> : null}
          </div>
        );

        if (cell.onClick) {
          return (
            <button
              className={cx(
                "min-w-0 flex-1 cursor-pointer bg-card text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 sm:m-2 sm:rounded-xl sm:bg-muted/30 lg:m-0 lg:rounded-none lg:border-r lg:border-border/50 lg:bg-card",
                index === cells.length - 1 && "lg:border-r-0"
              )}
              key={cell.label}
              onClick={cell.onClick}
              type="button"
            >
              {content}
            </button>
          );
        }

        return (
          <div
            className={cx(
              "min-w-0 flex-1 sm:m-2 sm:rounded-xl sm:bg-muted/30 lg:m-0 lg:rounded-none lg:border-r lg:border-border/50 lg:bg-card",
              isValidation && "bg-red-50 dark:bg-red-950/20",
              index === cells.length - 1 && "lg:border-r-0"
            )}
            key={cell.label}
          >
            {content}
          </div>
        );
      })}
    </div>
  );
}

function WorkspaceNav({
  activeTab,
  validationCount,
  variant,
  onSelect,
}: {
  activeTab: (typeof navItems)[number][1];
  validationCount: number;
  variant: "desktop" | "mobile";
  onSelect: (targetId: (typeof navItems)[number][1]) => void;
}) {
  if (variant === "mobile") {
    return (
      <nav className="sticky top-14 z-30 -mx-6 overflow-x-auto border-y border-border bg-background/95 px-4 py-3 backdrop-blur lg:hidden" aria-label="Committee sections">
        <div className="flex min-w-max gap-2">
          {navItems.map(([label, targetId]) => (
            <button
              className={cx(
                "inline-flex h-8 items-center gap-2 rounded-full border px-3 text-xs font-medium transition-colors",
                activeTab === targetId
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
              key={targetId}
              onClick={() => onSelect(targetId)}
              type="button"
            >
              {label}
              {targetId === "committee-validation" && validationCount > 0 ? (
                <span className="rounded-full bg-destructive px-1.5 text-[10px] text-destructive-foreground">
                  {validationCount}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </nav>
    );
  }

  return (
    <div className="sticky top-0 z-20 hidden rounded-2xl border border-border bg-card/95 px-4 py-3 shadow-sm backdrop-blur lg:block">
      <nav className="flex flex-wrap items-center gap-2" aria-label="Committee sections">
        <p className="mr-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Sections</p>
        {navItems.map(([label, targetId]) => (
          <button
            className={cx(
              "inline-flex h-9 items-center gap-2 rounded-full border px-3 text-sm transition-colors",
              activeTab === targetId
                ? "border-primary bg-primary text-primary-foreground shadow-sm"
                : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
            key={targetId}
            onClick={() => onSelect(targetId)}
            type="button"
          >
            <span>{label}</span>
            {targetId === "committee-validation" && validationCount > 0 ? (
              <span className={cx(
                "rounded-full px-1.5 text-[10px] font-semibold",
                activeTab === targetId ? "bg-primary-foreground text-primary" : "bg-destructive text-destructive-foreground"
              )}>
                {validationCount}
              </span>
            ) : null}
          </button>
        ))}
      </nav>
    </div>
  );
}

function roleGroupTitle(role: CommitteeRoleClientRecord) {
  const code = role.code.toLowerCase();
  if (["president", "vice-president", "general-secretary", "assistant-general-secretary"].includes(code)) {
    return "Leadership";
  }
  if (code.includes("executive-member")) return "Executive Members";
  return "Secretaries";
}

function RoleSlotGrid({
  roles,
  selectedRoleCounts,
}: {
  roles: CommitteeRoleClientRecord[];
  selectedRoleCounts: Map<string, number>;
}) {
  const groups = ["Leadership", "Secretaries", "Executive Members"].map((group) => ({
    group,
    roles: roles.filter((role) => roleGroupTitle(role) === group),
  }));

  return (
    <div className="flex flex-col gap-6">
      {groups.map(({ group, roles: groupRoles }) =>
        groupRoles.length > 0 ? (
          <div className="flex flex-col gap-3" key={group}>
            <div className="mb-2 mt-4 border-b border-border pb-1">
              <p className="text-xs font-semibold uppercase tracking-widest text-foreground/60">{group}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {groupRoles.map((role) => {
                const count = selectedRoleCounts.get(role.id) || 0;
                const max = Math.max(1, role.maxSlots);
                const percent = Math.min(100, (count / max) * 100);
                const complete = count >= role.minSlots && count <= role.maxSlots;
                const partial = count > 0 && !complete;
                const pending = count === 0 && role.minSlots > 0;
                const status = complete ? "Complete" : partial ? "Partial" : "Pending";

                return (
                  <article
                    className={cx(
                      "flex min-h-[112px] flex-col gap-1 rounded-xl border p-3 shadow-sm transition-colors",
                      complete && "border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/20",
                      partial && "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20",
                      pending && "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20"
                    )}
                    key={role.id}
                  >
                    <div>
                      <h3 className="line-clamp-2 text-sm font-medium leading-5">{role.title}</h3>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {role.minSlots === role.maxSlots ? `${role.minSlots} required` : `${role.minSlots}-${role.maxSlots} allowed`}
                      </p>
                    </div>
                    <div className="flex-1" />
                    <div className="flex items-center justify-between gap-3">
                      <p className={cx("text-2xl font-bold tabular-nums", complete && "text-emerald-600", partial && "text-amber-600", pending && "text-red-600")}>
                        {count}
                      </p>
                      <span className={cx(
                        "inline-flex h-6 items-center rounded-full px-2 text-xs font-semibold",
                        complete && "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
                        partial && "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
                        pending && "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300"
                      )}>
                        {status}
                      </span>
                    </div>
                    {complete ? (
                      <div className="mt-1 flex h-4 items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                        <CheckCircle className="size-3.5" aria-hidden="true" />
                        Slot range satisfied
                      </div>
                    ) : (
                      <div className={cx("mt-1 h-1 overflow-hidden rounded-full", pending ? "bg-red-200 dark:bg-red-950" : "bg-muted")}>
                        <div
                          className={cx("h-full rounded-full", partial ? "bg-amber-400" : "bg-red-200 dark:bg-red-800")}
                          style={{ width: `${partial ? percent : 0}%` }}
                        />
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </div>
        ) : null
      )}
    </div>
  );
}

function AdvisorFeatureCard({
  advisor,
  icon: Icon,
  label,
  onAdd,
}: {
  advisor?: AdvisorProfileClientRecord;
  icon: LucideIcon;
  label: string;
  onAdd: () => void;
}) {
  return (
    <article className="flex min-h-[112px] items-center gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
      {advisor ? (
        <AvatarToken id={advisor.id} name={advisor.fullName} size="md" />
      ) : (
        <span className="inline-flex size-10 items-center justify-center rounded-full border border-border bg-muted text-muted-foreground">
          <Icon aria-hidden="true" className="size-4" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
        <p className={cx("mt-1 truncate text-base font-semibold", !advisor && "italic text-muted-foreground")}>
          {advisor ? formatAdvisorDisplayName(advisor) : "Not assigned"}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">{advisor?.advisorJnuitsId || "No advisor ID"}</span>
          {advisor ? <Badge value="active" /> : null}
        </div>
      </div>
      {!advisor ? (
        <button
          aria-label={`Add ${label}`}
          className="inline-flex size-8 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground hover:bg-muted"
          onClick={onAdd}
          type="button"
        >
          <Plus className="size-4" />
        </button>
      ) : null}
    </article>
  );
}

function AdvisorHiddenFields({ advisor, nextPublic }: { advisor: AdvisorProfileClientRecord; nextPublic: boolean }) {
  return (
    <>
      <input name="advisorId" type="hidden" value={advisor.id} />
      <input name="advisorJnuitsId" type="hidden" value={advisor.advisorJnuitsId || ""} />
      <input name="advisorType" type="hidden" value={advisor.advisorType} />
      <input name="avatarSecureUrl" type="hidden" value={advisor.avatarSecureUrl || ""} />
      <input name="bio" type="hidden" value={advisor.bio || ""} />
      <input name="dateConfidence" type="hidden" value={advisor.dateConfidence} />
      <input name="department" type="hidden" value={advisor.department || ""} />
      <input name="designation" type="hidden" value={advisor.designation || ""} />
      <input name="email" type="hidden" value={advisor.email || ""} />
      <input name="facebookUrl" type="hidden" value={advisor.facebookUrl || ""} />
      <input name="formerTitle" type="hidden" value={advisor.formerTitle || ""} />
      <input name="fullName" type="hidden" value={advisor.fullName} />
      <input name="isCurrent" type="hidden" value={String(advisor.isCurrent)} />
      <input name="isPublic" type="hidden" value={String(nextPublic)} />
      <input name="jnuProfileUrl" type="hidden" value={advisor.jnuProfileUrl || ""} />
      <input name="joinedOn" type="hidden" value={advisor.joinedOn || ""} />
      <input name="leftOn" type="hidden" value={advisor.leftOn || ""} />
      <input name="linkedinUrl" type="hidden" value={advisor.linkedinUrl || ""} />
      <input name="phone" type="hidden" value={advisor.phone || ""} />
      <input name="publications" type="hidden" value={advisor.publications.join("\n")} />
      <input name="sortOrder" type="hidden" value={advisor.sortOrder} />
      <input name="speech" type="hidden" value={advisor.speech || ""} />
      <input name="statusNote" type="hidden" value={advisor.statusNote || ""} />
      <input name="tenureDisplay" type="hidden" value={advisor.tenureDisplay || ""} />
      <input name="title" type="hidden" value={advisor.title || ""} />
        <input name="websiteUrl" type="hidden" value={advisor.websiteUrl || ""} />
      <input name="workExperience" type="hidden" value={advisor.workExperience.join("\n")} />
    </>
  );
}

function DrawerPanel({
  children,
  onClose,
  title,
  width = "lg:max-w-lg",
}: {
  children: ReactNode;
  onClose: () => void;
  title: string;
  width?: string;
}) {
  const panelRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const panelElement = panelRef.current;
    if (!panelElement) return;
    const panelNode: HTMLElement = panelElement;

    const focusableSelector =
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const firstFocusable = panelNode.querySelector<HTMLElement>(focusableSelector);
    firstFocusable?.focus();

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      // A portalled confirmation owns its keyboard events, not this drawer.
      if (!(event.target instanceof Element) || event.target.closest('[role="dialog"]') !== panelNode) return;
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab") return;

      const focusable = Array.from(panelNode.querySelectorAll<HTMLElement>(focusableSelector)).filter(
        (element) => element.offsetParent !== null || element === document.activeElement
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable.at(-1);

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50">
      <button
        aria-label="Close panel backdrop"
        className="absolute inset-0 bg-background/70 backdrop-blur-sm"
        onClick={onClose}
        type="button"
      />
      <section
        aria-modal="true"
        className={cx(
          "absolute inset-x-0 bottom-0 max-h-screen overflow-y-auto rounded-t-2xl border border-border bg-card shadow-2xl transition-transform lg:inset-y-0 lg:left-auto lg:right-0 lg:max-h-none lg:w-full lg:rounded-none lg:border-y-0 lg:border-r-0",
          width
        )}
        ref={panelRef}
        role="dialog"
        tabIndex={-1}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-border bg-card/95 px-5 py-4 backdrop-blur">
          <h3 className="text-base font-semibold tracking-tight">{title}</h3>
          <button
            aria-label="Close panel"
            className="inline-flex size-8 items-center justify-center rounded-lg border border-border bg-background hover:bg-muted"
            onClick={onClose}
            type="button"
          >
            <X className="size-4" />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

function TermForm({
  onCancel,
  term,
}: {
  onCancel: () => void;
  term: CommitteeTermClientRecord | null;
}) {
  const isArchived = term?.status === "archived";
  const isCurrent = term?.isCurrent ?? false;

  return (
    <form action={saveCommitteeTerm} className="rounded-b-xl bg-card">
      {term ? (
        <div className="px-5 pt-4">
          <span className="inline-flex rounded-t-md bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
            Editing: {term.title}
          </span>
        </div>
      ) : null}
      <div className="border-b border-border px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="inline-flex size-9 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-sm font-bold text-primary">
              {term?.termNumber || "EC"}
            </span>
            <div className="min-w-0">
              <h3 className="truncate text-base font-semibold">{term?.title || "New Executive Committee Term"}</h3>
              <p className="text-xs text-muted-foreground">{term?.slug || "Draft term"}</p>
            </div>
            {term ? <TermStatusBadge term={term} /> : null}
          </div>
          <GhostButton onClick={onCancel} type="button">
            <X className="size-3.5" aria-hidden="true" /> Close
          </GhostButton>
        </div>
      </div>
      <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
        <input name="termId" type="hidden" value={term?.id || ""} />
        <Field className="xl:col-span-2">
          Title
          <PanelInput name="title" defaultValue={term?.title || ""} placeholder="6th Executive Committee" required />
        </Field>
        <Field>
          Slug
          <span className="relative">
            <PanelInput
              className={isCurrent ? "bg-muted/40 pr-8" : "pr-8"}
              disabled={isCurrent}
              name="slug"
              defaultValue={term?.slug || ""}
              placeholder="6th-executive-committee"
              title={isCurrent ? "Cannot change slug of the active term." : undefined}
            />
            <Lock className="pointer-events-none absolute right-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          </span>
          {isCurrent ? <input name="slug" type="hidden" value={term?.slug || ""} /> : null}
        </Field>
        <Field>
          Status
          <PanelSelect name="status" defaultValue={term?.status || "draft"}>
            <option value="draft">Draft</option>
            <option value="upcoming">Upcoming</option>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
          </PanelSelect>
        </Field>
        <Field>
          Date confidence
          <PanelSelect name="dateConfidence" defaultValue={term?.dateConfidence || "verified"}>
            <option value="verified">Verified</option>
            <option value="estimated">Estimated</option>
          </PanelSelect>
        </Field>
        <Field>
          Target seats
          <PanelInput name="targetExecutiveSlots" defaultValue={term?.targetExecutiveSlots || 21} min={1} max={60} type="number" />
        </Field>
        <Field>
          Starts on
          <CommitteeDateField name="startsOn" defaultValue={term?.startsOn || ""} required />
        </Field>
        <Field>
          Ends on
          <CommitteeDateField
            name="endsOn"
            defaultValue={term?.endsOn || ""}
            disabled={isCurrent}
            helper={isCurrent ? "Active term has no end date yet." : undefined}
          />
        </Field>
        <Field>
          Election date
          <CommitteeDateField name="electionDate" defaultValue={term?.electionDate || ""} />
        </Field>
        {(term?.dateConfidence || "verified") === "estimated" ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-200 md:col-span-2 xl:col-span-3">
            These dates are estimates and will be shown with a prefix on public pages.
          </div>
        ) : null}
        <div className="grid gap-3 md:col-span-2 xl:col-span-3 xl:grid-cols-2">
          <div className="rounded-xl border border-border bg-muted/20 p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Mark as current term</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">Only one executive term can be current at a time.</p>
              </div>
              {isArchived ? (
                <>
                  <input name="isCurrent" type="hidden" value="false" />
                  <span className="inline-flex h-6 w-11 items-center rounded-full border border-border bg-muted p-0.5 opacity-50">
                    <span className="size-4 rounded-full bg-background shadow" />
                  </span>
                </>
              ) : (
                <SwitchField defaultChecked={isCurrent} name="isCurrent" offLabel="Not current" onLabel="Current" />
              )}
            </div>
            {isArchived ? <p className="mt-2 text-xs text-muted-foreground">Archived terms cannot be set as current.</p> : null}
            {!isCurrent && !isArchived ? <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">Turning this on removes current status from the existing active term.</p> : null}
          </div>
          <div className="rounded-xl border border-border bg-muted/20 p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Publicly visible</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">Visible on /committee and executive history.</p>
              </div>
              <SwitchField defaultChecked={term?.isPublic ?? true} name="isPublic" offLabel="Internal" onLabel="Public" />
            </div>
            {isCurrent ? <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">The current term should remain public.</p> : null}
          </div>
        </div>
        <input name="termKind" type="hidden" value="executive" />
        <div className="rounded-lg border border-blue-200/70 bg-blue-50/40 p-3 dark:border-blue-900/60 dark:bg-blue-950/10 md:col-span-2 xl:col-span-3">
          <Field>
            <span className="inline-flex items-center gap-2 text-foreground"><CalendarDays className="size-3.5" aria-hidden="true" /> Tenure note</span>
            <PanelTextarea name="tenureNote" defaultValue={term?.tenureNote || ""} placeholder="Jul 2025 - Present" rows={3} />
            <span className="text-xs normal-case tracking-normal text-muted-foreground">Auto-formatted tenure string shown on the public page.</span>
          </Field>
        </div>
        <div className="rounded-lg border border-border bg-muted/30 p-3 md:col-span-2 xl:col-span-3">
          <Field>
            <span className="inline-flex items-center gap-2 text-foreground"><Lock className="size-3.5" aria-hidden="true" /> Internal notes</span>
            <PanelTextarea name="voterRuleNote" defaultValue={term?.voterRuleNote || ""} placeholder="Internal notes for admins. Not shown publicly." rows={3} />
            <span className="text-xs normal-case tracking-normal text-muted-foreground">Admin-only. Never displayed publicly.</span>
          </Field>
        </div>
        <div className="rounded-lg border border-emerald-200/70 bg-emerald-50/40 p-3 dark:border-emerald-900/60 dark:bg-emerald-950/10 md:col-span-2 xl:col-span-3">
          <Field>
            <span className="inline-flex items-center gap-2 text-foreground"><Globe2 className="size-3.5" aria-hidden="true" /> Public summary</span>
            <PanelTextarea name="summary" defaultValue={term?.summary || ""} placeholder="Current executive committee of JnU IT Society." rows={3} />
            <span className="text-xs normal-case tracking-normal text-muted-foreground">Shown in OpenGraph metadata and archive listings.</span>
          </Field>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-border bg-muted/20 px-5 py-4">
        <button
          className="text-xs font-medium text-muted-foreground hover:text-foreground"
          onClick={() => document.getElementById("committee-roster")?.scrollIntoView({ behavior: "smooth", block: "start" })}
          type="button"
        >
          {term?.assignmentCount || 0} assignments linked
        </button>
        <div className="flex gap-2">
          <SubmitButton>Save changes</SubmitButton>
          <GhostButton onClick={onCancel} type="button">Cancel</GhostButton>
        </div>
      </div>
    </form>
  );
}

function AssignmentForm({
  assignment,
  executiveRoles,
  onCancel,
  selectedRoleCounts,
  selectedTerm,
}: {
  assignment: CommitteeAssignmentClientRecord | null;
  executiveRoles: CommitteeRoleClientRecord[];
  onCancel: () => void;
  selectedRoleCounts: Map<string, number>;
  selectedTerm: CommitteeTermClientRecord | undefined;
}) {
  const initialMember: CommitteeMemberSearchOption | null = assignment?.memberId
    ? {
        email: assignment.email,
        fullName: assignment.memberName || assignment.displayName || "Linked member",
        id: assignment.memberId,
        jnuitsId: assignment.jnuitsId,
        lifecycleStatus:
          assignment.memberLifecycleStatus || assignment.memberType || "current",
        memberType: assignment.memberType || assignment.memberLifecycleStatus || "current",
      }
    : null;
  const [selectedMember, setSelectedMember] = useState<CommitteeMemberSearchOption | null>(
    initialMember
  );
  const [selectedRoleId, setSelectedRoleId] = useState(assignment?.roleId || "");
  const [isPublic, setIsPublic] = useState(assignment?.isPublic ?? true);
  const status = assignment?.status || "active";
  const [showAdvanced, setShowAdvanced] = useState(false);
  const selectedRole = executiveRoles.find((role) => role.id === selectedRoleId);
  const roleGroups = ["Leadership", "Secretaries", "Executive Members"].map((group) => ({
    group,
    roles: executiveRoles.filter((role) => roleGroupTitle(role) === group),
  }));
  const selectedRoleCount = selectedRole ? selectedRoleCounts.get(selectedRole.id) || 0 : 0;
  const selectedRoleAvailable = selectedRole
    ? Math.max(0, selectedRole.maxSlots - selectedRoleCount)
    : 0;

  return (
    <form action={saveCommitteeAssignment} className="flex min-h-[calc(100vh-64px)] flex-col">
      <div className="flex flex-1 flex-col gap-5 p-5">
        <input name="assignmentId" type="hidden" value={assignment?.id || ""} />
        <MicroLabel>Member</MicroLabel>
        <div className="grid gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Member lookup
          </p>
          <CommitteeMemberSearch
            initialMember={initialMember}
            onSelect={setSelectedMember}
          />
          <span className="text-xs text-muted-foreground">
            Search is paginated on the server. Lifecycle comes from Membership DB and is read-only here.
          </span>
        </div>
        {selectedMember ? (
          <>
            <input name="displayName" type="hidden" value="" />
            <p className="inline-flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
              <Info className="size-3.5" aria-hidden="true" />
              Lifecycle is managed in Membership DB.
              <a className="font-medium text-primary hover:underline" href="/admin/membership" rel="noreferrer" target="_blank">
                View profile →
              </a>
            </p>
          </>
        ) : (
          <Field>
            Historical display name
            <PanelInput name="displayName" defaultValue={assignment?.displayName || ""} placeholder="Used only when no member record is linked" />
            <span className="text-xs normal-case tracking-normal text-muted-foreground">
              Used only for historical rosters that cannot be linked to a member record.
            </span>
          </Field>
        )}
        <MicroLabel>Role & Term</MicroLabel>
        <Field>
          Role
          <PanelSelect name="roleId" onChange={(event) => setSelectedRoleId(event.target.value)} required value={selectedRoleId}>
            <option value="">Select role</option>
            {roleGroups.map(({ group, roles }) =>
              roles.length ? (
                <optgroup key={group} label={`-- ${group.toUpperCase()} --`}>
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.title} · {role.minSlots === role.maxSlots ? `${role.minSlots} slot` : `${role.minSlots}-${role.maxSlots} slots`}
                    </option>
                  ))}
                </optgroup>
              ) : null
            )}
          </PanelSelect>
        </Field>
        {selectedRole ? (
          <div className={cx(
            "rounded-lg border px-3 py-2 text-sm",
            selectedRoleAvailable > 0
              ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-200"
              : "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-200"
          )}>
            {selectedRoleAvailable > 0
              ? `${selectedRoleAvailable} of ${selectedRole.maxSlots} slots available`
              : "All slots filled - adding will exceed the limit"}
          </div>
        ) : null}
        <Field>
          Term
          <input name="termId" type="hidden" value={assignment?.termId || selectedTerm?.id || ""} />
          <div className="flex h-9 items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 text-sm normal-case tracking-normal text-foreground">
            <Lock className="size-3.5 text-muted-foreground" aria-hidden="true" />
            {selectedTerm?.title || "Select a term from the roster header"}
          </div>
          <span className="text-xs normal-case tracking-normal text-muted-foreground">Term is set by the roster context. Change term from the roster section header.</span>
        </Field>

        <CommitteeLeadershipSpeechField roleCode={selectedRole?.code} speech={assignment?.speech || null} />
        <MicroLabel>Status & Visibility</MicroLabel>
        <div className="grid gap-3 sm:grid-cols-2">
          <SwitchField
            defaultChecked={status === "active"}
            falseValue="completed"
            name="status"
            offLabel="Inactive"
            onLabel="Active"
            trueValue="active"
          />
          <div className="w-full">
            <input name="isPublic" type="hidden" value={String(isPublic)} />
            <button
              aria-pressed={isPublic}
              className="flex w-full items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              onClick={() => setIsPublic((current) => !current)}
              type="button"
            >
              <span>
                <span className="block text-sm font-medium">{isPublic ? "Public" : "Internal only"}</span>
                <span className="block text-xs text-muted-foreground">{isPublic ? "Shown on public committee page" : "Stored for internal records only"}</span>
              </span>
              <span className={cx("inline-flex h-6 w-11 items-center rounded-full border p-0.5 transition-colors", isPublic ? "border-emerald-500/30 bg-emerald-500" : "border-border bg-muted")}>
                <span className={cx("size-4 rounded-full bg-background shadow transition-transform", isPublic && "translate-x-5")} />
              </span>
            </button>
          </div>
        </div>
        {isPublic ? (
          <Field>
            Public title override
            <PanelInput name="publicTitleOverride" defaultValue={assignment?.publicTitleOverride || ""} placeholder="Leave blank to use default role name" />
            <span className="text-xs normal-case tracking-normal text-muted-foreground">Overrides the displayed role label on the public committee page only.</span>
          </Field>
        ) : <input name="publicTitleOverride" type="hidden" value={assignment?.publicTitleOverride || ""} />}

        <button
          className="flex items-center justify-between rounded-lg border border-border bg-muted/20 px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted/40"
          onClick={() => setShowAdvanced((current) => !current)}
          type="button"
        >
          Advanced options
          <ChevronRight className={cx("size-4 transition-transform", showAdvanced && "rotate-90")} aria-hidden="true" />
        </button>
        {showAdvanced ? (
          <div className="grid gap-4 rounded-xl border border-border bg-muted/20 p-4 md:grid-cols-2">
            <Field>
              Display order
              <PanelInput name="sortOrder" defaultValue={assignment?.sortOrder ?? 100} min={0} type="number" />
              <span className="text-xs normal-case tracking-normal text-muted-foreground">Lower numbers appear first within the same role group.</span>
            </Field>
            <div />
            <Field>
              Starts on
              <CommitteeDateField name="startsOn" defaultValue={assignment?.startsOn || ""} helper="Overrides term dates for this assignment." />
            </Field>
            <Field>
              Ends on
              <CommitteeDateField name="endsOn" defaultValue={assignment?.endsOn || ""} helper="Overrides term dates for this assignment." />
            </Field>
            <Field className="md:col-span-2">
              Notes
              <PanelTextarea name="bio" defaultValue={assignment?.bio || ""} placeholder="Internal notes for this committee assignment" rows={4} />
            </Field>
          </div>
        ) : (
          <>
            <input name="sortOrder" type="hidden" value={assignment?.sortOrder ?? 100} />
            <input name="startsOn" type="hidden" value={assignment?.startsOn || ""} />
            <input name="endsOn" type="hidden" value={assignment?.endsOn || ""} />
            <input name="bio" type="hidden" value={assignment?.bio || ""} />
          </>
        )}
      </div>
      <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-border bg-card px-5 py-4">
        <SubmitButton>Save</SubmitButton>
        <GhostButton onClick={onCancel} type="button">Cancel</GhostButton>
      </div>
    </form>
  );
}


function AdvisorForm({
  advisor,
  departmentOptions = [],
  initialTab = "profile",
  onCancel,
}: {
  advisor: AdvisorProfileClientRecord | null;
  departmentOptions?: readonly MemberDepartmentOption[];
  initialTab?: "profile" | "access";
  onCancel: () => void;
}) {
  const [activePanel, setActivePanel] = useState<"access" | "content" | "profile">(initialTab);
  const [advisorType, setAdvisorType] = useState(advisor?.advisorType || "honorable_advisor");
  const [avatarUrl, setAvatarUrl] = useState(advisor?.avatarSecureUrl || "");
  const [joinedOn, setJoinedOn] = useState(advisor?.joinedOn || "");
  const [leftOn, setLeftOn] = useState(advisor?.leftOn || "");
  const datesUnchanged = joinedOn === (advisor?.joinedOn || "") && leftOn === (advisor?.leftOn || "");
  const computedTenure = (datesUnchanged && advisor?.tenureDisplay) || computeTenureDisplay(joinedOn, leftOn);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const linkFormId = advisor ? `advisor-link-${advisor.id}` : "advisor-link-new";
  const advisorDepartmentOptions = useMemo(
    () => buildAdvisorDepartmentOptions(departmentOptions, advisor?.department),
    [departmentOptions, advisor?.department]
  );
  const avatarToneClass =
    advisorType === "main_advisor"
      ? "bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300"
      : advisorType === "moderator_mentor"
        ? "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
        : "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300";

  return (
    <div className="flex min-h-[calc(100vh-72px)] flex-col">
      {advisor ? (
        <form action={linkAdvisorAuthUser} id={linkFormId}>
          <input name="advisorId" type="hidden" value={advisor.id} />
        </form>
      ) : null}
      <div className="border-b border-border bg-card px-5 py-4">
        <div className="flex items-center gap-3">
          {avatarUrl ? (
            <span
              aria-label="Advisor avatar preview"
              className="size-10 rounded-full border border-border bg-cover bg-center"
              role="img"
              style={{ backgroundImage: `url("${avatarUrl}")` }}
            />
          ) : (
            <span className={cx("inline-flex size-10 items-center justify-center rounded-full text-xs font-bold", avatarToneClass)}>
              {initials(advisor?.fullName || "Advisor")}
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{advisor ? formatAdvisorDisplayName(advisor) : "New advisor profile"}</p>
            <p className="text-xs text-muted-foreground">{advisor?.advisorJnuitsId || "Advisor ID will be allocated"}</p>
          </div>
        </div>
      </div>
      <form action={saveAdvisorProfile} className="flex min-h-0 flex-1 flex-col">
        <div className="sticky top-[73px] z-10 flex border-b border-border bg-card/95 px-5 backdrop-blur">
          {(["profile", "content", "access"] as const).map((tab) => (
            <button
              aria-selected={activePanel === tab}
              className={cx(
                "h-11 border-b-2 px-3 text-sm font-medium capitalize transition-colors",
                activePanel === tab
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
              key={tab}
              onClick={() => setActivePanel(tab)}
              role="tab"
              type="button"
            >
              {tab}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className={cx("flex flex-col gap-6", activePanel !== "profile" && "hidden")}>
            <input name="advisorId" type="hidden" value={advisor?.id || ""} />
            <div className="rounded-xl border border-border bg-muted/20 p-4">
              <div className="flex items-center gap-4">
                {avatarUrl ? (
                  <span
                    aria-label="Advisor avatar preview"
                    className="size-16 rounded-full border border-border bg-cover bg-center"
                    role="img"
                    style={{ backgroundImage: `url("${avatarUrl}")` }}
                  />
                ) : (
                  <span className={cx("inline-flex size-16 items-center justify-center rounded-full text-base font-bold", avatarToneClass)}>
                    {initials(advisor?.fullName || "Advisor")}
                  </span>
                )}
                <Field className="flex-1">
                  Avatar URL
                  <PanelInput
                    name="avatarSecureUrl"
                    onChange={(event) => setAvatarUrl(event.target.value)}
                    placeholder="https://..."
                    type="url"
                    value={avatarUrl}
                  />
                </Field>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Field>
                Advisor JnUITS ID
                <span className="relative">
                  <PanelInput
                    className={advisor?.advisorJnuitsId ? "bg-muted/40 pr-8" : "pr-8"}
                    defaultValue={advisor?.advisorJnuitsId || ""}
                    disabled={Boolean(advisor?.advisorJnuitsId)}
                    name="advisorJnuitsId"
                    placeholder="Auto assigned, e.g. JNUITS-CA0001"
                    title={advisor?.advisorJnuitsId ? "ID cannot be changed after creation." : undefined}
                  />
                  <Lock className="pointer-events-none absolute right-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                </span>
                {advisor?.advisorJnuitsId ? <input name="advisorJnuitsId" type="hidden" value={advisor.advisorJnuitsId} /> : null}
              </Field>
              <Field>
                Full name
                <PanelInput name="fullName" defaultValue={advisor?.fullName || ""} required />
              </Field>
              <Field>
                Advisor type
                <PanelSelect name="advisorType" onChange={(event) => setAdvisorType(event.target.value)} value={advisorType}>
                  <option value="main_advisor">● Chief Advisor</option>
                  <option value="moderator_mentor">● Moderator / Mentor</option>
                  <option value="honorable_advisor">● Honorable Advisor</option>
                </PanelSelect>
              </Field>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs font-semibold">Portal access</p>
                <p className="mt-1 text-xs text-muted-foreground">{advisor?.userId ? "A portal account is already linked." : "No portal account is linked."} Manage linking in the Access tab.</p>
                <GhostButton className="mt-2" onClick={() => setActivePanel("access")} type="button">Open Access settings</GhostButton>
              </div>
              <Field>
                Title
                <PanelInput name="title" defaultValue={advisor?.title || ""} placeholder="Professor Dr." />
              </Field>
              <Field>
                Former title
                <PanelInput name="formerTitle" defaultValue={advisor?.formerTitle || ""} placeholder="Former Chief Advisor" />
              </Field>
              <Field>
                Department
                <PanelSelect name="department" defaultValue={advisor?.department?.trim() || ""}>
                  <option value="">Choose a department</option>
                  {advisorDepartmentOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </PanelSelect>
              </Field>
              <Field>
                Designation
                <PanelInput name="designation" defaultValue={advisor?.designation || ""} placeholder="Vice Chancellor, Jagannath University" />
              </Field>
              <Field>
                Email
                <PanelInput name="email" defaultValue={advisor?.email || ""} type="email" />
              </Field>
              <Field>
                Phone
                <PanelInput name="phone" defaultValue={advisor?.phone || ""} type="tel" />
              </Field>
            </div>

            <MicroLabel>Tenure</MicroLabel>
            <div className="grid gap-4 md:grid-cols-2">
              <Field>
                Joined on
                <CommitteeDateField name="joinedOn" defaultValue={advisor?.joinedOn || ""} onValueChange={setJoinedOn} />
              </Field>
              <Field>
                Left on
                <CommitteeDateField name="leftOn" defaultValue={advisor?.leftOn || ""} onValueChange={setLeftOn} />
              </Field>
              <Field>
                Tenure display
                <input name="tenureDisplay" type="hidden" value={computedTenure === "Not set" ? "" : computedTenure} />
                <div className="flex h-9 items-center rounded-lg border border-border bg-muted/40 px-3 text-sm font-medium normal-case tracking-normal text-foreground">
                  {computedTenure}
                </div>
              </Field>
              <Field>
                Date confidence
                <PanelSelect name="dateConfidence" defaultValue={advisor?.dateConfidence || "verified"}>
                  <option value="verified">Verified</option>
                  <option value="estimated">Estimated</option>
                </PanelSelect>
                {(advisor?.dateConfidence || "verified") === "estimated" ? (
                  <span className="rounded-full bg-amber-100 px-2 py-1 text-xs normal-case tracking-normal text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                    Displayed with a prefix on public profile.
                  </span>
                ) : null}
              </Field>
            </div>

            <MicroLabel>Status</MicroLabel>
            <div className="grid gap-4 md:grid-cols-2">
              <SwitchField defaultChecked={advisor?.isCurrent ?? true} name="isCurrent" offLabel="Former advisor" onLabel="Currently serving" />
              <SwitchField defaultChecked={advisor?.isPublic ?? true} name="isPublic" offLabel="Hidden from public" onLabel="Public profile" />
              <Field>
                Display order
                <PanelInput name="sortOrder" defaultValue={advisor?.sortOrder ?? 100} min={0} type="number" />
                <span className="text-xs normal-case tracking-normal text-muted-foreground">Lower numbers appear first.</span>
              </Field>
              <Field className="md:col-span-2">
                Status note
                <PanelTextarea
                  name="statusNote"
                  defaultValue={advisor?.statusNote || ""}
                  placeholder="e.g. Current Vice Chancellor; previously a professor in the Department of Islamic Studies."
                  rows={3}
                />
              </Field>
            </div>
          </div>

          <div className={cx("flex flex-col gap-5", activePanel !== "content" && "hidden")}>
            <TextareaWithCount
              defaultValue={advisor?.speech || ""}
              helper="Displayed as a featured quote on the public committee page."
              label="Speech / Message"
              name="speech"
              placeholder="Write a short message from the advisor to members..."
              rows={5}
            />
            <TextareaWithCount
              defaultValue={advisor?.bio || ""}
              helper="Shown in the advisor's profile card."
              label="Bio"
              name="bio"
              placeholder="Current Chief Advisor by virtue of serving as Vice Chancellor of Jagannath University."
              rows={5}
            />
            <TextareaWithCount
              defaultValue={(advisor?.workExperience || []).join("\n")}
              helper="One position per line. Shown in advisor detail view."
              label="Work Experience"
              name="workExperience"
              placeholder={"Vice Chancellor, Jagannath University (2024-Present)\nProfessor, Dept. of Islamic Studies (2010-2024)"}
              rows={5}
            />
            <TextareaWithCount
              defaultValue={(advisor?.publications || []).join("\n")}
              helper="One publication per line."
              label="Publications"
              name="publications"
              placeholder={"Title of Publication (Year) - Journal/Publisher\nAnother Publication (Year)"}
              rows={5}
            />
          </div>

          <div className={cx("flex flex-col gap-5", activePanel !== "access" && "hidden")}>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-100">
              Advisor accounts are separate from member accounts. Linking a portal user here grants advisor-specific portal access, not admin access.
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <IconInput name="facebookUrl" label="Facebook URL" defaultValue={advisor?.facebookUrl} placeholder="https://facebook.com/..." />
              <IconInput name="linkedinUrl" label="LinkedIn URL" defaultValue={advisor?.linkedinUrl} placeholder="https://linkedin.com/in/..." />
              <IconInput name="websiteUrl" label="Website URL" defaultValue={advisor?.websiteUrl} placeholder="https://..." />
              <IconInput name="jnuProfileUrl" label="JnU Profile URL" defaultValue={advisor?.jnuProfileUrl} helper="Used on public advisor card." placeholder="https://profile.jnu.ac.bd/..." />
            </div>
            <MicroLabel>Portal login link</MicroLabel>
            {advisor?.userId ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900 dark:bg-emerald-950/20">
                <span className="inline-flex items-center gap-2 text-sm font-medium text-emerald-800 dark:text-emerald-200">
                  <CheckCircle className="size-4" aria-hidden="true" /> Portal account linked
                </span>
                <GhostButton disabled type="button">Unlink</GhostButton>
              </div>
            ) : advisor ? (
              <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
                <Field>
                  Advisor login email
                  <PanelInput
                    form={linkFormId}
                    name="email"
                    defaultValue={advisor.email || ""}
                    placeholder="advisor@jnu.ac.bd"
                    type="email"
                  />
                </Field>
                <ConfirmSubmitButton form={linkFormId} className="h-9 rounded-lg border border-border px-3 text-sm" title="Link advisor portal account?" confirmLabel="Link account" description="This links the existing account with the entered email to this advisor profile and grants advisor portal access. It does not grant admin access.">Link auth user</ConfirmSubmitButton>
                <p className="text-xs normal-case tracking-normal text-muted-foreground md:col-span-2">
                  Looks up an existing Supabase Auth user by email and links them to this advisor profile for portal routing.
                </p>
              </div>
            ) : (
              <p className="rounded-xl border border-border bg-muted/20 p-3 text-sm text-muted-foreground">
                Save the advisor profile before linking a portal user.
              </p>
            )}
          </div>
        </div>
        <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-border bg-card px-5 py-4">
          <SubmitButton>Save advisor</SubmitButton>
          <GhostButton onClick={onCancel} type="button">Cancel</GhostButton>
        </div>
      </form>
      {advisor ? (
        <div className="border-t border-border px-5 py-4">
          {confirmArchive ? (
            <form action={archiveAdvisorProfile} className="space-y-3">
              <input name="advisorId" type="hidden" value={advisor.id} />
              <p className="text-sm text-muted-foreground">Remove this advisor from the public board and history? The profile and portal account will be preserved. Edit visibility to restore publication.</p>
              <div className="flex flex-wrap gap-3">
                <GhostSubmitButton>Confirm archive</GhostSubmitButton>
                <GhostButton type="button" onClick={() => setConfirmArchive(false)}>Keep advisor</GhostButton>
              </div>
            </form>
          ) : <GhostButton type="button" onClick={() => setConfirmArchive(true)}>Archive advisor</GhostButton>}
        </div>
      ) : null}
    </div>
  );
}

function historyCategory(action: string) {
  if (action.includes("term")) return "Terms";
  if (action.includes("advisor")) return "Advisors";
  if (action.includes("import")) return "Imports";
  if (action.includes("assignment")) return "Roster";
  return "Publication";
}

function historyActionKind(action: string) {
  const normalized = action.toLowerCase();
  if (normalized.includes("delete")) return "deleted";
  if (normalized.includes("archive")) return "archived";
  if (normalized.includes("import")) return "imported";
  if (normalized.includes("create") || normalized.includes("seed")) return "created";
  return "updated";
}

function HistoryActionPill({ action }: { action: string }) {
  const kind = historyActionKind(action);
  const classes = {
    archived: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
    created: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
    deleted: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300",
    imported: "bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300",
    updated: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  } satisfies Record<string, string>;

  return (
    <span className={cx("inline-flex h-6 items-center rounded-full px-2 text-[11px] font-semibold capitalize", classes[kind])}>
      {kind}
    </span>
  );
}

function metadataEntries(metadata: Record<string, unknown>) {
  return Object.entries(metadata).filter(([, value]) => value !== null && value !== undefined);
}

function valueToText(value: unknown) {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value === null || value === undefined) return "—";
  return JSON.stringify(value);
}

function DiffSummary({ action, metadata }: { action: string; metadata: Record<string, unknown> }) {
  const kind = historyActionKind(action);
  const count = metadataEntries(metadata).length;

  if (kind === "created") {
    return <span className="inline-flex h-7 items-center rounded-full bg-emerald-100 px-2.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">New record created</span>;
  }

  if (kind === "archived" || kind === "deleted") {
    return <span className="inline-flex h-7 items-center rounded-full bg-amber-100 px-2.5 text-xs font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">Record archived</span>;
  }

  return <span className="inline-flex h-7 items-center rounded-full bg-muted px-2.5 text-xs font-semibold text-muted-foreground">{Math.max(1, count)} fields changed</span>;
}

function ExpandedDiff({ metadata }: { metadata: Record<string, unknown> }) {
  const entries = metadataEntries(metadata);

  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">No structured metadata recorded.</p>;
  }

  return (
    <div className="grid gap-2">
      {entries.map(([key, value]) => {
        const maybeObject = typeof value === "object" && value !== null ? value as Record<string, unknown> : null;
        const before = maybeObject && ("before" in maybeObject || "old" in maybeObject)
          ? maybeObject.before ?? maybeObject.old
          : null;
        const after = maybeObject && ("after" in maybeObject || "new" in maybeObject)
          ? maybeObject.after ?? maybeObject.new
          : value;

        return (
          <div className="rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs" key={key}>
            <span className="font-semibold text-foreground">{humanize(key)}:</span>{" "}
            {before !== null ? (
              <>
                <span className="text-red-600 line-through dark:text-red-400">{valueToText(before)}</span>
                <span className="mx-2 text-muted-foreground">→</span>
              </>
            ) : null}
            <span className="text-emerald-700 dark:text-emerald-300">{valueToText(after)}</span>
          </div>
        );
      })}
    </div>
  );
}

export function CommitteeWorkspaceClient({
  advisors,
  assignments,
  departmentOptions = [],
  flash,
  history,
  positions,
  roles,
  terms,
}: CommitteeWorkspaceClientProps) {
  const initialTermId =
    terms.find((term) => term.termKind === "executive" && term.isCurrent)?.id ||
    terms.find((term) => term.slug === "6th-executive-committee")?.id ||
    terms[0]?.id ||
    null;
  const [activeTab, setActiveTab] = useState<(typeof navItems)[number][1]>("committee-terms");
  const [search, setSearch] = useState("");
  const [selectedTermId, setSelectedTermId] = useState<string | null>(initialTermId);
  const [editingAssignmentId, setEditingAssignmentId] = useState<string | null>(null);
  const [editingAdvisorId, setEditingAdvisorId] = useState<string | null>(null);
  const [editingAdvisorInitialTab, setEditingAdvisorInitialTab] = useState<"profile" | "access">("profile");
  const advisorTriggerRef = useRef<HTMLElement | null>(null);
  const [advisorSearch, setAdvisorSearch] = useState("");
  const [advisorTypeFilter, setAdvisorTypeFilter] = useState("");
  const [advisorStatusFilter, setAdvisorStatusFilter] = useState("");
  const [termFormId, setTermFormId] = useState<string | null>(null);
  const [showNewTerm, setShowNewTerm] = useState(false);
  const [showNewAssignment, setShowNewAssignment] = useState(false);
  const [showNewAdvisor, setShowNewAdvisor] = useState(false);
  const [selectedAssignmentIds, setSelectedAssignmentIds] = useState<Set<string>>(
    () => new Set()
  );
  const [historyFilter, setHistoryFilter] = useState("");
  const [historySearch, setHistorySearch] = useState("");
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
  const [actionMenu, setActionMenu] = useState<FloatingActionMenu>(null);
  const [dismissedFlashId, setDismissedFlashId] = useState<null | string>(null);
  const [expandedValidationGroups, setExpandedValidationGroups] = useState<Set<string>>(
    () => new Set()
  );
  const [roleMatrixFilter, setRoleMatrixFilter] = useState<"all" | "complete" | "pending">("all");

  useEffect(() => {
    if (!flash) return;
    const flashId = `${flash.title}:${flash.message}`;
    const timeoutId = window.setTimeout(() => setDismissedFlashId(flashId), 4000);
    return () => window.clearTimeout(timeoutId);
  }, [flash]);

  const currentTerm =
    terms.find((term) => term.termKind === "executive" && term.isCurrent) ||
    terms.find((term) => term.slug === "6th-executive-committee") ||
    terms[0];
  const selectedTerm = terms.find((term) => term.id === selectedTermId) || currentTerm;
  const executiveRoles = useMemo(
    () => rolesForCommitteeTerm({ positions, roles, termId: selectedTerm?.id }),
    [positions, roles, selectedTerm?.id]
  );
  const executiveRoleIds = useMemo(
    () => new Set(executiveRoles.map((role) => role.id)),
    [executiveRoles]
  );
  const executiveRoleById = useMemo(
    () => new Map(executiveRoles.map((role) => [role.id, role])),
    [executiveRoles]
  );
  const termAssignments = useMemo(
    () =>
      selectedTerm
        ? sortCommitteeAssignmentsByTermRoles(
            assignments.filter(
              (assignment) =>
                assignment.termId === selectedTerm.id &&
                executiveRoleIds.has(assignment.roleId)
            ),
            executiveRoles
          )
        : [],
    [assignments, executiveRoleIds, executiveRoles, selectedTerm]
  );
  const filteredAssignments = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return termAssignments;
    return termAssignments.filter((assignment) =>
      [
        assignment.memberName,
        assignment.displayName,
        assignment.jnuitsId,
        assignment.email,
        executiveRoleById.get(assignment.roleId)?.title,
        assignment.roleTitle,
        assignment.termTitle,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle))
    );
  }, [executiveRoleById, search, termAssignments]);
  const selectedVisibleAssignmentCount = filteredAssignments.filter((assignment) =>
    selectedAssignmentIds.has(assignment.id)
  ).length;

  const selectedAssignment =
    assignments.find((assignment) => assignment.id === editingAssignmentId) || null;
  const advisorTypeOptions = useMemo(
    () => Array.from(new Set(advisors.map((advisor) => advisor.advisorType))).sort(),
    [advisors]
  );
  const filteredAdvisors = useMemo(() => {
    const needle = advisorSearch.trim().toLowerCase();
    return advisors.filter((advisor) => {
      if (advisorTypeFilter && advisor.advisorType !== advisorTypeFilter) return false;
      if (advisorStatusFilter === "current" && !advisor.isCurrent) return false;
      if (advisorStatusFilter === "former" && advisor.isCurrent) return false;
      if (!needle) return true;

      return [
        advisor.fullName,
        advisor.advisorJnuitsId,
        advisor.email,
        advisor.department,
        advisor.designation,
        advisor.title,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle));
    });
  }, [advisorSearch, advisorStatusFilter, advisorTypeFilter, advisors]);
  const selectedAdvisor = advisors.find((advisor) => advisor.id === editingAdvisorId) || null;
  const validationMessages = validateSeatCounts(selectedTerm, executiveRoles, assignments);
  const groupedValidationMessages = useMemo(() => {
    const groups = new Map<string, string[]>();
    validationMessages.forEach((message) => {
      const category = validationCategory(message);
      groups.set(category, [...(groups.get(category) || []), message]);
    });
    return Array.from(groups.entries()).map(([category, messages]) => ({
      category,
      messages,
    }));
  }, [validationMessages]);
  const currentAdvisorsCount = advisors.filter((advisor) => advisor.isCurrent).length;
  const formerAdvisorsCount = advisors.filter((advisor) => !advisor.isCurrent).length;
  const currentChiefAdvisor = advisors.find(
    (advisor) => advisor.advisorType === "main_advisor" && advisor.isCurrent
  );
  const currentModerator = advisors.find(
    (advisor) => advisor.advisorType === "moderator_mentor" && advisor.isCurrent
  );
  const selectedRoleCounts = new Map<string, number>();

  for (const assignment of termAssignments) {
    if (assignment.isPublic && assignment.status !== "planned") {
      selectedRoleCounts.set(
        assignment.roleId,
        (selectedRoleCounts.get(assignment.roleId) || 0) + 1
      );
    }
  }

  const filteredHistory = useMemo(() => {
    const needle = historySearch.trim().toLowerCase();
    return history.filter((event) => {
      const category = historyCategory(event.action);
      if (historyFilter && category !== historyFilter) return false;
      if (!needle) return true;
      return [event.action, event.entityType, event.entityId, summarizeMetadata(event.metadata)]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle));
    });
  }, [history, historyFilter, historySearch]);

  function scrollTo(targetId: (typeof navItems)[number][1]) {
    setActiveTab(targetId);
    document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function toggleAssignmentSelection(assignmentId: string) {
    setSelectedAssignmentIds((current) => {
      const next = new Set(current);
      if (next.has(assignmentId)) next.delete(assignmentId);
      else next.add(assignmentId);
      return next;
    });
  }

  function toggleVisibleAssignments(checked: boolean) {
    setSelectedAssignmentIds((current) => {
      const next = new Set(current);
      filteredAssignments.forEach((assignment) => {
        if (checked) next.add(assignment.id);
        else next.delete(assignment.id);
      });
      return next;
    });
  }

  function openAdvisor(id: string, tab: "profile" | "access") {
    setEditingAdvisorId(id);
    setEditingAdvisorInitialTab(tab);
    setShowNewAdvisor(false);
    setActionMenu(null);
  }
  function openNewAdvisor() {
    advisorTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setEditingAdvisorId(null);
    setEditingAdvisorInitialTab("profile");
    setShowNewAdvisor(true);
    setActionMenu(null);
  }
  function closeAdvisorEditor() {
    setEditingAdvisorId(null);
    setShowNewAdvisor(false);
    advisorTriggerRef.current?.focus();
  }

  function openActionMenu(
    event: MouseEvent<HTMLButtonElement>,
    kind: "advisor" | "term",
    id: string
  ) {
    if (kind === "advisor") advisorTriggerRef.current = event.currentTarget;
    const rect = event.currentTarget.getBoundingClientRect();
    const width = 192;

    setActionMenu({
      id,
      kind,
      left: Math.min(Math.max(8, rect.right - width), window.innerWidth - width - 8),
      top: Math.min(rect.bottom + 6, window.innerHeight - 260),
    });
  }

  const menuTerm =
    actionMenu?.kind === "term"
      ? terms.find((term) => term.id === actionMenu.id) || null
      : null;
  const menuAdvisor =
    actionMenu?.kind === "advisor"
      ? advisors.find((advisor) => advisor.id === actionMenu.id) || null
      : null;
  const flashId = flash ? `${flash.title}:${flash.message}` : null;

  return (
    <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-8 px-6 py-9 lg:px-10">
      <header className="border-b border-border pb-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Admin / Committee</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-foreground">Committee</h1>
            <p className="mt-3 max-w-3xl text-base leading-7 text-muted-foreground">
              Manage executive terms, 21-seat rosters, advisor profiles, public visibility, and audit-ready history.
            </p>
          </div>
          <button
            className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            onClick={() => scrollTo("committee-terms")}
            type="button"
          >
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-300 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
            </span>
            {currentTerm?.title || "No current committee"}
          </button>
        </div>
      </header>

      {flash && flashId !== dismissedFlashId ? (
        <div
          className={cx(
            "fixed left-6 right-6 top-20 z-50 rounded-xl border bg-card p-4 shadow-2xl sm:left-auto sm:w-96",
            flash.tone === "success" && "border-emerald-500/30 bg-emerald-50 text-emerald-950 dark:bg-emerald-950/40 dark:text-emerald-50",
            flash.tone === "error" && "border-destructive/30 bg-destructive/10"
          )}
          role="status"
        >
          <div className="flex items-start gap-3">
            {flash.tone === "success" ? <CheckCircle className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden="true" /> : <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />}
            <div className="min-w-0">
              <p className="text-sm font-semibold">{flash.title}</p>
              <p className="mt-0.5 text-sm leading-5 text-muted-foreground">{flash.message}</p>
            </div>
          </div>
        </div>
      ) : null}

      <MetricStrip
        currentAdvisorsCount={currentAdvisorsCount}
        currentTerm={currentTerm}
        formerAdvisorsCount={formerAdvisorsCount}
        historyCount={history.length}
        onHistoryClick={() => scrollTo("committee-history")}
        validationCount={validationMessages.length}
      />

      <WorkspaceNav
        activeTab={activeTab}
        onSelect={scrollTo}
        validationCount={validationMessages.length}
        variant="mobile"
      />

      <WorkspaceNav
        activeTab={activeTab}
        onSelect={scrollTo}
        validationCount={validationMessages.length}
        variant="desktop"
      />

      <div className="flex min-w-0 flex-col gap-14">
          <SectionShell
            actions={
              <>
                <p className="text-xs text-muted-foreground">Six executive terms only. Advisor board is managed separately.</p>
                <GhostButton
                  disabled={terms.length >= 6}
                  onClick={() => {
                    setShowNewTerm(true);
                    setTermFormId(null);
                  }}
                  title={terms.length >= 6 ? "Maximum 6 executive terms reached." : "Create a new term"}
                  type="button"
                >
                  <Plus className="size-3.5" /> New term
                </GhostButton>
              </>
            }
            id="committee-terms"
            label="Terms"
            title="Executive committee terms"
          >
            <TableCard>
              <table className="admin-responsive-table w-full min-w-max text-left text-sm">
                <thead className="border-b border-border bg-muted/50 text-xs uppercase tracking-[0.12em] text-muted-foreground">
                  <tr className="h-12">
                    <th className="px-4 font-semibold" scope="col">Term</th>
                    <th className="px-4 font-semibold" scope="col">Status</th>
                    <th className="px-4 font-semibold" scope="col">Tenure</th>
                    <th className="px-4 font-semibold" scope="col">Seats</th>
                    <th className="px-4 font-semibold" scope="col">Visibility</th>
                    <th className="px-4 text-right font-semibold" scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {terms.map((term) => {
                    const percent = term.targetExecutiveSlots ? (term.assignmentCount / term.targetExecutiveSlots) * 100 : 0;
                    const isEditingTerm = termFormId === term.id;
                    const hasEditingTerm = Boolean(termFormId);

                    return (
                      <Fragment key={term.id}>
                        <tr
                          className={cx(
                            "h-[68px] border-b border-border transition-colors hover:bg-muted/30",
                            termRowTone(term),
                            isEditingTerm && "bg-primary/5",
                            hasEditingTerm && !isEditingTerm && "opacity-60"
                          )}
                        >
                          <td className="px-5">
                            <div className="flex items-center gap-3">
                              <span className={cx(
                                "inline-flex size-9 items-center justify-center rounded-lg border text-sm font-bold",
                                term.isCurrent && "border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
                                !term.isCurrent && term.status === "archived" && "border-border bg-muted text-muted-foreground",
                                !term.isCurrent && term.status !== "archived" && "border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-300"
                              )}>
                                {term.termNumber || "EC"}
                              </span>
                              <div>
                                <p className={cx("font-semibold", term.status === "archived" && "text-muted-foreground line-through")}>{term.title}</p>
                                <p className="text-xs text-muted-foreground">{term.slug}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5">
                            <TermStatusBadge term={term} />
                          </td>
                          <td className="px-5 text-sm">
                            <span title={term.dateConfidence === "estimated" ? "Estimated dates are stored honestly until official records are verified." : undefined}>
                              {term.dateConfidence === "estimated" ? "~ " : ""}
                              {formatDate(term.startsOn)} - {formatDate(term.endsOn)}
                            </span>
                          </td>
                          <td className="px-5">
                            <div className="w-28">
                              <p className="text-sm font-medium tabular-nums">{term.assignmentCount}/{term.targetExecutiveSlots}</p>
                              <ProgressLine percent={percent} />
                            </div>
                          </td>
                          <td className="px-5"><VisibilityBadge isPublic={term.isPublic} /></td>
                          <td className="px-5 text-right">
                            <button
                              aria-label={`Open actions for ${term.title}`}
                              className="inline-flex size-8 items-center justify-center rounded-lg border border-border bg-background transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                              onClick={(event) => openActionMenu(event, "term", term.id)}
                              type="button"
                            >
                              <MoreHorizontal className="size-4" aria-hidden="true" />
                            </button>
                          </td>
                        </tr>
                        {isEditingTerm ? (
                          <tr className="border-b border-border bg-muted/20">
                            <td colSpan={6}>
                              <TermForm onCancel={() => setTermFormId(null)} term={term} />
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
              {terms.length === 0 ? (
                <EmptyPanel
                  action={<GhostButton onClick={() => setShowNewTerm(true)} type="button"><Plus className="size-3.5" /> New term</GhostButton>}
                  description="Create the six executive committee terms before assigning rosters."
                  icon={Clock3}
                  title="No executive committee terms"
                />
              ) : null}
            </TableCard>
            {showNewTerm ? (
              <div className="mt-4 rounded-xl border border-border bg-card shadow-sm">
                <TermForm onCancel={() => setShowNewTerm(false)} term={null} />
              </div>
            ) : null}
          </SectionShell>

          <SectionShell
            actions={
              <PanelSelect
                aria-label="Position term"
                className="w-full sm:w-64"
                onChange={(event) => setSelectedTermId(event.target.value || null)}
                value={selectedTerm?.id || ""}
              >
                {terms.map((term) => (
                  <option key={term.id} value={term.id}>{term.title}</option>
                ))}
              </PanelSelect>
            }
            id="committee-positions"
            label="Positions"
            title="Term-specific position settings"
          >
            <CommitteePositionEditor
              positions={positions}
              roles={roles}
              term={selectedTerm}
            />
          </SectionShell>

          <SectionShell
            actions={
              <>
                <PanelSelect
                  aria-label="Committee term"
                  className="w-full sm:w-56"
                  onChange={(event) => setSelectedTermId(event.target.value || null)}
                  value={selectedTerm?.id || ""}
                >
                  {terms.map((term) => (
                    <option key={term.id} value={term.id}>{term.title}</option>
                  ))}
                </PanelSelect>
                <PrimaryButton onClick={() => { setShowNewAssignment(true); setEditingAssignmentId(null); }} type="button">
                  <Plus className="size-3.5" /> Add assignment
                </PrimaryButton>
              </>
            }
            id="committee-roster"
            label="Executive roster"
            title="Public committee assignments"
          >
            <div className="mb-4 flex flex-col gap-1 text-xs text-muted-foreground">
              <p>Sub-Executive rows remain internal and are excluded from the public committee page.</p>
              <p>
                Executive roles require an active member record from Membership DB.{" "}
                <a className="font-medium text-primary hover:underline" href="/admin/membership" rel="noreferrer" target="_blank">
                  Open Membership DB →
                </a>
              </p>
            </div>
            <RoleSlotGrid roles={executiveRoles} selectedRoleCounts={selectedRoleCounts} />

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <label className="relative min-w-56 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <PanelInput
                  className="w-full pl-9"
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by name, ID, email, role, or term"
                  value={search}
                />
              </label>
              <span className="text-xs text-muted-foreground">
                Showing {filteredAssignments.length} of {termAssignments.length} assignments
              </span>
            </div>

            {selectedAssignmentIds.size > 0 ? (
              <form action={bulkUpdateCommitteeAssignments} className="mt-4 rounded-xl border border-primary/30 bg-primary/5 p-3">
                <input name="assignmentIds" type="hidden" value={Array.from(selectedAssignmentIds).join(",")} />
                <div className="grid gap-3 md:grid-cols-[auto_160px_160px_1fr_auto_auto] md:items-end">
                  <p className="text-sm font-semibold">{selectedAssignmentIds.size} selected</p>
                  <Field>
                    Status
                    <PanelSelect name="status" defaultValue="active">
                      <option value="planned">Planned</option>
                      <option value="active">Active</option>
                      <option value="completed">Completed</option>
                    </PanelSelect>
                  </Field>
                  <Field>
                    Visibility
                    <PanelSelect name="isPublic" defaultValue="true">
                      <option value="true">Public</option>
                      <option value="false">Internal only</option>
                    </PanelSelect>
                  </Field>
                  <Field>
                    Audit note
                    <PanelInput name="note" placeholder="Why this bulk update is needed" />
                  </Field>
                  <SubmitButton>Apply</SubmitButton>
                  <GhostButton onClick={() => setSelectedAssignmentIds(new Set())} type="button">Clear</GhostButton>
                </div>
              </form>
            ) : null}

            <TableCard>
              {filteredAssignments.length === 0 ? (
                <EmptyPanel
                  action={<GhostButton onClick={() => scrollTo("committee-imports")} type="button"><Import className="size-3.5" /> Build roster draft</GhostButton>}
                  description="Use Add assignment for one record or the validated roster workspace for a spreadsheet, CSV, TSV, or manual batch."
                  icon={UserRoundX}
                  title="No public executive assignments in this term"
                />
              ) : (
                <table className="admin-responsive-table w-full min-w-max text-left text-sm">
                  <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                    <tr className="h-10">
                      <th className="w-10 px-4" scope="col">
                        <input
                          aria-label="Select visible assignments"
                          checked={filteredAssignments.length > 0 && selectedVisibleAssignmentCount === filteredAssignments.length}
                          onChange={(event) => toggleVisibleAssignments(event.target.checked)}
                          type="checkbox"
                        />
                      </th>
                      <th className="px-4 font-semibold" scope="col">Seat #</th>
                      <th className="px-4 font-semibold" scope="col">Member</th>
                      <th className="px-4 font-semibold" scope="col">Role</th>
                      <th className="px-4 font-semibold" scope="col">Status</th>
                      <th className="px-4 font-semibold" scope="col">Term</th>
                      <th className="px-4 font-semibold" scope="col">Visibility</th>
                      <th className="px-4 text-right font-semibold" scope="col">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAssignments.map((assignment, index) => {
                      const termRole = executiveRoleById.get(assignment.roleId);
                      return (
                      <tr className="h-16 border-b border-border transition-colors last:border-0 hover:bg-muted/30" key={assignment.id}>
                        <td className="px-4">
                          <input
                            aria-label={`Select ${assignment.memberName || assignment.displayName || "assignment"}`}
                            checked={selectedAssignmentIds.has(assignment.id)}
                            onChange={() => toggleAssignmentSelection(assignment.id)}
                            type="checkbox"
                          />
                        </td>
                        <td className="px-4 text-xs text-muted-foreground">{index + 1}</td>
                        <td className="px-4">
                          <div className="flex items-center gap-3">
                            <AvatarToken id={assignment.memberId || assignment.id} name={assignment.memberName || assignment.displayName || "JnUITS"} />
                            <div>
                              <p className="font-medium">{assignment.memberName || assignment.displayName || "Unlinked assignment"}</p>
                              <p className="text-xs text-muted-foreground">{assignment.jnuitsId || assignment.email || "No linked member"}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4">
                          <p className="font-medium">{assignment.publicTitleOverride || termRole?.title || assignment.roleTitle || "Committee role"}</p>
                          <p className="text-xs text-muted-foreground">{termRole?.titleBn || assignment.roleTitleBn}</p>
                        </td>
                        <td className="px-4"><Badge value={assignment.status === "active" ? "current" : assignment.status} /></td>
                        <td className="px-4 text-muted-foreground">{assignment.termTitle || "Term"}</td>
                        <td className="px-4"><Badge value={assignment.isPublic ? "active" : "frozen"} /></td>
                        <td className="px-4 text-right">
                          <div className="inline-flex gap-1">
                            <button
                              aria-label={`Edit ${assignment.memberName || assignment.displayName || "assignment"}`}
                              className="inline-flex size-8 items-center justify-center rounded-lg border border-border bg-background hover:bg-muted"
                              onClick={() => { setEditingAssignmentId(assignment.id); setShowNewAssignment(false); }}
                              type="button"
                            >
                              <Pencil className="size-3.5" />
                            </button>
                            <form action={removeCommitteeAssignment}>
                              <input name="assignmentId" type="hidden" value={assignment.id} />
                              <button
                                aria-label={`Remove ${assignment.memberName || assignment.displayName || "assignment"}`}
                                className="inline-flex size-8 items-center justify-center rounded-lg border border-border bg-background text-destructive hover:bg-destructive/10"
                                type="submit"
                              >
                                <X className="size-3.5" />
                              </button>
                            </form>
                          </div>
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </TableCard>
          </SectionShell>

          <SectionShell
            actions={
              <>
                <span className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border bg-muted/40 px-3 text-xs text-muted-foreground">
                  <Info className="size-3.5" aria-hidden="true" />
                  Advisors are not members · Managed separately from Membership DB
                </span>
                <PrimaryButton onClick={openNewAdvisor} type="button"><Plus className="size-3.5" /> Add advisor</PrimaryButton>
              </>
            }
            id="committee-advisors"
            label="Advisors"
            title="Teacher advisor profiles"
          >
            <div className="grid items-stretch gap-4 md:grid-cols-3">
              <AdvisorFeatureCard advisor={currentChiefAdvisor} icon={GraduationCap} label="Current Chief Advisor" onAdd={openNewAdvisor} />
              <AdvisorFeatureCard advisor={currentModerator} icon={ShieldCheck} label="Current Moderator/Mentor" onAdd={openNewAdvisor} />
              <article className="flex min-h-[112px] items-center gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
                <span className="inline-flex size-10 items-center justify-center rounded-full border border-border bg-muted text-muted-foreground">
                  <Archive aria-hidden="true" className="size-4" />
                </span>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Former Advisor History</p>
                  <p className="mt-1 text-3xl font-bold tabular-nums">{formerAdvisorsCount}</p>
                  <p className="text-xs text-muted-foreground">archived separately from EC terms</p>
                </div>
              </article>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <label className="relative w-full max-w-sm transition-all focus-within:max-w-md">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <PanelInput
                  className="w-full pl-9"
                  onChange={(event) => setAdvisorSearch(event.target.value)}
                  placeholder="Search advisor by name or ID..."
                  type="search"
                  value={advisorSearch}
                />
              </label>
              <PanelSelect aria-label="Filter advisors by type" className="w-full sm:w-48" onChange={(event) => setAdvisorTypeFilter(event.target.value)} value={advisorTypeFilter}>
                <option value="">All advisor types</option>
                {advisorTypeOptions.map((advisorType) => (
                  <option key={advisorType} value={advisorType}>{humanize(advisorType)}</option>
                ))}
              </PanelSelect>
              <PanelSelect aria-label="Filter advisors by status" className="w-full sm:w-36" onChange={(event) => setAdvisorStatusFilter(event.target.value)} value={advisorStatusFilter}>
                <option value="">All</option>
                <option value="current">Current</option>
                <option value="former">Former</option>
              </PanelSelect>
              {advisorSearch || advisorTypeFilter || advisorStatusFilter ? (
                <GhostButton onClick={() => { setAdvisorSearch(""); setAdvisorTypeFilter(""); setAdvisorStatusFilter(""); }} type="button">Clear filters</GhostButton>
              ) : null}
              <span className="ml-auto text-xs text-muted-foreground">Showing {filteredAdvisors.length} of {advisors.length} advisors</span>
            </div>

            <TableCard>
              {advisors.length === 0 ? (
                <EmptyPanel
                  action={<PrimaryButton onClick={openNewAdvisor} type="button"><Plus className="size-3.5" /> Add advisor</PrimaryButton>}
                  description="Create advisor profiles for the chief advisor, moderator/mentor, and honorable advisors."
                  icon={GraduationCap}
                  title="No advisor profiles yet"
                />
              ) : filteredAdvisors.length === 0 ? (
                <EmptyPanel
                  description="Clear the advisor filters or search another advisor identity."
                  icon={Search}
                  title="No advisors match this view"
                />
              ) : (
                <table className="admin-responsive-table w-full min-w-max text-left text-sm">
                  <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                    <tr className="h-10">
                      <th className="px-4 font-semibold" scope="col">Advisor</th>
                      <th className="px-4 font-semibold" scope="col">Advisor ID</th>
                      <th className="px-4 font-semibold" scope="col">Type</th>
                      <th className="px-4 font-semibold" scope="col">Department</th>
                      <th className="px-4 font-semibold" scope="col">Serving</th>
                      <th className="px-4 font-semibold" scope="col">Visibility</th>
                      <th className="px-4 text-right font-semibold" scope="col">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAdvisors.map((advisor) => (
                      <tr className="h-16 border-b border-border transition-colors last:border-0 hover:bg-muted/30" key={advisor.id}>
                        <td className="px-4">
                          <div className="flex items-center gap-3">
                            <AvatarToken id={advisor.id} name={advisor.fullName} />
                            <div>
                              <p className="font-medium">{formatAdvisorDisplayName(advisor)}</p>
                              <p className="text-xs text-muted-foreground">{advisor.designation || advisor.email || "Teacher advisor"}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4">{advisor.advisorJnuitsId || "Auto assigned"}</td>
                        <td className="px-4">
                          <div className="flex items-center gap-2">
                            <AdvisorTypeBadge isCurrent={advisor.isCurrent} type={advisor.advisorType} />
                            {!advisor.isCurrent ? <span className="text-xs text-muted-foreground">(Former)</span> : null}
                          </div>
                        </td>
                        <td className="px-4">{advisor.department || <span className="italic text-muted-foreground">Not set</span>}</td>
                        <td className="px-4 font-mono text-xs tabular-nums text-muted-foreground" title={advisor.tenureDisplay || `${formatDate(advisor.joinedOn)} - ${formatDate(advisor.leftOn)}`}>
                          <span className="inline-block max-w-28 truncate">{formatShortDateRange(advisor.joinedOn, advisor.leftOn, advisor.tenureDisplay)}</span>
                        </td>
                        <td className="px-4">
                          <form action={saveAdvisorProfile} className="flex items-center gap-2">
                            <AdvisorHiddenFields advisor={advisor} nextPublic={!advisor.isPublic} />
                            <button
                              aria-label={`${advisor.isPublic ? "Hide" : "Publish"} ${advisor.fullName}`}
                              className={cx(
                                "inline-flex h-7 w-12 items-center rounded-full border p-0.5 transition-colors",
                                advisor.isPublic ? "border-emerald-500/30 bg-emerald-500" : "border-border bg-muted"
                              )}
                              type="submit"
                            >
                              <span className={cx("size-5 rounded-full bg-background shadow transition-transform", advisor.isPublic && "translate-x-5")} />
                            </button>
                            <span className={cx("text-xs font-medium", advisor.isPublic ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")}>
                              {advisor.isPublic ? "Public" : "Hidden"}
                            </span>
                          </form>
                        </td>
                        <td className="px-4 text-right">
                          <button
                            aria-label={`Open actions for ${advisor.fullName}`}
                            className="inline-flex size-8 items-center justify-center rounded-lg border border-border bg-background transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                            onClick={(event) => openActionMenu(event, "advisor", advisor.id)}
                            type="button"
                          >
                            <MoreHorizontal className="size-4" aria-hidden="true" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </TableCard>
          </SectionShell>

          <SectionShell
            id="committee-imports"
            label="Roster intake"
            title="Build and publish a validated roster draft"
          >
            <CommitteeOnboardingPanel
              departmentOptions={departmentOptions}
              initialTermId={selectedTerm?.id || initialTermId}
              key={selectedTerm?.id || "no-term"}
              terms={terms.map((term) => ({ id: term.id, title: term.title }))}
            />
          </SectionShell>

          <SectionShell id="committee-validation" label="Validation" title="Publication readiness">
            <div className={cx("rounded-xl border p-4 shadow-sm", validationMessages.length ? "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20" : "border-emerald-500/30 bg-emerald-500/10")}>
              <div className="flex flex-wrap items-center gap-3">
                {validationMessages.length ? <Lock className="size-5 shrink-0 text-red-600 dark:text-red-400" /> : <CheckCircle className="size-5 shrink-0 text-emerald-600 dark:text-emerald-300" />}
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold">{validationMessages.length ? "Publication blocked" : "Ready to publish"}</h3>
                  <p className="text-sm text-muted-foreground">
                    {validationMessages.length ? `${validationMessages.length} blocking issues must be resolved before the roster can go public.` : "Current committee role counts match the configured slot rules."}
                  </p>
                </div>
                {validationMessages.length ? (
                  <button
                    className="ml-auto inline-flex h-8 items-center rounded-lg border border-red-200 bg-background px-3 text-sm font-medium text-red-700 transition-colors hover:bg-red-100 dark:border-red-800 dark:text-red-300"
                    onClick={() => document.getElementById("committee-blockers")?.scrollIntoView({ behavior: "smooth", block: "start" })}
                    type="button"
                  >
                    View blockers ↓
                  </button>
                ) : null}
              </div>
            </div>
            <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(280px,0.9fr)]" id="committee-blockers">
              <article className="rounded-xl border border-border border-l-4 border-l-red-500 bg-card p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold">Blocking Errors</h3>
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-950/40 dark:text-red-300">{validationMessages.length}</span>
                </div>
                <div className="mt-4 flex flex-col gap-3">
                  {groupedValidationMessages.length ? groupedValidationMessages.map((group) => {
                    const expanded = expandedValidationGroups.has(group.category);
                    const visibleMessages = expanded ? group.messages : group.messages.slice(0, 5);

                    return (
                      <div className="rounded-lg border border-border bg-muted/20 p-3" key={group.category}>
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold">{group.category}</p>
                          <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-950/40 dark:text-red-300">{group.messages.length}</span>
                        </div>
                        <div className="mt-3 flex flex-col gap-2">
                          {visibleMessages.map((message) => (
                            <p className="flex gap-2 text-sm leading-5 text-muted-foreground" key={message}>
                              <X className="mt-0.5 size-3.5 shrink-0 text-red-600" /> {message}
                            </p>
                          ))}
                        </div>
                        {group.messages.length > 5 ? (
                          <button
                            className="mt-3 text-sm font-medium text-primary hover:underline"
                            onClick={() => {
                              setExpandedValidationGroups((current) => {
                                const next = new Set(current);
                                if (next.has(group.category)) next.delete(group.category);
                                else next.add(group.category);
                                return next;
                              });
                            }}
                            type="button"
                          >
                            {expanded ? "Show less" : `Show ${group.messages.length - 5} more`}
                          </button>
                        ) : null}
                      </div>
                    );
                  }) : <p className="flex gap-2 text-sm text-muted-foreground"><Check className="mt-0.5 size-4 shrink-0 text-emerald-600" /> No blocking errors</p>}
                </div>
              </article>
              <article className="flex h-10 items-center rounded-xl border border-border border-l-4 border-l-amber-500 bg-card px-4 shadow-sm">
                <p className="flex gap-2 text-sm font-medium text-muted-foreground">
                  <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" /> No warnings.
                </p>
              </article>
            </div>
            <div className="rounded-xl border border-border bg-card shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
                <h3 className="text-sm font-semibold">Role Slot Matrix</h3>
                <div className="flex rounded-lg border border-border bg-background p-0.5">
                  {(["all", "pending", "complete"] as const).map((filter) => (
                    <button
                      className={cx(
                        "h-8 rounded-md px-3 text-sm font-medium capitalize transition-colors",
                        roleMatrixFilter === filter ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                      key={filter}
                      onClick={() => setRoleMatrixFilter(filter)}
                      type="button"
                    >
                      {filter}
                    </button>
                  ))}
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="admin-responsive-table w-full min-w-max text-left text-sm">
                    <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                      <tr className="h-10">
                        <th className="px-4 font-semibold" scope="col">Role</th>
                        <th className="px-4 font-semibold" scope="col">Allowed</th>
                        <th className="px-4 font-semibold" scope="col">Count</th>
                        <th className="px-4 font-semibold" scope="col">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {executiveRoles
                        .filter((role) => {
                          const count = selectedRoleCounts.get(role.id) || 0;
                          const healthy = count >= role.minSlots && count <= role.maxSlots;
                          if (roleMatrixFilter === "complete") return healthy;
                          if (roleMatrixFilter === "pending") return !healthy;
                          return true;
                        })
                        .map((role) => {
                          const count = selectedRoleCounts.get(role.id) || 0;
                          const healthy = count >= role.minSlots && count <= role.maxSlots;
                          return (
                            <tr className="h-11 border-b border-border odd:bg-muted/20 last:border-0" key={role.id}>
                              <td className="px-4 font-medium">{role.title}</td>
                              <td className="px-4">{role.minSlots === role.maxSlots ? role.minSlots : `${role.minSlots}-${role.maxSlots}`}</td>
                              <td className="px-4 font-semibold tabular-nums">{count}</td>
                              <td className="px-4"><Badge value={healthy ? "current" : "inactive"} /></td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
              </div>
            </div>
          </SectionShell>

          <SectionShell id="committee-history" label="History" title="Recent committee audit events">
            <div className="flex flex-wrap gap-2">
              <PanelSelect aria-label="Filter history category" className="w-full sm:w-40" onChange={(event) => setHistoryFilter(event.target.value)} value={historyFilter}>
                <option value="">All categories</option>
                <option value="Terms">Terms</option>
                <option value="Roster">Roster</option>
                <option value="Advisors">Advisors</option>
                <option value="Imports">Imports</option>
                <option value="Publication">Publication</option>
              </PanelSelect>
              <label className="relative min-w-56 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <PanelInput className="w-full pl-9" onChange={(event) => setHistorySearch(event.target.value)} placeholder="Search audit events" value={historySearch} />
              </label>
            </div>
            <TableCard>
              {filteredHistory.length === 0 ? (
                <EmptyPanel
                  description="Committee mutations will write audit events after operators create or update records."
                  icon={History}
                  title="No committee audit events in this view"
                />
              ) : (
                <table className="admin-responsive-table w-full min-w-max text-left text-sm">
                  <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                    <tr className="h-10">
                      <th className="px-4 font-semibold" scope="col">Event</th>
                      <th className="px-4 font-semibold" scope="col">Entity</th>
                      <th className="px-4 font-semibold" scope="col">Actor</th>
                      <th className="px-4 font-semibold" scope="col">Before &rarr; After</th>
                      <th className="px-4 font-semibold" scope="col">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredHistory.map((event) => {
                      const expanded = expandedHistoryId === event.id;
                      return (
                        <Fragment key={event.id}>
                          <tr
                            className="h-14 cursor-pointer border-b border-border transition-colors hover:bg-muted/30"
                            onClick={() => setExpandedHistoryId(expanded ? null : event.id)}
                          >
                            <td className="px-4">
                              <p className="font-medium">{humanize(event.action)}</p>
                              <HistoryActionPill action={event.action} />
                            </td>
                            <td className="px-4">
                              {event.entityType}
                              <p className="text-xs text-muted-foreground">{event.entityId || "No entity ID"}</p>
                            </td>
                            <td className="px-4">
                              {event.actorUserId ? (
                                <div className="flex items-center gap-2" title="Actor name unavailable; showing auth user id prefix.">
                                  <AvatarToken id={event.actorUserId} name="Operator" />
                                  <span className="font-mono text-xs">{event.actorUserId.slice(0, 8)}</span>
                                  <span className="text-xs text-muted-foreground">?</span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <span className="inline-flex size-7 items-center justify-center rounded-full border border-border bg-muted text-muted-foreground">
                                    <Settings className="size-3.5" aria-hidden="true" />
                                  </span>
                                  <span>System</span>
                                </div>
                              )}
                            </td>
                            <td className="px-4 text-muted-foreground"><DiffSummary action={event.action} metadata={event.metadata} /></td>
                            <td className="px-4" title={new Date(event.createdAt).toISOString()}>{formatAuditTimestamp(event.createdAt)}</td>
                          </tr>
                          {expanded ? (
                            <tr className="border-b border-border bg-muted/20">
                              <td className="px-4 py-3" colSpan={5}>
                                <ExpandedDiff metadata={event.metadata} />
                              </td>
                            </tr>
                          ) : null}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </TableCard>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Showing 1-{filteredHistory.length} of {filteredHistory.length} events</span>
              <div className="flex gap-2">
                <GhostButton disabled type="button">Previous</GhostButton>
                <GhostButton disabled type="button">Next</GhostButton>
              </div>
            </div>
          </SectionShell>
        </div>

      {actionMenu ? (
        <>
          <button
            aria-label="Close action menu"
            className="fixed inset-0 z-40 cursor-default bg-transparent"
            onClick={() => setActionMenu(null)}
            type="button"
          />
          <div
            className="fixed z-50 w-48 rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-lg"
            role="menu"
            style={{ left: actionMenu.left, top: actionMenu.top }}
          >
            {menuTerm ? (
              <>
                {menuTerm.status === "archived" ? (
                  <button
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    onClick={() => {
                      setTermFormId(menuTerm.id);
                      setShowNewTerm(false);
                      setActionMenu(null);
                    }}
                    role="menuitem"
                    type="button"
                  >
                    <Archive className="size-3.5" aria-hidden="true" /> Unarchive
                  </button>
                ) : (
                  <>
                    <button
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      onClick={() => {
                        setTermFormId(menuTerm.id);
                        setShowNewTerm(false);
                        setActionMenu(null);
                      }}
                      role="menuitem"
                      type="button"
                    >
                      <Pencil className="size-3.5" aria-hidden="true" /> Edit
                    </button>
                    {!menuTerm.isCurrent ? (
                      <form action={setCommitteeTermCurrent}>
                        <input name="termId" type="hidden" value={menuTerm.id} />
                        <button
                          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                          onClick={() => setActionMenu(null)}
                          role="menuitem"
                          type="submit"
                        >
                          <UserCheck className="size-3.5" aria-hidden="true" /> Set as Current
                        </button>
                      </form>
                    ) : null}
                  </>
                )}
                <button
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  onClick={() => {
                    setSelectedTermId(menuTerm.id);
                    scrollTo("committee-roster");
                    setActionMenu(null);
                  }}
                  role="menuitem"
                  type="button"
                >
                  <ChevronRight className="size-3.5" aria-hidden="true" /> {menuTerm.status === "archived" ? "View roster (read-only)" : "View Roster"}
                </button>
              </>
            ) : null}

            {menuAdvisor ? (
              <>
                <button
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  onClick={() => openAdvisor(menuAdvisor.id, "profile")}
                  role="menuitem"
                  type="button"
                >
                  <Pencil className="size-3.5" aria-hidden="true" /> Edit profile
                </button>
                <button
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  onClick={() => openAdvisor(menuAdvisor.id, "access")}
                  role="menuitem"
                  type="button"
                >
                  <UserCheck className="size-3.5" aria-hidden="true" /> Invite/link portal user
                </button>
                {menuAdvisor.isPublic ? <a
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  href={menuAdvisor.isCurrent ? "/committee#advisor-board" : "/committee#former-advisors"}
                  target="_blank" rel="noopener noreferrer" role="menuitem" onClick={() => setActionMenu(null)}
                ><Eye className="size-3.5" aria-hidden="true" /> View public profile</a> : <button type="button" role="menuitem" disabled className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm text-muted-foreground" title="This advisor profile is private."><Eye className="size-3.5" aria-hidden="true" /> View public profile</button>}
              </>
            ) : null}
          </div>
        </>
      ) : null}

      {selectedAssignment || showNewAssignment ? (
        <DrawerPanel
          onClose={() => {
            setEditingAssignmentId(null);
            setShowNewAssignment(false);
          }}
          title={selectedAssignment ? "Edit Assignment" : "Add Assignment"}
        >
          <AssignmentForm
            assignment={selectedAssignment}
            executiveRoles={executiveRoles}
            key={selectedAssignment?.id || "new-assignment"}
            onCancel={() => {
              setEditingAssignmentId(null);
              setShowNewAssignment(false);
            }}
            selectedRoleCounts={selectedRoleCounts}
            selectedTerm={selectedTerm}
          />
        </DrawerPanel>
      ) : null}

      {selectedAdvisor || showNewAdvisor ? (
        <DrawerPanel
          onClose={closeAdvisorEditor}
          title={selectedAdvisor ? "Edit Advisor Profile" : "Create Advisor Profile"}
        >
          <AdvisorForm
            key={`${selectedAdvisor?.id || "new-advisor"}:${editingAdvisorInitialTab}`}
            initialTab={editingAdvisorInitialTab}
            advisor={selectedAdvisor}
            departmentOptions={departmentOptions}
            onCancel={closeAdvisorEditor}
          />
        </DrawerPanel>
      ) : null}
    </div>
  );
}
