"use client";

import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Copy,
  Ellipsis,
  Info,
  Lock,
  Mail,
  Pencil,
  RefreshCw,
  Search,
  X,
  Unlock,
} from "lucide-react";
import { Fragment, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";

import {
  bulkReviewMemberAccountRequestsAction,
  createInvitationBatchAction,
  createMembershipCycleAction,
  enrollMemberInCycleAction,
  issueInvitationsFromBatchAction,
  lookupMemberForCycleAction,
  reviewMemberAccountRequestAction,
  saveMemberOperationsAction,
  syncInvitationBatchMetricsAction,
  updateCycleMemberStateAction,
  updateInvitationBatchStatusAction,
  updateMembershipCycleStatusAction,
} from "@/app/admin/membership/actions";

export type MembershipCycleClientRecord = {
  code: string;
  created_at: string;
  ends_on: null | string;
  id: string;
  renewal_close_on: null | string;
  renewal_open_on: null | string;
  starts_on: string;
  status: string;
  title: string;
};

export type CycleMemberClientRecord = {
  cycle_id: string;
  displayJnuitsId: string;
  expires_on: null | string;
  id: string;
  isProfileClaimed: boolean;
  memberName: string;
  note: null | string;
  state: string;
};

export type InvitationBatchClientRecord = {
  claimed_count: number;
  created_at: string;
  cycle_id: null | string;
  expires_at: null | string;
  id: string;
  issued_count: number;
  label: string;
  source: string;
  status: string;
};

export type ManagedMemberClientRecord = {
  avatar_secure_url: null | string;
  currentPortalRole: "alumni" | "alumni_ambassador" | "executive" | "member";
  displayJnuitsId: string;
  email: null | string;
  full_name: string;
  id: string;
  is_profile_claimed: boolean | null;
  jnuits_id: string;
  lifecycle_status: null | string;
  member_type: null | string;
  portal_access_status: null | string;
  updated_at: string;
  user_id: null | string;
};

export type PortalRoleOptionClientRecord = {
  code: "alumni" | "alumni_ambassador" | "executive" | "member";
  display_name: string;
};

export type AccountRequestClientRecord = {
  displayJnuitsId: string;
  id: string;
  memberName: string;
  member_id: string;
  requested_at: string;
  request_type: string;
  review_note: null | string;
  status: string;
};

type AdminFlash = {
  message: string;
  title: string;
  tone: string;
} | null;

type MembershipDbClientProps = {
  accountRequests: AccountRequestClientRecord[];
  activeCycle: MembershipCycleClientRecord | null;
  activeMembersInCycles: number;
  batches: InvitationBatchClientRecord[];
  cycles: MembershipCycleClientRecord[];
  cycleMembers: CycleMemberClientRecord[];
  flash: AdminFlash;
  managedMemberTotal: number;
  managedMembers: ManagedMemberClientRecord[];
  memberLifecycleFilter: string;
  memberPage: number;
  memberPageSize: number;
  memberRoleFilter: string;
  pendingRenewals: number;
  portalRoleOptions: PortalRoleOptionClientRecord[];
  totalClaimedInvitations: number;
  totalIssuedInvitations: number;
};

const lifecycleOptions = ["current", "former", "alumni", "deleted"] as const;
const portalAccessOptions = [
  "active",
  "frozen",
  "suspended",
  "deletion_requested",
  "deactivated",
] as const;
const cycleStatuses = ["draft", "active", "closed", "archived"] as const;
const cycleMemberStates = [
  "active",
  "pending_renewal",
  "renewed",
  "expired",
  "lapsed",
] as const;
const batchStatuses = ["draft", "active", "closed", "archived"] as const;
const stickyNavItems = [
  { label: "Members", tabId: "tab-members", targetId: "member-operations" },
  { label: "Cycles", tabId: "tab-cycles", targetId: "cycle-management" },
  { label: "Enrollment", tabId: "tab-enrollment", targetId: "member-enrollment" },
  { label: "Invitations", tabId: "tab-invitations", targetId: "invitation-batches" },
  { label: "Registry", tabId: "tab-registry", targetId: "cycle-registry" },
] as const;

const stickySectionToTab: Record<string, (typeof stickyNavItems)[number]["tabId"]> = {
  "alumni-queue": "tab-members",
  "batch-registry": "tab-registry",
  "cycle-management": "tab-cycles",
  "cycle-registry": "tab-registry",
  "invitation-batches": "tab-invitations",
  "member-enrollment": "tab-enrollment",
  "member-operations": "tab-members",
  "renewal-queue": "tab-registry",
};

function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
}

function humanize(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDateDisplay(value: string) {
  if (!value) {
    return "";
  }

  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) {
    return value;
  }

  return new Intl.DateTimeFormat("en", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}

function toIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseIsoDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) {
    return null;
  }
  return new Date(year, month - 1, day);
}

function compareIsoDates(a: string, b: string) {
  return a.localeCompare(b);
}

function InfoTooltip({
  ariaLabel,
  children,
}: {
  ariaLabel: string;
  children: React.ReactNode;
}) {
  return (
    <span className="membership-info">
      <button aria-label={ariaLabel} className="membership-info__trigger" type="button">
        <Info aria-hidden="true" size={14} />
      </button>
      <span className="membership-info__panel" role="tooltip">
        {children}
      </span>
    </span>
  );
}

function PendingSubmitButton({
  children,
  className = "primary-button",
  disabled = false,
}: {
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <button className={className} disabled={disabled || pending} type="submit">
      {pending ? <span className="membership-spinner" aria-hidden="true" /> : children}
    </button>
  );
}

function MetricCard({
  children,
  important = false,
  label,
  value,
}: {
  children?: React.ReactNode;
  important?: boolean;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <article className="metric-card membership-metric-card" data-important={important}>
      <p className="metric-card__label">{label}</p>
      <div className="metric-card__value mt-3">{value}</div>
      {children}
    </article>
  );
}

function StatsBar({
  activeCycle,
  activeMembersInCycles,
  cyclesCount,
  pendingRenewals,
  totalClaimedInvitations,
  totalIssuedInvitations,
}: {
  activeCycle: MembershipCycleClientRecord | null;
  activeMembersInCycles: number;
  cyclesCount: number;
  pendingRenewals: number;
  totalClaimedInvitations: number;
  totalIssuedInvitations: number;
}) {
  const claimPercent =
    totalIssuedInvitations > 0
      ? Math.round(
          Math.min(100, Math.max(0, (totalClaimedInvitations / totalIssuedInvitations) * 100))
        )
      : 0;

  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
      <MetricCard label="Cycles" value={cyclesCount}>
        <p className="membership-metric-description mt-3 text-sm leading-7 text-[var(--muted-foreground)]">
          Draft, active, closed, and archived membership windows.
        </p>
      </MetricCard>

      <MetricCard important label="Active cycle" value={activeCycle ? activeCycle.code : "None"}>
        <div className="membership-metric-description mt-3 text-sm leading-7 text-[var(--muted-foreground)]">
          {activeCycle ? (
            <p>
              <strong className="text-[var(--foreground)]">{activeCycle.title}</strong>{" "}
              <button
                className="membership-inline-action"
                onClick={() => scrollToSection("cycle-management")}
                type="button"
              >
                Change
              </button>
            </p>
          ) : (
            <button
              className="ghost-button membership-card-action"
              onClick={() => scrollToSection("cycle-management")}
              type="button"
            >
              Set active cycle
            </button>
          )}
        </div>
      </MetricCard>

      <MetricCard important label="Pending renewals" value={pendingRenewals}>
        <p className="membership-metric-description mt-3 text-sm leading-7 text-[var(--muted-foreground)]">
          Members waiting for renewal decision or invitation outreach.
        </p>
      </MetricCard>

      <MetricCard label="Active cycle members" value={activeMembersInCycles}>
        <p className="membership-metric-description mt-3 text-sm leading-7 text-[var(--muted-foreground)]">
          Members currently active across loaded cycle rows.
        </p>
      </MetricCard>

      <article className="metric-card membership-metric-card">
        <p className="metric-card__label">Batch claims</p>
        <div className="membership-claims-grid">
          <div>
            <p className="membership-claims-number">{totalClaimedInvitations}</p>
            <p className="membership-sub-label">Claimed</p>
          </div>
          <div className="membership-claims-divider" aria-hidden="true" />
          <div>
            <p className="membership-claims-number">{totalIssuedInvitations}</p>
            <p className="membership-sub-label">Issued</p>
          </div>
        </div>
        {totalIssuedInvitations > 0 ? (
          <div className="membership-progress" aria-hidden="true">
            <span data-complete={claimPercent === 100} style={{ width: `${claimPercent}%` }} />
          </div>
        ) : null}
      </article>
    </section>
  );
}

function WorkflowProgress({
  activeMembersInCycles,
  batchesCount,
  cyclesCount,
  issuedCount,
}: {
  activeMembersInCycles: number;
  batchesCount: number;
  cyclesCount: number;
  issuedCount: number;
}) {
  const rawSteps = [
    { complete: cyclesCount > 0, id: "cycle-management", label: "Create cycle" },
    { complete: activeMembersInCycles > 0, id: "member-enrollment", label: "Enroll members" },
    { complete: batchesCount > 0, id: "invitation-batches", label: "Create batches" },
    { complete: issuedCount > 0, id: "invitation-batches", label: "Issue invitations" },
  ];
  const currentIndex = Math.max(0, rawSteps.findIndex((step) => !step.complete));

  return (
    <section className="membership-workflow" aria-label="Membership workflow progress">
      {rawSteps.map((step, index) => {
        const state = step.complete ? "complete" : index === currentIndex ? "current" : "future";
        return (
          <Fragment key={`${step.id}-${step.label}`}>
            <button
              className="membership-workflow__step"
              data-state={state}
              onClick={() => scrollToSection(step.id)}
              type="button"
            >
              <span className="membership-workflow__circle">
                {step.complete ? <Check aria-hidden="true" size={12} /> : index + 1}
              </span>
              <span className="membership-workflow__label">{step.label}</span>
            </button>
            {index < rawSteps.length - 1 ? (
              <span
                aria-hidden="true"
                className="membership-workflow__connector"
                data-complete={step.complete}
              />
            ) : null}
          </Fragment>
        );
      })}
    </section>
  );
}

function StickySectionNav() {
  const [activeTab, setActiveTab] = useState<(typeof stickyNavItems)[number]["tabId"]>("tab-members");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target.id) {
          const tabId = stickySectionToTab[visible.target.id];
          if (tabId) {
            setActiveTab(tabId);
          }
        }
      },
      { rootMargin: "-30% 0px -60% 0px", threshold: 0 }
    );

    for (const id of Object.keys(stickySectionToTab)) {
      const element = document.getElementById(id);
      if (element) observer.observe(element);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <nav className="membership-sticky-nav" aria-label="Membership DB sections">
      {stickyNavItems.map((item, index) => (
        <button
          className={`nav-tab${activeTab === item.tabId ? " tab-active" : ""}`}
          id={item.tabId}
          key={item.tabId}
          onClick={() => {
            setActiveTab(item.tabId);
            scrollToSection(item.targetId);
          }}
          type="button"
        >
          {index > 0 ? <span aria-hidden="true">·</span> : null}
          {item.label}
        </button>
      ))}
    </nav>
  );
}

function StatusBadge({ value }: { value: string }) {
  const normalized = value || "active";
  const tone =
    normalized === "active" || normalized === "current"
      ? "success"
      : normalized === "alumni" || normalized === "pending_renewal"
        ? "warning"
        : "neutral";

  return (
    <span className="membership-status-badge" data-tone={tone}>
      {humanize(normalized)}
    </span>
  );
}

function MemberChip({ children }: { children: React.ReactNode }) {
  return <span className="membership-chip">{children}</span>;
}

function getMemberInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] || "M";
  const second = parts.length > 1 ? parts[parts.length - 1]?.[0] : parts[0]?.[1] || "";
  return `${first}${second}`.toUpperCase();
}

function getAvatarTone(memberId: string) {
  const value = Number.parseInt(memberId.slice(-2), 16);
  return Number.isFinite(value) ? value % 4 : 0;
}

function getMemberLifecycle(member: ManagedMemberClientRecord) {
  return member.lifecycle_status || "current";
}

function getMemberPortalAccess(member: ManagedMemberClientRecord) {
  return member.portal_access_status || "active";
}

function updateMembershipQuery(updates: Record<string, string>) {
  const params = new URLSearchParams(window.location.search);

  for (const [key, value] of Object.entries(updates)) {
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
  }

  window.location.search = params.toString();
}

function getPaginationItems(currentPage: number, totalPages: number) {
  const items = new Set<number>([1, totalPages]);

  for (let page = Math.max(1, currentPage - 1); page <= Math.min(totalPages, currentPage + 1); page += 1) {
    items.add(page);
  }

  return Array.from(items).sort((a, b) => a - b);
}

function TableBadge({ type, value }: { type: "access" | "lifecycle"; value: string }) {
  const normalized = value || (type === "access" ? "active" : "current");

  return (
    <span className="membership-table-badge" data-kind={type} data-value={normalized}>
      {humanize(normalized)}
    </span>
  );
}

function MemberTableAvatar({ member }: { member: ManagedMemberClientRecord }) {
  return (
    <span
      aria-hidden="true"
      className="membership-table-avatar"
      data-tone={getAvatarTone(member.displayJnuitsId || member.id)}
    >
      {getMemberInitials(member.full_name)}
    </span>
  );
}

function MemberOperationsSection({
  cycles,
  cycleMembers,
  memberLifecycleFilter,
  memberPage,
  memberPageSize,
  memberRoleFilter,
  managedMemberTotal,
  managedMembers,
  portalRoleOptions,
}: {
  cycles: MembershipCycleClientRecord[];
  cycleMembers: CycleMemberClientRecord[];
  memberLifecycleFilter: string;
  memberPage: number;
  memberPageSize: number;
  memberRoleFilter: string;
  managedMemberTotal: number;
  managedMembers: ManagedMemberClientRecord[];
  portalRoleOptions: PortalRoleOptionClientRecord[];
}) {
  const [members, setMembers] = useState(managedMembers);
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(() => new Set());
  const [editingMemberId, setEditingMemberId] = useState<null | string>(null);
  const [historyMember, setHistoryMember] = useState<ManagedMemberClientRecord | null>(null);
  const [openMenu, setOpenMenu] = useState<null | {
    memberId: string;
    left: number;
    top: number;
  }>(null);
  const [feedback, setFeedback] = useState<null | string>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search.trim().toLowerCase()), 250);
    return () => window.clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    if (!openMenu) {
      return undefined;
    }

    function handleOutsideClick(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenu(null);
      }
    }

    function closeFloatingMenu() {
      setOpenMenu(null);
    }

    document.addEventListener("mousedown", handleOutsideClick);
    window.addEventListener("resize", closeFloatingMenu);
    window.addEventListener("scroll", closeFloatingMenu, true);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      window.removeEventListener("resize", closeFloatingMenu);
      window.removeEventListener("scroll", closeFloatingMenu, true);
    };
  }, [openMenu]);

  const lifecycleValues = useMemo(
    () =>
      Array.from(
        new Set([...members.map((member) => getMemberLifecycle(member)), memberLifecycleFilter].filter(Boolean))
      ).sort(),
    [memberLifecycleFilter, members]
  );

  const roleValues = useMemo(
    () =>
      portalRoleOptions.length > 0
        ? portalRoleOptions
        : Array.from(new Set(members.map((member) => member.currentPortalRole))).map((code) => ({
            code,
            display_name: humanize(code),
          })),
    [members, portalRoleOptions]
  );

  const cycleLabelByJnuitsId = useMemo(() => {
    const cycleById = new Map(cycles.map((cycle) => [cycle.id, cycle.code] as const));
    const labelByMemberId = new Map<string, string>();

    for (const row of cycleMembers) {
      if (!labelByMemberId.has(row.displayJnuitsId)) {
        labelByMemberId.set(row.displayJnuitsId, cycleById.get(row.cycle_id) || "Cycle");
      }
    }

    return labelByMemberId;
  }, [cycleMembers, cycles]);

  const filteredMembers = useMemo(() => {
    return members.filter((member) => {
      const haystack = `${member.full_name} ${member.displayJnuitsId} ${member.email || ""}`.toLowerCase();
      return !debouncedSearch || haystack.includes(debouncedSearch);
    });
  }, [debouncedSearch, members]);

  const selectedMembers = useMemo(
    () => members.filter((member) => selectedMemberIds.has(member.id)),
    [members, selectedMemberIds]
  );
  const editingMember = members.find((member) => member.id === editingMemberId) || null;
  const menuMember = members.find((member) => member.id === openMenu?.memberId) || null;
  const visibleMemberIds = filteredMembers.map((member) => member.id);
  const allVisibleSelected =
    visibleMemberIds.length > 0 && visibleMemberIds.every((memberId) => selectedMemberIds.has(memberId));
  const totalPages = Math.max(1, Math.ceil(managedMemberTotal / memberPageSize));
  const currentPage = Math.min(memberPage, totalPages);
  const pageItems = getPaginationItems(currentPage, totalPages);

  function setTransientFeedback(message: string) {
    setFeedback(message);
    window.setTimeout(() => setFeedback(null), 1600);
  }

  async function copyMemberId(member: ManagedMemberClientRecord) {
    await navigator.clipboard.writeText(member.displayJnuitsId);
    setTransientFeedback("Member ID copied.");
  }

  function openMemberMenu(
    event: React.MouseEvent<HTMLButtonElement>,
    member: ManagedMemberClientRecord
  ) {
    event.stopPropagation();

    if (openMenu?.memberId === member.id) {
      setOpenMenu(null);
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const menuWidth = 172;
    const menuHeight = 210;
    const viewportPadding = 12;
    const left = Math.min(
      window.innerWidth - menuWidth - viewportPadding,
      Math.max(viewportPadding, rect.right - menuWidth)
    );
    const hasRoomBelow = rect.bottom + menuHeight + viewportPadding < window.innerHeight;
    const top = hasRoomBelow
      ? rect.bottom + 8
      : Math.max(viewportPadding, rect.top - menuHeight - 8);

    setOpenMenu({
      left,
      memberId: member.id,
      top,
    });
  }

  function updateMemberInTable(updatedMember: ManagedMemberClientRecord) {
    setMembers((current) =>
      current.map((member) => (member.id === updatedMember.id ? updatedMember : member))
    );
  }

  function toggleMemberSelection(memberId: string, checked: boolean) {
    setSelectedMemberIds((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(memberId);
      } else {
        next.delete(memberId);
      }
      return next;
    });
  }

  function toggleVisibleMembers(checked: boolean) {
    setSelectedMemberIds((current) => {
      const next = new Set(current);
      for (const memberId of visibleMemberIds) {
        if (checked) {
          next.add(memberId);
        } else {
          next.delete(memberId);
        }
      }
      return next;
    });
  }

  return (
    <section className="section-band" id="member-operations">
      <div className="membership-table-heading">
        <div>
          <span className="eyebrow">Member operations</span>
          <h2 className="mt-4 font-[family-name:var(--font-heading)] text-[clamp(2rem,3vw,2.7rem)] leading-[0.96] tracking-[-0.04em]">
            Lifecycle, access, and portal roles
          </h2>
        </div>
        <p>Click any row to edit inline</p>
      </div>

      <div className="membership-toolbar mt-6">
        <label className="input-label membership-search-field" htmlFor="member-ops-search">
          <span className="sr-only">Search members</span>
          <Search aria-hidden="true" size={14} />
          <input
            id="member-ops-search"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name, ID or email"
            value={search}
          />
        </label>
        <label className="input-label membership-lifecycle-filter" htmlFor="member-ops-lifecycle">
          <span className="sr-only">Lifecycle</span>
          <select
            id="member-ops-lifecycle"
            onChange={(event) =>
              updateMembershipQuery({
                memberLifecycle: event.target.value,
                memberPage: "1",
              })
            }
            value={memberLifecycleFilter}
          >
            <option value="">All lifecycles</option>
            {lifecycleValues.map((value) => (
              <option key={value} value={value}>
                {humanize(value)}
              </option>
            ))}
          </select>
        </label>
        <label className="input-label membership-role-filter" htmlFor="member-ops-role">
          <span className="sr-only">Portal role</span>
          <select
            id="member-ops-role"
            onChange={(event) =>
              updateMembershipQuery({
                memberPage: "1",
                memberRole: event.target.value,
              })
            }
            value={memberRoleFilter}
          >
            <option value="">All roles</option>
            {roleValues.map((role) => (
              <option key={role.code} value={role.code}>
                {role.display_name}
              </option>
            ))}
          </select>
        </label>
        <button
          className="membership-clear-link"
          onClick={() => {
            setSearch("");
            updateMembershipQuery({
              memberLifecycle: "",
              memberPage: "1",
              memberRole: "",
            });
          }}
          type="button"
        >
          Clear filters
        </button>
        <span className="membership-table-count">
          Showing {filteredMembers.length} of {managedMemberTotal} members
        </span>
      </div>

      {selectedMemberIds.size > 0 ? (
        <BulkMemberOperationsBar
          onClear={() => setSelectedMemberIds(new Set())}
          onMembersChanged={(updatedMembers) => {
            setMembers((current) =>
              current.map((member) => updatedMembers.find((updated) => updated.id === member.id) || member)
            );
            setSelectedMemberIds(new Set());
          }}
          portalRoleOptions={portalRoleOptions}
          selectedMembers={selectedMembers}
        />
      ) : null}

      {feedback ? <p className="membership-table-feedback">{feedback}</p> : null}

      <div className="membership-table-shell">
        <table className="membership-table">
          <thead>
            <tr>
              <th className="membership-table__checkbox">
                <input
                  aria-label="Select all visible members"
                  checked={allVisibleSelected}
                  onChange={(event) => toggleVisibleMembers(event.target.checked)}
                  type="checkbox"
                />
              </th>
              <th>Member</th>
              <th>Lifecycle</th>
              <th>Portal access</th>
              <th>Portal role</th>
              <th>Cycle</th>
              <th className="membership-table__actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredMembers.length === 0 ? (
              <tr>
                <td colSpan={7}>
                  <div className="empty-state">No members match the current filters.</div>
                </td>
              </tr>
            ) : (
              filteredMembers.map((member) => {
                const isSelected = selectedMemberIds.has(member.id);
                const cycleLabel = cycleLabelByJnuitsId.get(member.displayJnuitsId) || "-";

                return (
                  <tr
                    className="membership-table-row"
                    data-editing={editingMemberId === member.id}
                    data-selected={isSelected}
                    key={member.id}
                    onClick={() => setEditingMemberId(member.id)}
                  >
                    <td className="membership-table__checkbox">
                      <input
                        aria-label={`Select ${member.full_name}`}
                        checked={isSelected}
                        onChange={(event) => toggleMemberSelection(member.id, event.target.checked)}
                        onClick={(event) => event.stopPropagation()}
                        type="checkbox"
                      />
                    </td>
                    <td>
                      <div className="membership-table-member">
                        <MemberTableAvatar member={member} />
                        <span>
                          <strong>{member.full_name}</strong>
                          <small>
                            {member.displayJnuitsId} · {member.email || "No email"}
                          </small>
                        </span>
                      </div>
                    </td>
                    <td>
                      <TableBadge type="lifecycle" value={getMemberLifecycle(member)} />
                    </td>
                    <td>
                      <TableBadge type="access" value={getMemberPortalAccess(member)} />
                    </td>
                    <td className="membership-table__role">{humanize(member.currentPortalRole)}</td>
                    <td className="membership-table__cycle">{cycleLabel}</td>
                    <td className="membership-table__actions">
                      <div className="membership-row-actions">
                        <button
                          aria-label={`Edit ${member.full_name}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            setEditingMemberId(member.id);
                          }}
                          title="Edit member"
                          type="button"
                        >
                          <Pencil aria-hidden="true" size={13} />
                        </button>
                        <button
                          aria-label={`View ${member.full_name} history`}
                          onClick={(event) => {
                            event.stopPropagation();
                            setHistoryMember(member);
                          }}
                          title="History"
                          type="button"
                        >
                          <Clock3 aria-hidden="true" size={13} />
                        </button>
                        <div className="membership-row-menu-wrap">
                          <button
                            aria-label={`Open actions for ${member.full_name}`}
                            onClick={(event) => openMemberMenu(event, member)}
                            title="More actions"
                            type="button"
                          >
                            <Ellipsis aria-hidden="true" size={13} />
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {openMenu && menuMember ? (
        <div
          className="membership-row-menu"
          onClick={(event) => event.stopPropagation()}
          ref={menuRef}
          style={{ left: openMenu.left, top: openMenu.top }}
        >
          <button
            onClick={() => {
              setTransientFeedback("Use invitation batches to issue member invitations.");
              setOpenMenu(null);
            }}
            type="button"
          >
            Send invitation
          </button>
          <button
            onClick={() => {
              setEditingMemberId(menuMember.id);
              setOpenMenu(null);
            }}
            type="button"
          >
            Reset portal access
          </button>
          <button
            onClick={() => {
              setEditingMemberId(menuMember.id);
              setOpenMenu(null);
            }}
            type="button"
          >
            Move to alumni queue
          </button>
          <button
            onClick={() => {
              void copyMemberId(menuMember);
              setOpenMenu(null);
            }}
            type="button"
          >
            <Copy aria-hidden="true" size={13} />
            Copy member ID
          </button>
          <button
            className="membership-row-menu__danger"
            onClick={() => {
              setEditingMemberId(menuMember.id);
              setOpenMenu(null);
            }}
            type="button"
          >
            Revoke access
          </button>
        </div>
      ) : null}

      {editingMember ? (
        <ManagedMemberCard
          key={editingMember.id}
          member={editingMember}
          onClose={() => setEditingMemberId(null)}
          onSaved={(updatedMember) => {
            updateMemberInTable(updatedMember);
            setEditingMemberId(null);
          }}
          portalRoleOptions={portalRoleOptions}
        />
      ) : null}

      <div className="membership-pagination">
        <span>
          Page {currentPage} of {totalPages}
        </span>
        <div className="membership-pagination__pages">
          <button
            aria-label="Previous member page"
            disabled={currentPage <= 1}
            onClick={() => updateMembershipQuery({ memberPage: String(currentPage - 1) })}
            type="button"
          >
            ←
          </button>
          {pageItems.map((page, index) => (
            <Fragment key={page}>
              {index > 0 && page - pageItems[index - 1] > 1 ? <span aria-hidden="true">…</span> : null}
              <button
                aria-current={page === currentPage ? "page" : undefined}
                data-active={page === currentPage}
                onClick={() => updateMembershipQuery({ memberPage: String(page) })}
                type="button"
              >
                {page}
              </button>
            </Fragment>
          ))}
          <button
            aria-label="Next member page"
            disabled={currentPage >= totalPages}
            onClick={() => updateMembershipQuery({ memberPage: String(currentPage + 1) })}
            type="button"
          >
            →
          </button>
        </div>
        <label className="sr-only" htmlFor="member-page-size">
          Members per page
        </label>
        <select
          id="member-page-size"
          onChange={(event) =>
            updateMembershipQuery({
              memberPage: "1",
              memberPageSize: event.target.value,
            })
          }
          value={String(memberPageSize)}
        >
          <option value="15">15 / page</option>
          <option value="20">20 / page</option>
          <option value="50">50 / page</option>
        </select>
      </div>

      {historyMember ? (
        <div className="membership-history-panel" role="dialog" aria-label={`${historyMember.full_name} history`}>
          <div>
            <h3>{historyMember.full_name}</h3>
            <button aria-label="Close history panel" onClick={() => setHistoryMember(null)} type="button">
              <X aria-hidden="true" size={15} />
            </button>
          </div>
          <div className="membership-history-empty">
            <Clock3 aria-hidden="true" size={34} />
            <p>No changes recorded yet.</p>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function ManagedMemberCard({
  member,
  onClose,
  onSaved,
  portalRoleOptions,
}: {
  member: ManagedMemberClientRecord;
  onClose: () => void;
  onSaved: (member: ManagedMemberClientRecord) => void;
  portalRoleOptions: PortalRoleOptionClientRecord[];
}) {
  const [lifecycle, setLifecycle] = useState(getMemberLifecycle(member));
  const [portalAccess, setPortalAccess] = useState(getMemberPortalAccess(member));
  const [portalRole, setPortalRole] = useState(member.currentPortalRole);
  const [lifecycleNote, setLifecycleNote] = useState("");
  const [roleNote, setRoleNote] = useState("");
  const [isPending, startTransition] = useTransition();
  const [saveState, setSaveState] = useState<"idle" | "saved" | "saving">("idle");
  const [error, setError] = useState<null | string>(null);
  const [revokeConfirming, setRevokeConfirming] = useState(false);

  useEffect(() => {
    if (!revokeConfirming) {
      return undefined;
    }

    const timeout = window.setTimeout(() => setRevokeConfirming(false), 5000);
    return () => window.clearTimeout(timeout);
  }, [revokeConfirming]);

  const lifecycleDirty =
    lifecycle !== getMemberLifecycle(member) ||
    portalAccess !== getMemberPortalAccess(member) ||
    Boolean(lifecycleNote.trim());
  const roleDirty = member.user_id
    ? portalRole !== member.currentPortalRole || Boolean(roleNote.trim())
    : false;
  const canSave = lifecycleDirty || roleDirty;

  function save() {
    setError(null);
    setSaveState("saving");
    startTransition(async () => {
      try {
        await saveMemberOperationsAction({
          lifecycleNote,
          memberId: member.id,
          nextLifecycleStatus: lifecycle,
          nextPortalAccessStatus: portalAccess,
          nextPortalRole: portalRole,
          roleNote,
          updateLifecycle: lifecycleDirty,
          updatePortalRole: roleDirty,
        });
        setSaveState("saved");
        window.setTimeout(() => {
          onSaved({
            ...member,
            currentPortalRole: portalRole,
            lifecycle_status: lifecycle,
            portal_access_status: portalAccess,
          });
        }, 1800);
      } catch (saveError) {
        setSaveState("idle");
        setError(saveError instanceof Error ? saveError.message : "Unable to save member changes.");
      }
    });
  }

  function revokeAccess() {
    if (!revokeConfirming) {
      setRevokeConfirming(true);
      return;
    }

    setError(null);
    setSaveState("saving");
    startTransition(async () => {
      try {
        await saveMemberOperationsAction({
          lifecycleNote: "Portal access revoked from Membership DB.",
          memberId: member.id,
          nextLifecycleStatus: getMemberLifecycle(member),
          nextPortalAccessStatus: "suspended",
          nextPortalRole: member.currentPortalRole,
          roleNote: "",
          updateLifecycle: true,
          updatePortalRole: false,
        });
        onSaved({
          ...member,
          portal_access_status: "suspended",
        });
      } catch (saveError) {
        setSaveState("idle");
        setError(saveError instanceof Error ? saveError.message : "Unable to revoke portal access.");
      }
    });
  }

  return (
    <div className="membership-inline-editor">
      <div className="membership-inline-editor__header">
        <span>
          <strong>{member.full_name}</strong>
          <small>
            {member.displayJnuitsId} · {member.email || "No email"}
          </small>
        </span>
        <button className="ghost-button" onClick={onClose} type="button">
          <X aria-hidden="true" size={13} />
          Close
        </button>
      </div>
      <div className="membership-inline-editor__body">
        <label htmlFor={`inline-lifecycle-${member.id}`}>
          Lifecycle
          <select
            id={`inline-lifecycle-${member.id}`}
            onChange={(event) => setLifecycle(event.target.value)}
            value={lifecycle}
          >
            {lifecycleOptions.map((option) => (
              <option key={option} value={option}>
                {humanize(option)}
              </option>
            ))}
          </select>
        </label>
        <label htmlFor={`inline-access-${member.id}`}>
          Portal access
          <select
            id={`inline-access-${member.id}`}
            onChange={(event) => setPortalAccess(event.target.value)}
            value={portalAccess}
          >
            {portalAccessOptions.map((option) => (
              <option key={option} value={option}>
                {humanize(option)}
              </option>
            ))}
          </select>
        </label>
        <label htmlFor={`inline-role-${member.id}`}>
          Portal role
          <select
            disabled={!member.user_id}
            id={`inline-role-${member.id}`}
            onChange={(event) =>
              setPortalRole(event.target.value as ManagedMemberClientRecord["currentPortalRole"])
            }
            value={portalRole}
          >
            {portalRoleOptions.map((role) => (
              <option key={role.code} value={role.code}>
                {role.display_name}
              </option>
            ))}
          </select>
        </label>
        <label className="membership-inline-editor__wide" htmlFor={`inline-lifecycle-note-${member.id}`}>
          Lifecycle note
          <textarea
            id={`inline-lifecycle-note-${member.id}`}
            onChange={(event) => setLifecycleNote(event.target.value)}
            value={lifecycleNote}
          />
        </label>
        <label htmlFor={`inline-role-note-${member.id}`}>
          Role note
          <textarea
            disabled={!member.user_id}
            id={`inline-role-note-${member.id}`}
            onChange={(event) => setRoleNote(event.target.value)}
            value={roleNote}
          />
        </label>
      </div>
      <div className="membership-inline-editor__footer">
        <div>
          <button
            className="primary-button"
            data-state={saveState}
            disabled={!canSave || isPending || saveState === "saving"}
            onClick={save}
            type="button"
          >
            {saveState === "saving" || isPending ? (
              <span className="membership-spinner membership-spinner--sm" aria-hidden="true" />
            ) : saveState === "saved" ? (
              "✓ Saved"
            ) : (
              "Save changes"
            )}
          </button>
          <button className="ghost-button" onClick={onClose} type="button">
            Cancel
          </button>
        </div>
        <button className="admin-btn admin-btn--danger" onClick={revokeAccess} type="button">
          {revokeConfirming ? "Click again to confirm" : "Revoke access"}
        </button>
      </div>
      {error ? <p className="membership-inline-editor__error">{error}</p> : null}
    </div>
  );
}

function BulkMemberOperationsBar({
  onClear,
  onMembersChanged,
  portalRoleOptions,
  selectedMembers,
}: {
  onClear: () => void;
  onMembersChanged: (members: ManagedMemberClientRecord[]) => void;
  portalRoleOptions: PortalRoleOptionClientRecord[];
  selectedMembers: ManagedMemberClientRecord[];
}) {
  const [mode, setMode] = useState<null | "lifecycle" | "role">(null);
  const [bulkLifecycle, setBulkLifecycle] = useState("current");
  const [bulkRole, setBulkRole] = useState<ManagedMemberClientRecord["currentPortalRole"]>("member");
  const [bulkNote, setBulkNote] = useState("");
  const [error, setError] = useState<null | string>(null);
  const [revokeConfirming, setRevokeConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!revokeConfirming) {
      return undefined;
    }

    const timeout = window.setTimeout(() => setRevokeConfirming(false), 5000);
    return () => window.clearTimeout(timeout);
  }, [revokeConfirming]);

  function applyLifecycle() {
    setError(null);
    startTransition(async () => {
      try {
        await Promise.all(
          selectedMembers.map((member) =>
            saveMemberOperationsAction({
              lifecycleNote: bulkNote,
              memberId: member.id,
              nextLifecycleStatus: bulkLifecycle,
              nextPortalAccessStatus: getMemberPortalAccess(member),
              nextPortalRole: member.currentPortalRole,
              roleNote: "",
              updateLifecycle: true,
              updatePortalRole: false,
            })
          )
        );
        onMembersChanged(
          selectedMembers.map((member) => ({
            ...member,
            lifecycle_status: bulkLifecycle,
          }))
        );
      } catch (bulkError) {
        setError(bulkError instanceof Error ? bulkError.message : "Bulk lifecycle update failed.");
      }
    });
  }

  function applyRole() {
    const targets = selectedMembers.filter((member) => member.user_id);

    if (targets.length === 0) {
      setError("Selected members do not have linked portal accounts.");
      return;
    }

    setError(null);
    startTransition(async () => {
      try {
        await Promise.all(
          targets.map((member) =>
            saveMemberOperationsAction({
              lifecycleNote: "",
              memberId: member.id,
              nextLifecycleStatus: getMemberLifecycle(member),
              nextPortalAccessStatus: getMemberPortalAccess(member),
              nextPortalRole: bulkRole,
              roleNote: bulkNote,
              updateLifecycle: false,
              updatePortalRole: true,
            })
          )
        );
        onMembersChanged(
          targets.map((member) => ({
            ...member,
            currentPortalRole: bulkRole,
          }))
        );
      } catch (bulkError) {
        setError(bulkError instanceof Error ? bulkError.message : "Bulk role update failed.");
      }
    });
  }

  function revokeSelected() {
    if (!revokeConfirming) {
      setRevokeConfirming(true);
      return;
    }

    setError(null);
    startTransition(async () => {
      try {
        await Promise.all(
          selectedMembers.map((member) =>
            saveMemberOperationsAction({
              lifecycleNote: "Portal access revoked from Membership DB bulk action.",
              memberId: member.id,
              nextLifecycleStatus: getMemberLifecycle(member),
              nextPortalAccessStatus: "suspended",
              nextPortalRole: member.currentPortalRole,
              roleNote: "",
              updateLifecycle: true,
              updatePortalRole: false,
            })
          )
        );
        onMembersChanged(
          selectedMembers.map((member) => ({
            ...member,
            portal_access_status: "suspended",
          }))
        );
      } catch (bulkError) {
        setError(bulkError instanceof Error ? bulkError.message : "Bulk revoke failed.");
      }
    });
  }

  return (
    <div className="membership-bulk-member-bar">
      <div className="membership-bulk-member-bar__summary">
        <Check aria-hidden="true" size={14} />
        <strong>{selectedMembers.length} selected</strong>
        <button className="ghost-button" onClick={() => setMode("lifecycle")} type="button">
          Update lifecycle
        </button>
        <button className="ghost-button" onClick={() => setMode("role")} type="button">
          Update role
        </button>
        <button className="admin-btn admin-btn--danger" onClick={revokeSelected} type="button">
          {revokeConfirming ? "Click again to confirm" : "Revoke access"}
        </button>
        <button className="ghost-button" onClick={onClear} type="button">
          Clear
        </button>
      </div>
      {mode ? (
        <div className="membership-bulk-member-bar__form">
          {mode === "lifecycle" ? (
            <label htmlFor="bulk-lifecycle">
              Lifecycle
              <select
                id="bulk-lifecycle"
                onChange={(event) => setBulkLifecycle(event.target.value)}
                value={bulkLifecycle}
              >
                {lifecycleOptions.map((option) => (
                  <option key={option} value={option}>
                    {humanize(option)}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label htmlFor="bulk-role">
              Role
              <select
                id="bulk-role"
                onChange={(event) =>
                  setBulkRole(event.target.value as ManagedMemberClientRecord["currentPortalRole"])
                }
                value={bulkRole}
              >
                {portalRoleOptions.map((role) => (
                  <option key={role.code} value={role.code}>
                    {role.display_name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label htmlFor="bulk-note">
            Note
            <textarea
              id="bulk-note"
              onChange={(event) => setBulkNote(event.target.value)}
              value={bulkNote}
            />
          </label>
          <button
            className="primary-button"
            disabled={isPending}
            onClick={mode === "lifecycle" ? applyLifecycle : applyRole}
            type="button"
          >
            {isPending ? (
              <span className="membership-spinner membership-spinner--sm" aria-hidden="true" />
            ) : (
              "Apply to all"
            )}
          </button>
        </div>
      ) : null}
      {error ? <p className="membership-inline-editor__error">{error}</p> : null}
    </div>
  );
}

function AccountRequestsSection({
  accountRequests,
}: {
  accountRequests: AccountRequestClientRecord[];
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [confirmDecision, setConfirmDecision] = useState<null | "approved" | "rejected">(null);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<null | string>(null);
  const [error, setError] = useState<null | string>(null);
  const allSelected = accountRequests.length > 0 && selected.length === accountRequests.length;

  function toggleAll(checked: boolean) {
    setSelected(checked ? accountRequests.map((request) => request.id) : []);
  }

  function toggleOne(id: string, checked: boolean) {
    setSelected((current) =>
      checked ? Array.from(new Set([...current, id])) : current.filter((value) => value !== id)
    );
  }

  function confirmBulk() {
    if (!confirmDecision || selected.length === 0) return;
    setError(null);
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await bulkReviewMemberAccountRequestsAction({
          decision: confirmDecision,
          requestIds: selected,
          reviewNote: `Bulk ${confirmDecision} from Membership DB.`,
        });
        setSelected([]);
        setConfirmDecision(null);
        setMessage(result.message);
      } catch (bulkError) {
        setError(
          bulkError instanceof Error
            ? bulkError.message
            : "Bulk review could not be completed."
        );
      }
    });
  }

  return (
    <section className="section-band" id="alumni-queue">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="eyebrow">Account request reviews</span>
          <h2 className="mt-4 font-[family-name:var(--font-heading)] text-[clamp(2rem,3vw,2.7rem)] leading-[0.96] tracking-[-0.04em]">
            Alumni conversion and deletion queue
          </h2>
        </div>
        <span className="status-pill membership-pending-count" data-pending={accountRequests.length > 0}>
          {accountRequests.length} pending
        </span>
      </div>

      <div className="mt-6 grid gap-4">
        {accountRequests.length === 0 ? (
          <div className="empty-state">No account requests pending review.</div>
        ) : (
          <>
            <div className="membership-bulk-toolbar">
              <label className="membership-checkbox-row" htmlFor="account-select-all">
                <input
                  checked={allSelected}
                  id="account-select-all"
                  onChange={(event) => toggleAll(event.target.checked)}
                  type="checkbox"
                />
                Select all
              </label>
              <button
                className="admin-btn admin-btn--success"
                disabled={selected.length === 0}
                onClick={() => setConfirmDecision("approved")}
                type="button"
              >
                Approve selected
              </button>
              <button
                className="admin-btn admin-btn--danger"
                disabled={selected.length === 0}
                onClick={() => setConfirmDecision("rejected")}
                type="button"
              >
                Reject selected
              </button>
              <span className="text-sm text-[var(--muted-foreground)]">
                {selected.length} selected
              </span>
            </div>
            {confirmDecision ? (
              <div className="membership-confirm-bar">
                <span>{humanize(confirmDecision)} {selected.length} requests?</span>
                <button
                  className="admin-btn admin-btn--primary"
                  disabled={isPending}
                  onClick={confirmBulk}
                  type="button"
                >
                  {isPending ? <span className="membership-spinner" aria-hidden="true" /> : "Confirm"}
                </button>
                <button
                  className="ghost-button"
                  disabled={isPending}
                  onClick={() => setConfirmDecision(null)}
                  type="button"
                >
                  Cancel
                </button>
              </div>
            ) : null}
            {message ? <p className="portal-message portal-message--success">{message}</p> : null}
            {error ? <p className="portal-message portal-message--error">{error}</p> : null}
            {accountRequests.map((request) => (
              <article key={request.id} className="route-tile">
                <div className="grid gap-5 xl:grid-cols-[auto_minmax(0,1fr)_minmax(20rem,0.7fr)]">
                  <input
                    aria-label={`Select ${request.memberName}`}
                    checked={selected.includes(request.id)}
                    onChange={(event) => toggleOne(request.id, event.target.checked)}
                    type="checkbox"
                  />
                  <div>
                    <h3>{request.request_type.replaceAll("_", " ")}</h3>
                    <p className="mt-2 text-sm text-[var(--muted-foreground)]">
                      {request.memberName} • {request.displayJnuitsId}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <StatusBadge value={request.status} />
                      <MemberChip>Requested {request.requested_at.slice(0, 10)}</MemberChip>
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <form action={reviewMemberAccountRequestAction} className="grid gap-2">
                      <input name="requestId" type="hidden" value={request.id} />
                      <input name="decision" type="hidden" value="approved" />
                      <label className="input-label" htmlFor={`approval-note-${request.id}`}>
                        Review note
                        <input
                          id={`approval-note-${request.id}`}
                          name="reviewNote"
                          placeholder="Approval note"
                        />
                      </label>
                      <PendingSubmitButton>Approve request</PendingSubmitButton>
                    </form>
                    <form action={reviewMemberAccountRequestAction} className="grid gap-2">
                      <input name="requestId" type="hidden" value={request.id} />
                      <input name="decision" type="hidden" value="rejected" />
                      <label className="input-label" htmlFor={`rejection-note-${request.id}`}>
                        Rejection note
                        <input
                          id={`rejection-note-${request.id}`}
                          name="reviewNote"
                          placeholder="Reason for rejection"
                        />
                      </label>
                      <PendingSubmitButton className="secondary-button">Reject request</PendingSubmitButton>
                    </form>
                  </div>
                </div>
              </article>
            ))}
          </>
        )}
      </div>
    </section>
  );
}

function DatePickerField({
  error,
  label,
  name,
  onChange,
  required = false,
  value,
}: {
  error?: null | string;
  label: string;
  name: string;
  onChange: (value: string) => void;
  required?: boolean;
  value: string;
}) {
  const [open, setOpen] = useState(false);
  const initialDate = parseIsoDate(value) || new Date();
  const [visibleMonth, setVisibleMonth] = useState(
    new Date(initialDate.getFullYear(), initialDate.getMonth(), 1)
  );
  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const offset = new Date(year, month, 1).getDay();
  const monthLabel = new Intl.DateTimeFormat("en", {
    month: "long",
    year: "numeric",
  }).format(visibleMonth);
  const cells = [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ];

  return (
    <label className="input-label membership-date-field">
      <span>
        {label}
        {required ? <span className="membership-required">*</span> : null}
      </span>
      <input name={name} readOnly type="hidden" value={value} />
      <div className="membership-date-control">
        <button
          aria-label={`Open ${label} calendar`}
          data-empty={!value}
          data-invalid={Boolean(error)}
          onClick={() => setOpen((current) => !current)}
          className="membership-date-button"
          type="button"
        >
          <span>{value ? formatDateDisplay(value) : "Select date"}</span>
          <CalendarDays aria-hidden="true" size={16} />
        </button>
        {open ? (
          <div className="membership-calendar" role="dialog">
            <div className="membership-calendar__header">
              <button
                aria-label="Previous month"
                onClick={() => setVisibleMonth(new Date(year, month - 1, 1))}
                type="button"
              >
                <ChevronLeft aria-hidden="true" size={15} />
              </button>
              <strong>{monthLabel}</strong>
              <button
                aria-label="Next month"
                onClick={() => setVisibleMonth(new Date(year, month + 1, 1))}
                type="button"
              >
                <ChevronRight aria-hidden="true" size={15} />
              </button>
            </div>
            <div className="membership-calendar__grid">
              {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => (
                <span key={`${day}-${index}`}>{day}</span>
              ))}
              {cells.map((day, index) =>
                day ? (
                  <button
                    data-selected={value === toIsoDate(new Date(year, month, day))}
                    key={`${year}-${month}-${day}`}
                    onClick={() => {
                      onChange(toIsoDate(new Date(year, month, day)));
                      setOpen(false);
                    }}
                    type="button"
                  >
                    {day}
                  </button>
                ) : (
                  <i key={`blank-${index}`} />
                )
              )}
            </div>
          </div>
        ) : null}
      </div>
      {error ? <span className="membership-field-error">{error}</span> : null}
    </label>
  );
}

function CycleAndEnrollmentForms({
  cycles,
}: {
  cycles: MembershipCycleClientRecord[];
}) {
  const currentYear = new Date().getFullYear();
  const [codeLocked, setCodeLocked] = useState(true);
  const [startsOn, setStartsOn] = useState("");
  const [endsOn, setEndsOn] = useState("");
  const [renewalOpenOn, setRenewalOpenOn] = useState("");
  const [renewalCloseOn, setRenewalCloseOn] = useState("");
  const [selectedCycleId, setSelectedCycleId] = useState("");
  const [expiresOn, setExpiresOn] = useState("");
  const [memberJnuitsId, setMemberJnuitsId] = useState("");
  const [lookupPending, setLookupPending] = useState(false);
  const [lookupResult, setLookupResult] = useState<null | {
    displayJnuitsId: string;
    fullName: string;
    id: string;
  }>(null);
  const [lookupError, setLookupError] = useState<null | string>(null);

  const cycleErrors = {
    endsOn:
      startsOn && endsOn && compareIsoDates(endsOn, startsOn) <= 0
        ? "End date must be after start date."
        : null,
    renewalCloseOn:
      renewalOpenOn && renewalCloseOn && compareIsoDates(renewalCloseOn, renewalOpenOn) <= 0
        ? "Renewal close date must be after renewal open date."
        : renewalCloseOn && endsOn && compareIsoDates(renewalCloseOn, endsOn) > 0
          ? "Renewal close date must be within the cycle."
          : null,
    renewalOpenOn:
      renewalOpenOn && startsOn && compareIsoDates(renewalOpenOn, startsOn) < 0
        ? "Renewal open date must be on or after cycle start."
        : renewalOpenOn && endsOn && compareIsoDates(renewalOpenOn, endsOn) > 0
          ? "Renewal open date must be within the cycle."
          : null,
  };
  const hasCycleDateError =
    !startsOn || !endsOn || Object.values(cycleErrors).some(Boolean);
  const selectedCycle = cycles.find((cycle) => cycle.id === selectedCycleId);

  async function verifyMember() {
    const value = memberJnuitsId.trim();
    setLookupResult(null);
    setLookupError(null);
    if (!value) return;

    setLookupPending(true);
    try {
      const result = await lookupMemberForCycleAction({ jnuitsId: value });
      if (!result) {
        setLookupError("Member not found.");
      } else {
        setLookupResult(result);
      }
    } catch (error) {
      setLookupError(error instanceof Error ? error.message : "Member lookup failed.");
    } finally {
      setLookupPending(false);
    }
  }

  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1.04fr)_minmax(0,0.96fr)]">
      <form action={createMembershipCycleAction} className="section-band grid gap-4" id="cycle-management">
        <div>
          <span className="eyebrow">Cycle management</span>
          <h2 className="mt-4 font-[family-name:var(--font-heading)] text-[clamp(2rem,3vw,2.6rem)] leading-[0.96] tracking-[-0.04em]">
            Create membership cycle windows
          </h2>
          <p className="mt-3 text-xs text-[var(--muted-foreground)]">
            <span className="membership-required">*</span> Required field
          </p>
        </div>
        <div className="portal-form-grid">
          <label className="input-label membership-code-field" htmlFor="cycle-code">
            <span>
              Cycle code
              <span className="membership-required">*</span>
            </span>
            <input
              defaultValue={`cycle-${currentYear}`}
              id="cycle-code"
              name="code"
              placeholder="cycle-2026"
              readOnly={codeLocked}
              required
            />
            <button
              aria-label={codeLocked ? "Unlock cycle code" : "Lock cycle code"}
              onClick={() => setCodeLocked((current) => !current)}
              type="button"
            >
              {codeLocked ? <Lock aria-hidden="true" size={15} /> : <Unlock aria-hidden="true" size={15} />}
            </button>
            <span className="membership-code-tooltip">
              {codeLocked
                ? "Auto-generated. Click to unlock and edit manually."
                : "Click to lock this code again."}
            </span>
            {!codeLocked ? (
              <span className="membership-field-warning">
                Changing the cycle code may break external references.
              </span>
            ) : null}
          </label>

          <label className="input-label" htmlFor="cycle-status">
            <span>
              Status
              <span className="membership-required">*</span>
              <InfoTooltip ariaLabel="Cycle status information">
                <strong>Draft</strong> — Not yet active; visible only to admins
                <br />
                <strong>Active</strong> — Current renewal cycle accepting members
                <br />
                <strong>Closed</strong> — No new enrollments; historical record only
                <br />
                <strong>Archived</strong> — Hidden from normal views
              </InfoTooltip>
            </span>
            <select defaultValue="draft" id="cycle-status" name="status" required>
              {cycleStatuses.map((status) => (
                <option key={status} value={status}>
                  {humanize(status)}
                </option>
              ))}
            </select>
          </label>

          <label className="input-label sm:col-span-2" htmlFor="cycle-title">
            <span>
              Cycle title
              <span className="membership-required">*</span>
            </span>
            <input id="cycle-title" name="title" placeholder="Membership Cycle 2026" required />
          </label>

          <DatePickerField
            label="Starts on"
            name="startsOn"
            onChange={setStartsOn}
            required
            value={startsOn}
          />
          <DatePickerField
            error={cycleErrors.endsOn}
            label="Ends on"
            name="endsOn"
            onChange={setEndsOn}
            required
            value={endsOn}
          />
          <DatePickerField
            error={cycleErrors.renewalOpenOn}
            label="Renewal opens"
            name="renewalOpenOn"
            onChange={setRenewalOpenOn}
            value={renewalOpenOn}
          />
          <DatePickerField
            error={cycleErrors.renewalCloseOn}
            label="Renewal closes"
            name="renewalCloseOn"
            onChange={setRenewalCloseOn}
            value={renewalCloseOn}
          />
        </div>
        <PendingSubmitButton disabled={hasCycleDateError}>Save cycle</PendingSubmitButton>
      </form>

      <form action={enrollMemberInCycleAction} className="section-band grid gap-4" id="member-enrollment">
        <div>
          <span className="eyebrow">Member-cycle state</span>
          <h2 className="mt-4 font-[family-name:var(--font-heading)] text-[clamp(2rem,3vw,2.6rem)] leading-[0.96] tracking-[-0.04em]">
            Enroll member into cycle
          </h2>
        </div>
        <div className="portal-form-grid">
          <label className="input-label" htmlFor="enroll-cycle">
            Cycle
            <select
              id="enroll-cycle"
              name="cycleId"
              onChange={(event) => {
                const nextCycle = cycles.find((cycle) => cycle.id === event.target.value);
                setSelectedCycleId(event.target.value);
                if (nextCycle?.ends_on) setExpiresOn(nextCycle.ends_on);
              }}
              required
              value={selectedCycleId}
            >
              <option value="">Select cycle</option>
              {cycles.map((cycle) => (
                <option key={cycle.id} value={cycle.id}>
                  {cycle.code} • {cycle.title}
                </option>
              ))}
            </select>
          </label>
          <label className="input-label" htmlFor="enroll-state">
            <span>
              State
              <InfoTooltip ariaLabel="Cycle member state information">
                Controls this member&apos;s enrollment status within the selected cycle.
              </InfoTooltip>
            </span>
            <select defaultValue="active" id="enroll-state" name="memberState">
              {cycleMemberStates.map((state) => (
                <option key={state} value={state}>
                  {humanize(state)}
                </option>
              ))}
            </select>
          </label>
          <label className="input-label sm:col-span-2 membership-lookup-field" htmlFor="member-jnuits-id">
            Member JnUITS ID
            <input
              id="member-jnuits-id"
              name="memberJnuitsId"
              onBlur={verifyMember}
              onChange={(event) => {
                setMemberJnuitsId(event.target.value);
                setLookupResult(null);
                setLookupError(null);
              }}
              placeholder="JnUITS-2026001"
              required
              value={memberJnuitsId}
            />
            <span className="membership-lookup-indicator">
              {lookupPending ? (
                <span className="membership-spinner" aria-hidden="true" />
              ) : lookupResult ? (
                "✓"
              ) : lookupError ? (
                "✕"
              ) : null}
            </span>
            {lookupResult ? (
              <span className="portal-message portal-message--success">
                {lookupResult.fullName} · {lookupResult.displayJnuitsId}
              </span>
            ) : null}
            {lookupError ? <span className="portal-message portal-message--error">{lookupError}</span> : null}
          </label>
          <DatePickerField
            label="Expires on"
            name="expiresOn"
            onChange={setExpiresOn}
            value={expiresOn}
          />
          <label className="input-label" htmlFor="enroll-note">
            Note
            <input id="enroll-note" name="note" placeholder="Cycle enrollment note" />
          </label>
        </div>
        {selectedCycle?.ends_on ? (
          <p className="text-xs text-[var(--muted-foreground)]">
            Defaulted to cycle end date — edit if needed.
          </p>
        ) : null}
        <PendingSubmitButton disabled={Boolean(memberJnuitsId.trim()) && (!lookupResult || lookupPending)}>
          Add / update member in cycle
        </PendingSubmitButton>
      </form>
    </section>
  );
}

function InvitationBatchForms({
  batches,
  cycleMembers,
  cycles,
}: {
  batches: InvitationBatchClientRecord[];
  cycleMembers: CycleMemberClientRecord[];
  cycles: MembershipCycleClientRecord[];
}) {
  const [expiresDate, setExpiresDate] = useState("");
  const [expiresTime, setExpiresTime] = useState("23:59");
  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [onlyPending, setOnlyPending] = useState(true);
  const [confirmIssue, setConfirmIssue] = useState(false);
  const [expiryDays, setExpiryDays] = useState("14");
  const [maxUses, setMaxUses] = useState("1");
  const [previewPending, setPreviewPending] = useState(false);
  const previewTimerRef = useRef<number | null>(null);
  const selectedBatch = batches.find((batch) => batch.id === selectedBatchId);
  const previewCount =
    selectedBatch?.cycle_id
      ? cycleMembers.filter(
          (row) =>
            row.cycle_id === selectedBatch.cycle_id &&
            (!onlyPending || row.state === "pending_renewal")
        ).length
      : 0;
  const expiryError =
    Number(expiryDays) < 1 || Number(expiryDays) > 365 ? "Expiry days must be 1–365." : null;
  const maxUsesError =
    Number(maxUses) < 1 || Number(maxUses) > 1000
      ? "Max uses must be 1–1000."
      : null;

  function markPreviewPending() {
    setPreviewPending(true);
    if (previewTimerRef.current) {
      window.clearTimeout(previewTimerRef.current);
    }
    previewTimerRef.current = window.setTimeout(() => setPreviewPending(false), 250);
  }

  useEffect(() => {
    return () => {
      if (previewTimerRef.current) {
        window.clearTimeout(previewTimerRef.current);
      }
    };
  }, []);

  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1.04fr)_minmax(0,0.96fr)]" id="invitation-batches">
      <form action={createInvitationBatchAction} className="section-band grid gap-4">
        <div>
          <span className="eyebrow">Invitation batches</span>
          <h2 className="mt-4 font-[family-name:var(--font-heading)] text-[clamp(2rem,3vw,2.6rem)] leading-[0.96] tracking-[-0.04em]">
            Create invitation batch
          </h2>
        </div>
        <div className="portal-form-grid">
          <label className="input-label sm:col-span-2" htmlFor="batch-label">
            Label
            <input id="batch-label" name="label" placeholder="Renewal outreach batch A" required />
          </label>
          <label className="input-label" htmlFor="batch-source">
            Source
            <select defaultValue="renewal" id="batch-source" name="source">
              <option value="manual">Manual</option>
              <option value="csv_onboarding">CSV onboarding</option>
              <option value="reconciliation">Reconciliation</option>
              <option value="renewal">Renewal</option>
            </select>
          </label>
          <label className="input-label" htmlFor="batch-status">
            Status
            <select defaultValue="draft" id="batch-status" name="status">
              {batchStatuses.map((status) => (
                <option key={status} value={status}>
                  {humanize(status)}
                </option>
              ))}
            </select>
          </label>
          <label className="input-label" htmlFor="batch-cycle">
            Linked cycle
            <select id="batch-cycle" name="cycleId">
              <option value="">No cycle link</option>
              {cycles.map((cycle) => (
                <option key={cycle.id} value={cycle.id}>
                  {cycle.code}
                </option>
              ))}
            </select>
          </label>
          <div className="grid gap-2">
            <DatePickerField
              label="Expires at"
              name="expiresAtDate"
              onChange={setExpiresDate}
              value={expiresDate}
            />
            <label className="input-label" htmlFor="batch-expiry-time">
              Time
              <input
                id="batch-expiry-time"
                onChange={(event) => setExpiresTime(event.target.value)}
                pattern="\\d{2}:\\d{2}"
                placeholder="23:59"
                value={expiresTime}
              />
            </label>
            <input
              name="expiresAt"
              readOnly
              type="hidden"
              value={expiresDate ? `${expiresDate}T${expiresTime}` : ""}
            />
          </div>
        </div>
        <PendingSubmitButton>Save batch</PendingSubmitButton>
      </form>

      <form action={issueInvitationsFromBatchAction} className="section-band grid gap-4">
        <div>
          <span className="eyebrow">Renewal queue issue</span>
          <h2 className="mt-4 font-[family-name:var(--font-heading)] text-[clamp(2rem,3vw,2.6rem)] leading-[0.96] tracking-[-0.04em]">
            Issue invitations from cycle queue
          </h2>
        </div>
        <div className="portal-form-grid">
          <label className="input-label sm:col-span-2" htmlFor="issue-batch">
            Batch
            <select
              id="issue-batch"
              name="batchId"
              onChange={(event) => {
                setSelectedBatchId(event.target.value);
                setConfirmIssue(false);
                markPreviewPending();
              }}
              required
              value={selectedBatchId}
            >
              <option value="">Select batch</option>
              {batches.map((batch) => (
                <option key={batch.id} value={batch.id}>
                  {batch.label} ({batch.status})
                </option>
              ))}
            </select>
          </label>
          <label className="input-label" htmlFor="expiry-days">
            Expiry days
            <input
              aria-invalid={Boolean(expiryError)}
              id="expiry-days"
              max={365}
              min={1}
              name="invitationExpiresInDays"
              onChange={(event) => setExpiryDays(event.target.value)}
              type="number"
              value={expiryDays}
            />
            <span className="membership-helper">1–365 days</span>
            {expiryError ? <span className="membership-field-error">{expiryError}</span> : null}
          </label>
          <label className="input-label" htmlFor="max-uses">
            Max uses
            <input
              aria-invalid={Boolean(maxUsesError)}
              id="max-uses"
              max={1000}
              min={1}
              name="maxUses"
              onChange={(event) => setMaxUses(event.target.value)}
              type="number"
              value={maxUses}
            />
            <span className="membership-helper">1–1000 uses per invitation link</span>
            {maxUsesError ? <span className="membership-field-error">{maxUsesError}</span> : null}
          </label>
          <label className="toggle-label sm:col-span-2" htmlFor="only-pending-renewal">
            <input
              className="toggle-input"
              checked={onlyPending}
              id="only-pending-renewal"
              name="onlyPendingRenewal"
              onChange={(event) => {
                setOnlyPending(event.target.checked);
                markPreviewPending();
              }}
              type="checkbox"
              value="true"
            />
            <span className="toggle-track" aria-hidden="true">
              <span className="toggle-thumb" />
            </span>
            <span className="toggle-text">Pending renewal members only</span>
          </label>
        </div>

        <button
          className="primary-button"
          disabled={!selectedBatchId || Boolean(expiryError || maxUsesError)}
          onClick={() => setConfirmIssue(true)}
          type="button"
        >
          Issue invitations
        </button>
        {confirmIssue ? (
          <div className="membership-confirm-bar membership-confirm-bar--warning">
            <span>
              {previewPending ? (
                <span className="membership-spinner" aria-hidden="true" />
              ) : (
                `Issue invitations to ${previewCount} pending members using batch "${selectedBatch?.label || "selected batch"}"? This cannot be undone.`
              )}
            </span>
            <PendingSubmitButton className="admin-btn admin-btn--danger" disabled={previewPending}>
              Confirm — issue now
            </PendingSubmitButton>
            <button className="ghost-button" onClick={() => setConfirmIssue(false)} type="button">
              Cancel
            </button>
          </div>
        ) : null}
      </form>
    </section>
  );
}

function EmptyRegistryState({
  body,
  cta,
  icon,
  title,
}: {
  body: string;
  cta?: { label: string; targetId: string };
  icon: "calendar" | "mail" | "refresh";
  title: string;
}) {
  const Icon = icon === "calendar" ? CalendarDays : icon === "mail" ? Mail : RefreshCw;
  return (
    <div className="membership-empty-state">
      <Icon aria-hidden="true" size={48} />
      <h3>{title}</h3>
      <p>{body}</p>
      {cta ? (
        <button className="ghost-button" onClick={() => scrollToSection(cta.targetId)} type="button">
          {cta.label}
        </button>
      ) : null}
    </div>
  );
}

function RegistrySections({
  batches,
  cycles,
  cycleMembers,
}: {
  batches: InvitationBatchClientRecord[];
  cycles: MembershipCycleClientRecord[];
  cycleMembers: CycleMemberClientRecord[];
}) {
  return (
    <>
      <section className="section-band" id="cycle-registry">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <span className="eyebrow">Cycle registry</span>
            <h2 className="mt-4 font-[family-name:var(--font-heading)] text-[clamp(2rem,3vw,2.7rem)] leading-[0.96] tracking-[-0.04em]">
              Membership cycles and status transitions
            </h2>
          </div>
        </div>
        <div className="mt-6 grid gap-4">
          {cycles.length === 0 ? (
            <EmptyRegistryState
              body="Create your first cycle using the form above."
              cta={{ label: "Create cycle", targetId: "cycle-management" }}
              icon="calendar"
              title="No membership cycles created yet"
            />
          ) : (
            cycles.map((cycle) => (
              <article key={cycle.id} className="application-card">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-[family-name:var(--font-heading)] text-[1.8rem] leading-[0.98] tracking-[-0.04em]">
                      {cycle.title}
                    </h3>
                    <p className="mt-2 text-sm text-[var(--muted-foreground)]">
                      {cycle.code} • {cycle.starts_on}
                      {cycle.ends_on ? ` → ${cycle.ends_on}` : ""}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <MemberChip>Status: {humanize(cycle.status)}</MemberChip>
                      {cycle.renewal_open_on ? (
                        <MemberChip>Renewal opens {cycle.renewal_open_on}</MemberChip>
                      ) : null}
                      {cycle.renewal_close_on ? (
                        <MemberChip>Renewal closes {cycle.renewal_close_on}</MemberChip>
                      ) : null}
                    </div>
                  </div>
                  <form action={updateMembershipCycleStatusAction} className="grid gap-2">
                    <input name="cycleId" type="hidden" value={cycle.id} />
                    <label className="input-label" htmlFor={`cycle-status-${cycle.id}`}>
                      Update status
                      <select
                        defaultValue={cycle.status}
                        id={`cycle-status-${cycle.id}`}
                        name="nextStatus"
                      >
                        {cycleStatuses.map((status) => (
                          <option key={status} value={status}>
                            {humanize(status)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <PendingSubmitButton className="secondary-button">Apply status</PendingSubmitButton>
                  </form>
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      <section className="section-band" id="renewal-queue">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <span className="eyebrow">Renewal queue</span>
            <h2 className="mt-4 font-[family-name:var(--font-heading)] text-[clamp(2rem,3vw,2.7rem)] leading-[0.96] tracking-[-0.04em]">
              Cycle member state queue
            </h2>
          </div>
        </div>
        <div className="mt-6 grid gap-4">
          {cycleMembers.length === 0 ? (
            <EmptyRegistryState
              body="Members will appear here when pending renewal."
              icon="refresh"
              title="Renewal queue is empty"
            />
          ) : (
            cycleMembers.map((row) => (
              <article key={row.id} className="route-tile">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3>{row.memberName}</h3>
                    <p className="mt-2 text-sm text-[var(--muted-foreground)]">
                      {row.displayJnuitsId} • Cycle row {row.cycle_id}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <StatusBadge value={row.state} />
                      {row.expires_on ? <MemberChip>Expires {row.expires_on}</MemberChip> : null}
                      <MemberChip>{row.isProfileClaimed ? "Claimed" : "Not claimed"}</MemberChip>
                    </div>
                  </div>
                  <form action={updateCycleMemberStateAction} className="grid gap-2 sm:min-w-[280px]">
                    <input name="rowId" type="hidden" value={row.id} />
                    <label className="input-label" htmlFor={`cycle-member-state-${row.id}`}>
                      Next state
                      <select id={`cycle-member-state-${row.id}`} name="nextState" defaultValue={row.state}>
                        {cycleMemberStates.map((state) => (
                          <option key={state} value={state}>
                            {humanize(state)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="input-label" htmlFor={`cycle-member-note-${row.id}`}>
                      Note
                      <input id={`cycle-member-note-${row.id}`} name="note" defaultValue={row.note || ""} />
                    </label>
                    <PendingSubmitButton className="secondary-button">Update member state</PendingSubmitButton>
                  </form>
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      <section className="section-band" id="batch-registry">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <span className="eyebrow">Invitation batches</span>
            <h2 className="mt-4 font-[family-name:var(--font-heading)] text-[clamp(2rem,3vw,2.7rem)] leading-[0.96] tracking-[-0.04em]">
              Batch registry and sync controls
            </h2>
          </div>
        </div>
        <div className="mt-6 grid gap-4">
          {batches.length === 0 ? (
            <EmptyRegistryState
              body="Create a batch above and it will appear here."
              cta={{ label: "Create batch", targetId: "invitation-batches" }}
              icon="mail"
              title="No invitation batches yet"
            />
          ) : (
            batches.map((batch) => (
              <article key={batch.id} className="application-card">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-[family-name:var(--font-heading)] text-[1.6rem] leading-[0.98] tracking-[-0.04em]">
                      {batch.label}
                    </h3>
                    <p className="mt-2 text-sm text-[var(--muted-foreground)]">
                      Source {batch.source} • status {batch.status}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <MemberChip>Issued {batch.issued_count}</MemberChip>
                      <MemberChip>Claimed {batch.claimed_count}</MemberChip>
                      <MemberChip>{batch.cycle_id ? "Cycle linked" : "No cycle link"}</MemberChip>
                    </div>
                  </div>
                  <div className="grid gap-2 sm:min-w-[290px]">
                    <form action={updateInvitationBatchStatusAction} className="grid gap-2">
                      <input name="batchId" type="hidden" value={batch.id} />
                      <label className="input-label" htmlFor={`batch-status-${batch.id}`}>
                        Update status
                        <select
                          defaultValue={batch.status}
                          id={`batch-status-${batch.id}`}
                          name="nextStatus"
                        >
                          {batchStatuses.map((status) => (
                            <option key={status} value={status}>
                              {humanize(status)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <PendingSubmitButton className="secondary-button">Apply batch status</PendingSubmitButton>
                    </form>
                    <form action={syncInvitationBatchMetricsAction}>
                      <input name="batchId" type="hidden" value={batch.id} />
                      <PendingSubmitButton className="ghost-button w-full">
                        Sync issued/claimed metrics
                      </PendingSubmitButton>
                    </form>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </>
  );
}

export function MembershipDbClient({
  accountRequests,
  activeCycle,
  activeMembersInCycles,
  batches,
  cycles,
  cycleMembers,
  flash,
  managedMemberTotal,
  managedMembers,
  memberLifecycleFilter,
  memberPage,
  memberPageSize,
  memberRoleFilter,
  pendingRenewals,
  portalRoleOptions,
  totalClaimedInvitations,
  totalIssuedInvitations,
}: MembershipDbClientProps) {
  return (
    <div className="membership-db grid gap-8">
      <div className="admin-page-header">
        <div>
          <p className="admin-page-header__breadcrumb">Admin / Membership</p>
          <h1 className="admin-page-header__title">Membership DB</h1>
          <p className="admin-page-header__desc">
            Cycle lifecycle management, renewal queue, member-cycle state transitions, and invitation batch controls.
          </p>
        </div>
        {activeCycle ? <StatusBadge value={`${activeCycle.code} active`} /> : null}
      </div>

      {flash ? (
        <section className="flash-panel" data-tone={flash.tone}>
          <p className="text-sm font-bold uppercase tracking-[0.22em] text-[var(--muted-foreground)]">
            Operator feedback
          </p>
          <h2 className="mt-2 font-[family-name:var(--font-heading)] text-2xl font-semibold tracking-[-0.03em]">
            {flash.title}
          </h2>
          <p className="section-copy mt-2">{flash.message}</p>
        </section>
      ) : null}

      <StatsBar
        activeCycle={activeCycle}
        activeMembersInCycles={activeMembersInCycles}
        cyclesCount={cycles.length}
        pendingRenewals={pendingRenewals}
        totalClaimedInvitations={totalClaimedInvitations}
        totalIssuedInvitations={totalIssuedInvitations}
      />

      <WorkflowProgress
        activeMembersInCycles={activeMembersInCycles}
        batchesCount={batches.length}
        cyclesCount={cycles.length}
        issuedCount={totalIssuedInvitations}
      />

      <StickySectionNav />

      <MemberOperationsSection
        key={`${memberPage}:${memberPageSize}:${memberLifecycleFilter}:${memberRoleFilter}`}
        cycles={cycles}
        cycleMembers={cycleMembers}
        managedMemberTotal={managedMemberTotal}
        managedMembers={managedMembers}
        memberLifecycleFilter={memberLifecycleFilter}
        memberPage={memberPage}
        memberPageSize={memberPageSize}
        memberRoleFilter={memberRoleFilter}
        portalRoleOptions={portalRoleOptions}
      />

      <AccountRequestsSection accountRequests={accountRequests} />

      <CycleAndEnrollmentForms cycles={cycles} />

      <InvitationBatchForms batches={batches} cycleMembers={cycleMembers} cycles={cycles} />

      <RegistrySections batches={batches} cycleMembers={cycleMembers} cycles={cycles} />
    </div>
  );
}
