"use client";

import {
  Check,
  Clock3,
  Copy,
  Ellipsis,
  Pencil,
  Search,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Fragment, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";

import {
  bulkReviewMemberAccountRequestsAction,
  reviewMemberAccountRequestAction,
  saveMemberOperationsAction,
} from "@/app/admin/membership/actions";
import { MemberProfileEditor } from "@/components/admin/member-profile-editor";
import { IntakeWorkspace } from "@/components/admin/onboarding/intake-workspace";
import { runBoundedTasks } from "@/lib/async/bounded-concurrency";
import { formatDhakaDate } from "@/lib/membership/anniversary";
import { MembershipRenewalPanel } from "@/components/admin/membership-renewal-panel";
import type { RenewalQueueData } from "@/lib/membership/renewal-queue";


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
  batch_no: null | number;
  currentPortalRole: "alumni" | "alumni_ambassador" | "executive" | "member";
  department_code: null | string;
  displayJnuitsId: string;
  email: null | string;
  facebook_url: null | string;
  full_name: string;
  id: string;
  is_profile_claimed: boolean | null;
  jnuits_id: string;
  joined_on: null | string;
  lifecycle_status: null | string;
  linkedin_url: null | string;
  member_type: null | string;
  phone: null | string;
  portal_access_status: null | string;
  student_id: null | string;
  updated_at: string;
  user_id: null | string;
  website_url: null | string;
};

export type DepartmentOptionClientRecord = {
  internalCode: string;
  name: string;
  shortCode: string;
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
  renewalQueue?: RenewalQueueData;
  accountRequests: AccountRequestClientRecord[];
  batches: InvitationBatchClientRecord[];
  departmentOptions: DepartmentOptionClientRecord[];
  flash: AdminFlash;
  managedMemberTotal: number;
  managedMembers: ManagedMemberClientRecord[];
  memberLifecycleFilter: string;
  memberPage: number;
  memberPageSize: number;
  memberRoleFilter: string;
  portalRoleOptions: PortalRoleOptionClientRecord[];
  totalClaimedInvitations: number;
  totalIssuedInvitations: number;
};

const lifecycleOptions = ["current", "former", "alumni", "deleted"] as const;
const BULK_MEMBER_OPERATION_CONCURRENCY = 3;
const portalAccessOptions = [
  "active",
  "frozen",
  "suspended",
  "deletion_requested",
  "deactivated",
] as const;
const stickyNavItems = [
  { label: "Members", tabId: "tab-members", targetId: "member-operations" },
  { label: "Membership decisions", tabId: "tab-decisions", targetId: "membership-renewals" },
  { label: "Profile Intake", tabId: "tab-intake", targetId: "member-profile-intake" },
] as const;

const stickySectionToTab: Record<string, (typeof stickyNavItems)[number]["tabId"]> = {
  "alumni-queue": "tab-members",
  "membership-renewals": "tab-decisions",
  "member-profile-intake": "tab-intake",
  "member-operations": "tab-members",
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

function StatsBar({ managedMemberTotal, missingJoiningDates, totalClaimedInvitations, totalIssuedInvitations }: {
  managedMemberTotal: number;
  missingJoiningDates: number;
  totalClaimedInvitations: number;
  totalIssuedInvitations: number;
}) {
  return (
    <section className="grid gap-4 md:grid-cols-3">
      <MetricCard label="Matching member profiles" value={managedMemberTotal} />
      <MetricCard label="Loaded profiles missing joining date" value={missingJoiningDates}>
        <p className="mt-3 text-sm text-[var(--muted-foreground)]">Verify the official joining date before confirming renewal.</p>
      </MetricCard>
      <MetricCard label="Batch claims" value={totalClaimedInvitations + " / " + totalIssuedInvitations}>
        <p className="mt-3 text-sm text-[var(--muted-foreground)]">Claimed / issued invitations.</p>
      </MetricCard>
    </section>
  );
}

function WorkflowProgress({
  membersCount,
  batchesCount,
  issuedCount,
}: {
  membersCount: number;
  batchesCount: number;
  issuedCount: number;
}) {
  const rawSteps = [
    { complete: membersCount > 0, id: "member-profile-intake", label: "Add member profiles" },
    { complete: membersCount > 0, id: "member-operations", label: "Review member profiles" },
    {
      complete: batchesCount > 0,
      href: "/admin/invitations#batches",
      id: "invitations-batches-link",
      label: "Create batches",
    },
    {
      complete: issuedCount > 0,
      href: "/admin/invitations#issue",
      id: "invitations-issue-link",
      label: "Issue invitations",
    },
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
              onClick={() => {
                if ("href" in step && step.href) {
                  window.location.href = step.href;
                  return;
                }
                scrollToSection(step.id);
              }}
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
  departmentOptions,
  memberLifecycleFilter,
  memberPage,
  memberPageSize,
  memberRoleFilter,
  managedMemberTotal,
  managedMembers,
  portalRoleOptions,
}: {
  departmentOptions: DepartmentOptionClientRecord[];
  memberLifecycleFilter: string;
  memberPage: number;
  memberPageSize: number;
  memberRoleFilter: string;
  managedMemberTotal: number;
  managedMembers: ManagedMemberClientRecord[];
  portalRoleOptions: PortalRoleOptionClientRecord[];
}) {
  const router = useRouter();
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
              <th>Joined</th>
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
                return (
                  <tr
                    className="membership-table-row"
                    data-editing={editingMemberId === member.id}
                    data-selected={isSelected}
                    key={member.id}
                    onClick={() => setEditingMemberId(member.id)}
                  >
                    <td className="membership-table__checkbox" data-label="Select">
                      <input
                        aria-label={`Select ${member.full_name}`}
                        checked={isSelected}
                        onChange={(event) => toggleMemberSelection(member.id, event.target.checked)}
                        onClick={(event) => event.stopPropagation()}
                        type="checkbox"
                      />
                    </td>
                    <td data-label="Member">
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
                    <td data-label="Lifecycle">
                      <TableBadge type="lifecycle" value={getMemberLifecycle(member)} />
                    </td>
                    <td data-label="Portal access">
                      <TableBadge type="access" value={getMemberPortalAccess(member)} />
                    </td>
                    <td className="membership-table__role" data-label="Portal role">{humanize(member.currentPortalRole)}</td>
                    <td data-label="Joined">{formatDhakaDate(member.joined_on)}</td>
                    <td className="membership-table__actions" data-label="Actions">
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
              router.push("/admin/invitations#issue");
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
          departmentOptions={departmentOptions}
          key={`${editingMember.id}:${editingMember.updated_at}`}
          member={editingMember}
          onClose={() => setEditingMemberId(null)}
          onSaved={(updatedMember) => {
            updateMemberInTable(updatedMember);
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
  departmentOptions,
  member,
  onClose,
  onSaved,
  portalRoleOptions,
}: {
  departmentOptions: DepartmentOptionClientRecord[];
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
          onClose();
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
        onClose();
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
      <MemberProfileEditor
        departmentOptions={departmentOptions}
        member={{
          batchNo: member.batch_no,
          departmentCode: member.department_code,
          email: member.email || "",
          expectedUpdatedAt: member.updated_at,
          facebookUrl: member.facebook_url,
          fullName: member.full_name,
          id: member.id,
          jnuitsId: member.jnuits_id,
          joinedOn: member.joined_on,
          lifecycleStatus: getMemberLifecycle(member),
          linkedinUrl: member.linkedin_url,
          phone: member.phone,
          studentId: member.student_id,
          websiteUrl: member.website_url,
        }}
        onSaved={(profile) => {
          onSaved({
            ...member,
            batch_no: profile.batchNo,
            department_code: profile.departmentCode,
            email: profile.email || null,
            facebook_url: profile.facebookUrl,
            full_name: profile.fullName,
            jnuits_id: profile.jnuitsId,
            joined_on: profile.joinedOn,
            linkedin_url: profile.linkedinUrl,
            phone: profile.phone,
            student_id: profile.studentId,
            updated_at: profile.expectedUpdatedAt,
            website_url: profile.websiteUrl,
          });
        }}
      />
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
        const results = await runBoundedTasks(
          selectedMembers.map((member) => () =>
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
          ),
          BULK_MEMBER_OPERATION_CONCURRENCY
        );
        const successfulMembers = selectedMembers.filter((_, index) => results[index]?.ok);

        if (successfulMembers.length > 0) {
          onMembersChanged(
            successfulMembers.map((member) => ({
              ...member,
              lifecycle_status: bulkLifecycle,
            }))
          );
        }

        const failedCount = results.filter((result) => !result.ok).length;
        if (failedCount > 0) {
          setError(`${failedCount} of ${selectedMembers.length} lifecycle updates failed.`);
          return;
        }

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
        const results = await runBoundedTasks(
          targets.map((member) => () =>
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
          ),
          BULK_MEMBER_OPERATION_CONCURRENCY
        );
        const successfulMembers = targets.filter((_, index) => results[index]?.ok);

        if (successfulMembers.length > 0) {
          onMembersChanged(
            successfulMembers.map((member) => ({
              ...member,
              currentPortalRole: bulkRole,
            }))
          );
        }

        const failedCount = results.filter((result) => !result.ok).length;
        if (failedCount > 0) {
          setError(`${failedCount} of ${targets.length} role updates failed.`);
        }
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
        const results = await runBoundedTasks(
          selectedMembers.map((member) => () =>
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
          ),
          BULK_MEMBER_OPERATION_CONCURRENCY
        );
        const successfulMembers = selectedMembers.filter((_, index) => results[index]?.ok);

        if (successfulMembers.length > 0) {
          onMembersChanged(
            successfulMembers.map((member) => ({
              ...member,
              portal_access_status: "suspended",
            }))
          );
        }

        const failedCount = results.filter((result) => !result.ok).length;
        if (failedCount > 0) {
          setError(`${failedCount} of ${selectedMembers.length} revoke operations failed.`);
        }
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
            Profile deletion queue
          </h2>
        </div>
        <span className="status-pill membership-pending-count" data-pending={accountRequests.length > 0}>
          {accountRequests.length} pending
        </span>
      </div>

      <p className="section-copy mt-3">
        This queue is only for profile deletion. Alumni, renewal, departure, and appeal requests are reviewed in Membership decisions.
      </p>
      <a className="ghost-button mt-3" href="/admin/membership?renewalQueue=alumni#membership-renewals">
        Review member Alumni requests
      </a>

      <div className="mt-6 grid gap-4">
        {accountRequests.length === 0 ? (
          <div className="empty-state">No profile deletion requests pending review.</div>
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


export function MembershipDbClient({
  renewalQueue,
  accountRequests,
  batches,
  departmentOptions,
  flash,
  managedMemberTotal,
  managedMembers,
  memberLifecycleFilter,
  memberPage,
  memberPageSize,
  memberRoleFilter,
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
            Member profiles, joining dates, imports, and portal access controls. Renewal follows each member&apos;s joining-date anniversary.
          </p>
        </div>
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
        managedMemberTotal={managedMemberTotal}
        missingJoiningDates={managedMembers.filter((member) => !member.joined_on).length}
        totalClaimedInvitations={totalClaimedInvitations}
        totalIssuedInvitations={totalIssuedInvitations}
      />

      <WorkflowProgress
        membersCount={managedMemberTotal}
        batchesCount={batches.length}
        issuedCount={totalIssuedInvitations}
      />

      <StickySectionNav />

      {renewalQueue ? <MembershipRenewalPanel data={renewalQueue} /> : null}

      <MemberOperationsSection
        key={`${memberPage}:${memberPageSize}:${memberLifecycleFilter}:${memberRoleFilter}`}
        departmentOptions={departmentOptions}
        managedMemberTotal={managedMemberTotal}
        managedMembers={managedMembers}
        memberLifecycleFilter={memberLifecycleFilter}
        memberPage={memberPage}
        memberPageSize={memberPageSize}
        memberRoleFilter={memberRoleFilter}
        portalRoleOptions={portalRoleOptions}
      />

      <section className="section-band" id="member-profile-intake">
        <div className="membership-table-heading">
          <div>
            <span className="eyebrow">Profile intake</span>
            <h2 className="mt-4 font-[family-name:var(--font-heading)] text-[clamp(2rem,3vw,2.7rem)] leading-[0.96] tracking-[-0.04em]">
              Import or enter member profiles safely
            </h2>
          </div>
          <p>Draft, validate, correct, and commit without changing privacy, access, or roles.</p>
        </div>
        <div className="mt-6">
          <IntakeWorkspace
            departmentOptions={departmentOptions}
            operationType="member_profile_import"
          />
        </div>
      </section>

      <AccountRequestsSection accountRequests={accountRequests} />

      <section className="section-band" id="membership-invitation-handoff">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="eyebrow">Invitation workspace</span>
            <h2 className="mt-4 font-[family-name:var(--font-heading)] text-[clamp(2rem,3vw,2.6rem)] leading-[0.96] tracking-[-0.04em]">
              Invitation operations now live on the dedicated page
            </h2>
            <p className="section-copy mt-3">
              Create batches, issue claim codes, monitor delivery, and revoke invitations from the Invitations workspace.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a className="ghost-button" href="/admin/invitations#issue">
              Issue invitations
            </a>
            <a className="primary-button" href="/admin/invitations#batches">
              Manage batches
            </a>
          </div>
        </div>
      </section>

    </div>
  );
}

