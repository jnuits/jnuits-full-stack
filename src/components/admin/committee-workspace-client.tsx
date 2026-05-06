"use client";

import {
  Archive,
  BookOpen,
  CheckCircle,
  Clock3,
  GraduationCap,
  History,
  Import,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useMemo, useState } from "react";

import {
  removeCommitteeAssignment,
  saveAdvisorProfile,
  saveCommitteeAssignment,
  saveCommitteeTerm,
  setCommitteeTermCurrent,
} from "@/app/admin/committee/actions";

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
  bio: null | string;
  displayName: null | string;
  email: null | string;
  endsOn: null | string;
  id: string;
  isPublic: boolean;
  jnuitsId: null | string;
  memberId: null | string;
  memberName: null | string;
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

export type CommitteeMemberOption = {
  email: null | string;
  fullName: string;
  id: string;
  jnuitsId: null | string;
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
  createdAt: string;
  entityId: null | string;
  entityType: string;
  id: string;
};

type CommitteeWorkspaceClientProps = {
  advisors: AdvisorProfileClientRecord[];
  assignments: CommitteeAssignmentClientRecord[];
  flash: AdminFlash;
  history: CommitteeHistoryRecord[];
  members: CommitteeMemberOption[];
  roles: CommitteeRoleClientRecord[];
  terms: CommitteeTermClientRecord[];
};

const navItems = [
  ["Terms", "committee-terms"],
  ["Executive Roster", "committee-roster"],
  ["Advisors", "committee-advisors"],
  ["Imports", "committee-imports"],
  ["Validation", "committee-validation"],
  ["History", "committee-history"],
] as const;

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

function EmptyPanel({
  description,
  title,
}: {
  description: string;
  title: string;
}) {
  return (
    <div className="membership-empty-state">
      <Users aria-hidden="true" size={48} />
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}

function validateSeatCounts(
  currentTerm: CommitteeTermClientRecord | undefined,
  roles: CommitteeRoleClientRecord[],
  assignments: CommitteeAssignmentClientRecord[]
) {
  if (!currentTerm) return [];

  const executiveRoles = roles.filter((role) => role.roleGroup === "executive");
  const publicAssignments = assignments.filter(
    (assignment) =>
      assignment.termId === currentTerm.id &&
      assignment.isPublic &&
      assignment.status !== "planned"
  );
  const messages: string[] = [];

  if (publicAssignments.length !== currentTerm.targetExecutiveSlots) {
    messages.push(
      `Public roster has ${publicAssignments.length} seats; target is ${currentTerm.targetExecutiveSlots}.`
    );
  }

  for (const role of executiveRoles) {
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

export function CommitteeWorkspaceClient({
  advisors,
  assignments,
  flash,
  history,
  members,
  roles,
  terms,
}: CommitteeWorkspaceClientProps) {
  const [activeTab, setActiveTab] = useState<(typeof navItems)[number][1]>("committee-terms");
  const [search, setSearch] = useState("");
  const [selectedTermId, setSelectedTermId] = useState<string | null>(terms[0]?.id ?? null);
  const [editingAssignmentId, setEditingAssignmentId] = useState<string | null>(null);
  const [editingAdvisorId, setEditingAdvisorId] = useState<string | null>(null);
  const [advisorSearch, setAdvisorSearch] = useState("");
  const [advisorTypeFilter, setAdvisorTypeFilter] = useState("");
  const [termFormId, setTermFormId] = useState<string | null>(terms[0]?.id ?? null);
  const [showNewAssignment, setShowNewAssignment] = useState(false);
  const [showNewAdvisor, setShowNewAdvisor] = useState(false);

  const currentTerm = terms.find((term) => term.isCurrent) || terms[0];
  const selectedTerm = terms.find((term) => term.id === selectedTermId) || currentTerm;
  const termAssignments = selectedTerm
    ? assignments.filter((assignment) => assignment.termId === selectedTerm.id)
    : assignments;
  const filteredAssignments = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return termAssignments;
    return termAssignments.filter((assignment) =>
      [
        assignment.memberName,
        assignment.displayName,
        assignment.jnuitsId,
        assignment.email,
        assignment.roleTitle,
        assignment.termTitle,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle))
    );
  }, [search, termAssignments]);

  const selectedAssignment =
    assignments.find((assignment) => assignment.id === editingAssignmentId) || null;
  const advisorTypeOptions = useMemo(
    () => Array.from(new Set(advisors.map((advisor) => advisor.advisorType))).sort(),
    [advisors]
  );
  const filteredAdvisors = useMemo(() => {
    const needle = advisorSearch.trim().toLowerCase();
    return advisors.filter((advisor) => {
      if (advisorTypeFilter && advisor.advisorType !== advisorTypeFilter) {
        return false;
      }

      if (!needle) {
        return true;
      }

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
  }, [advisorSearch, advisorTypeFilter, advisors]);
  const selectedAdvisor = advisors.find((advisor) => advisor.id === editingAdvisorId) || null;
  const selectedTermForForm = terms.find((term) => term.id === termFormId) || null;
  const validationMessages = validateSeatCounts(currentTerm, roles, assignments);

  function scrollTo(targetId: (typeof navItems)[number][1]) {
    setActiveTab(targetId);
    document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="grid gap-8 committee-workspace">
      <div className="admin-page-header">
        <div>
          <p className="admin-page-header__breadcrumb">Admin / Committee</p>
          <h1 className="admin-page-header__title">Committee</h1>
          <p className="admin-page-header__desc">
            Manage executive terms, 21-seat rosters, advisor profiles, public visibility, and audit-ready history.
          </p>
        </div>
        <span className="abadge abadge--active">
          <ShieldCheck size={10} /> {currentTerm?.title || "No current committee"}
        </span>
      </div>

      {flash ? (
        <section className="flash-panel" data-tone={flash.tone}>
          <p className="admin-section-label">Committee feedback</p>
          <h2 className="mt-2 font-[family-name:var(--font-heading)] text-2xl font-semibold">
            {flash.title}
          </h2>
          <p className="mt-1 text-sm leading-7">{flash.message}</p>
        </section>
      ) : null}

      <div className="admin-metric-grid workplace-metric-grid">
        <MetricCard icon={Clock3} label="Executive terms" sub="Current and historical" tone="info" value={terms.length} />
        <MetricCard icon={Users} label="Current roster" sub="Public executive seats" tone={validationMessages.length ? "warning" : "success"} value={currentTerm?.assignmentCount || 0} />
        <MetricCard icon={GraduationCap} label="Advisors" sub="Teacher profiles" value={advisors.length} />
        <MetricCard icon={CheckCircle} label="Current advisors" sub="Currently serving" tone="success" value={advisors.filter((advisor) => advisor.isCurrent).length} />
        <MetricCard icon={Archive} label="Role catalog" sub="Executive/advisor/internal" value={roles.length} />
        <MetricCard icon={History} label="Recent events" sub="Audit entries" value={history.length} />
      </div>

      <nav className="membership-sticky-nav workplace-sticky-nav" aria-label="Committee workspace sections">
        {navItems.map(([label, targetId]) => (
          <button
            className={activeTab === targetId ? "nav-tab tab-active" : "nav-tab"}
            key={targetId}
            onClick={() => scrollTo(targetId)}
            type="button"
          >
            {label}
          </button>
        ))}
      </nav>

      <section className="section-band" id="committee-terms">
        <div className="membership-table-heading">
          <div>
            <span className="eyebrow">Terms</span>
            <h2 className="mt-4 font-[family-name:var(--font-heading)] text-[clamp(2rem,3vw,2.7rem)] leading-[0.96] tracking-[-0.04em]">
              Executive committee terms
            </h2>
          </div>
          <p>Set the current committee and keep estimated historical dates clearly marked.</p>
        </div>

        <div className="membership-table-shell">
          <table className="membership-table">
            <thead>
              <tr>
                <th>Term</th>
                <th>Status</th>
                <th>Tenure</th>
                <th>Seats</th>
                <th>Visibility</th>
                <th className="membership-table__actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {terms.map((term) => (
                <tr
                  className="membership-table-row"
                  data-editing={termFormId === term.id ? "true" : "false"}
                  key={term.id}
                  onClick={() => {
                    setSelectedTermId(term.id);
                    setTermFormId(term.id);
                  }}
                >
                  <td>
                    <div className="membership-table-member">
                      <span className="membership-table-avatar" data-tone={avatarTone(term.id)}>
                        {term.termNumber || "EC"}
                      </span>
                      <div>
                        <strong>{term.title}</strong>
                        <small>{term.slug}</small>
                      </div>
                    </div>
                  </td>
                  <td>
                    <Badge kind="lifecycle" value={term.isCurrent ? "current" : term.status} />
                  </td>
                  <td>
                    <span className="membership-table__cycle">
                      {formatDate(term.startsOn)} - {formatDate(term.endsOn)}
                    </span>
                  </td>
                  <td>{term.assignmentCount}/{term.targetExecutiveSlots}</td>
                  <td>
                    <Badge kind="access" value={term.isPublic ? "active" : "frozen"} />
                  </td>
                  <td className="membership-table__actions">
                    <div className="membership-row-actions">
                      <button aria-label={`Edit ${term.title}`} onClick={(event) => { event.stopPropagation(); setTermFormId(term.id); }} title="Edit term" type="button">
                        <Pencil size={13} />
                      </button>
                      {!term.isCurrent ? (
                        <form action={setCommitteeTermCurrent} onClick={(event) => event.stopPropagation()}>
                          <input name="termId" type="hidden" value={term.id} />
                          <button aria-label={`Set ${term.title} current`} title="Set current" type="submit">
                            <UserCheck size={13} />
                          </button>
                        </form>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="membership-inline-editor">
          <div className="membership-inline-editor__header">
            <div>
              <strong>{selectedTermForForm ? `Edit ${selectedTermForForm.title}` : "Create committee term"}</strong>
              <small>Advisor tenure is intentionally separate; terms here are executive committees.</small>
            </div>
            <button className="ghost-button" onClick={() => setTermFormId(null)} type="button">
              <Plus size={13} /> New term
            </button>
          </div>
          <form action={saveCommitteeTerm}>
            <div className="membership-inline-editor__body">
              <input name="termId" type="hidden" value={selectedTermForForm?.id || ""} />
              <label>
                Title
                <input name="title" defaultValue={selectedTermForForm?.title || ""} placeholder="6th Executive Committee" required />
              </label>
              <label>
                Slug
                <input name="slug" defaultValue={selectedTermForForm?.slug || ""} placeholder="6th-executive-committee" />
              </label>
              <label>
                Term number
                <input name="termNumber" defaultValue={selectedTermForForm?.termNumber || ""} min={1} type="number" />
              </label>
              <label>
                Status
                <select name="status" defaultValue={selectedTermForForm?.status || "draft"}>
                  <option value="draft">Draft</option>
                  <option value="upcoming">Upcoming</option>
                  <option value="active">Active</option>
                  <option value="archived">Archived</option>
                </select>
              </label>
              <label>
                Starts on
                <input name="startsOn" defaultValue={selectedTermForForm?.startsOn || ""} type="date" required />
              </label>
              <label>
                Ends on
                <input name="endsOn" defaultValue={selectedTermForForm?.endsOn || ""} type="date" />
              </label>
              <label>
                Election date
                <input name="electionDate" defaultValue={selectedTermForForm?.electionDate || ""} type="date" />
              </label>
              <label>
                Date confidence
                <select name="dateConfidence" defaultValue={selectedTermForForm?.dateConfidence || "verified"}>
                  <option value="verified">Verified</option>
                  <option value="estimated">Estimated</option>
                </select>
              </label>
              <label>
                Target seats
                <input name="targetExecutiveSlots" defaultValue={selectedTermForForm?.targetExecutiveSlots || 21} min={1} max={60} type="number" />
              </label>
              <label>
                Public
                <select name="isPublic" defaultValue={String(selectedTermForForm?.isPublic ?? true)}>
                  <option value="true">Public</option>
                  <option value="false">Internal</option>
                </select>
              </label>
              <label>
                Current
                <select name="isCurrent" defaultValue={String(selectedTermForForm?.isCurrent ?? false)}>
                  <option value="false">Not current</option>
                  <option value="true">Current committee</option>
                </select>
              </label>
              <input name="termKind" type="hidden" value="executive" />
              <label className="membership-inline-editor__wide">
                Summary
                <textarea name="summary" defaultValue={selectedTermForForm?.summary || ""} rows={3} />
              </label>
              <label>
                Tenure note
                <textarea name="tenureNote" defaultValue={selectedTermForForm?.tenureNote || ""} rows={3} />
              </label>
              <label className="membership-inline-editor__wide">
                Voter rule note
                <textarea name="voterRuleNote" defaultValue={selectedTermForForm?.voterRuleNote || ""} rows={3} />
              </label>
            </div>
            <div className="membership-inline-editor__footer">
              <div>
                <button className="primary-button" type="submit">Save term</button>
                <button className="ghost-button" onClick={() => setTermFormId(null)} type="button">Clear</button>
              </div>
            </div>
          </form>
        </div>
      </section>

      <section className="section-band" id="committee-roster">
        <div className="membership-table-heading">
          <div>
            <span className="eyebrow">Executive roster</span>
            <h2 className="mt-4 font-[family-name:var(--font-heading)] text-[clamp(2rem,3vw,2.7rem)] leading-[0.96] tracking-[-0.04em]">
              21-seat public committee assignments
            </h2>
          </div>
          <p>Sub-Executive rows remain internal and are excluded from the public committee page.</p>
        </div>

        <div className="membership-table-toolbar">
          <div className="membership-table-search">
            <Search aria-hidden="true" size={14} />
            <input
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name, ID, email, role, or term"
              value={search}
            />
          </div>
          <select
            aria-label="Committee term"
            onChange={(event) => setSelectedTermId(event.target.value || null)}
            value={selectedTerm?.id || ""}
          >
            {terms.map((term) => (
              <option key={term.id} value={term.id}>
                {term.title}
              </option>
            ))}
          </select>
          <button className="ghost-button" onClick={() => { setSearch(""); setShowNewAssignment(true); }} type="button">
            <Plus size={13} /> Add assignment
          </button>
          <span className="membership-table-count">
            Showing {filteredAssignments.length} of {termAssignments.length} assignments
          </span>
        </div>

        <div className="membership-table-shell">
          <table className="membership-table">
            <thead>
              <tr>
                <th>Member</th>
                <th>Role</th>
                <th>Status</th>
                <th>Term</th>
                <th>Visibility</th>
                <th className="membership-table__actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAssignments.map((assignment) => (
                <tr
                  className="membership-table-row"
                  data-editing={editingAssignmentId === assignment.id ? "true" : "false"}
                  key={assignment.id}
                  onClick={() => {
                    setEditingAssignmentId(assignment.id);
                    setShowNewAssignment(false);
                  }}
                >
                  <td>
                    <div className="membership-table-member">
                      <span className="membership-table-avatar" data-tone={avatarTone(assignment.memberId || assignment.id)}>
                        {initials(assignment.memberName || assignment.displayName || "JnUITS")}
                      </span>
                      <div>
                        <strong>{assignment.memberName || assignment.displayName || "Unlinked assignment"}</strong>
                        <small>{assignment.jnuitsId || assignment.email || "No linked member"}</small>
                      </div>
                    </div>
                  </td>
                  <td>
                    <strong>{assignment.publicTitleOverride || assignment.roleTitle || "Committee role"}</strong>
                    <small className="block text-[11px] text-[var(--color-text-tertiary)]">{assignment.roleTitleBn}</small>
                  </td>
                  <td><Badge kind="lifecycle" value={assignment.status === "active" ? "current" : assignment.status} /></td>
                  <td><span className="membership-table__cycle">{assignment.termTitle || "Term"}</span></td>
                  <td><Badge kind="access" value={assignment.isPublic ? "active" : "frozen"} /></td>
                  <td className="membership-table__actions">
                    <div className="membership-row-actions">
                      <button aria-label="Edit assignment" onClick={(event) => { event.stopPropagation(); setEditingAssignmentId(assignment.id); setShowNewAssignment(false); }} title="Edit assignment" type="button">
                        <Pencil size={13} />
                      </button>
                      <form action={removeCommitteeAssignment} onClick={(event) => event.stopPropagation()}>
                        <input name="assignmentId" type="hidden" value={assignment.id} />
                        <button aria-label="Remove assignment" title="Remove assignment" type="submit">
                          <X size={13} />
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredAssignments.length === 0 ? (
          <EmptyPanel
            description="Create assignments after committee terms and roles are ready."
            title="No assignments in this view"
          />
        ) : null}

        {selectedAssignment || showNewAssignment ? (
          <div className="membership-inline-editor">
            <div className="membership-inline-editor__header">
              <div>
                <strong>{selectedAssignment ? `Edit ${selectedAssignment.memberName || selectedAssignment.displayName}` : "Add executive assignment"}</strong>
                <small>Public executive rows must link to real members before publishing.</small>
              </div>
              <button className="ghost-button" onClick={() => { setEditingAssignmentId(null); setShowNewAssignment(false); }} type="button">
                <X size={13} /> Close
              </button>
            </div>
            <form action={saveCommitteeAssignment}>
              <div className="membership-inline-editor__body">
                <input name="assignmentId" type="hidden" value={selectedAssignment?.id || ""} />
                <label>
                  Term
                  <select name="termId" defaultValue={selectedAssignment?.termId || selectedTerm?.id || ""} required>
                    {terms.map((term) => (
                      <option key={term.id} value={term.id}>{term.title}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Role
                  <select name="roleId" defaultValue={selectedAssignment?.roleId || ""} required>
                    <option value="">Select role</option>
                    {roles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.title} {role.roleGroup === "sub_executive" ? "(internal)" : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Linked member
                  <select name="memberId" defaultValue={selectedAssignment?.memberId || ""}>
                    <option value="">No linked member</option>
                    {members.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.fullName} - {member.jnuitsId || "No ID"}{member.email ? ` - ${member.email}` : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Display name override
                  <input name="displayName" defaultValue={selectedAssignment?.displayName || ""} placeholder="Only for unlinked historical rows" />
                </label>
                <label>
                  Public title override
                  <input name="publicTitleOverride" defaultValue={selectedAssignment?.publicTitleOverride || ""} />
                </label>
                <label>
                  Status
                  <select name="status" defaultValue={selectedAssignment?.status || "active"}>
                    <option value="planned">Planned</option>
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                  </select>
                </label>
                <label>
                  Starts on
                  <input name="startsOn" defaultValue={selectedAssignment?.startsOn || ""} type="date" />
                </label>
                <label>
                  Ends on
                  <input name="endsOn" defaultValue={selectedAssignment?.endsOn || ""} type="date" />
                </label>
                <label>
                  Sort order
                  <input name="sortOrder" defaultValue={selectedAssignment?.sortOrder || 100} min={0} type="number" />
                </label>
                <label>
                  Visibility
                  <select name="isPublic" defaultValue={String(selectedAssignment?.isPublic ?? true)}>
                    <option value="true">Public</option>
                    <option value="false">Internal only</option>
                  </select>
                </label>
                <label className="membership-inline-editor__wide">
                  Bio or operator note
                  <textarea name="bio" defaultValue={selectedAssignment?.bio || ""} rows={3} />
                </label>
              </div>
              <div className="membership-inline-editor__footer">
                <div>
                  <button className="primary-button" type="submit">Save assignment</button>
                  <button className="ghost-button" onClick={() => { setEditingAssignmentId(null); setShowNewAssignment(false); }} type="button">Cancel</button>
                </div>
              </div>
            </form>
          </div>
        ) : null}
      </section>

      <section className="section-band" id="committee-advisors">
        <div className="membership-table-heading">
          <div>
            <span className="eyebrow">Advisors</span>
            <h2 className="mt-4 font-[family-name:var(--font-heading)] text-[clamp(2rem,3vw,2.7rem)] leading-[0.96] tracking-[-0.04em]">
              Teacher advisor profiles
            </h2>
          </div>
          <button className="ghost-button" onClick={() => { setShowNewAdvisor(true); setEditingAdvisorId(null); }} type="button">
            <Plus size={13} /> Add advisor
          </button>
        </div>

        <div className="membership-toolbar">
          <div className="membership-toolbar__search">
            <Search aria-hidden={true} size={14} />
            <input
              onChange={(event) => setAdvisorSearch(event.target.value)}
              placeholder="Search advisor by name, ID, email, or department"
              type="search"
              value={advisorSearch}
            />
          </div>
          <select
            aria-label="Filter advisors by type"
            onChange={(event) => setAdvisorTypeFilter(event.target.value)}
            value={advisorTypeFilter}
          >
            <option value="">All advisor types</option>
            {advisorTypeOptions.map((advisorType) => (
              <option key={advisorType} value={advisorType}>
                {humanize(advisorType)}
              </option>
            ))}
          </select>
          <button
            className="ghost-button"
            onClick={() => {
              setAdvisorSearch("");
              setAdvisorTypeFilter("");
            }}
            type="button"
          >
            Clear filters
          </button>
          <span className="membership-toolbar__count">
            Showing {filteredAdvisors.length} of {advisors.length} advisors
          </span>
        </div>

        <div className="membership-table-shell">
          <table className="membership-table">
            <thead>
              <tr>
                <th>Advisor</th>
                <th>Advisor ID</th>
                <th>Type</th>
                <th>Department</th>
                <th>Serving</th>
                <th>Visibility</th>
                <th className="membership-table__actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAdvisors.map((advisor) => (
                <tr
                  className="membership-table-row"
                  data-editing={editingAdvisorId === advisor.id ? "true" : "false"}
                  key={advisor.id}
                  onClick={() => {
                    setEditingAdvisorId(advisor.id);
                    setShowNewAdvisor(false);
                  }}
                >
                  <td>
                    <div className="membership-table-member">
                      <span className="membership-table-avatar" data-tone={avatarTone(advisor.id)}>
                        {initials(advisor.fullName)}
                      </span>
                      <div>
                        <strong>{advisor.title ? `${advisor.title} ${advisor.fullName}` : advisor.fullName}</strong>
                        <small>{[advisor.advisorJnuitsId, advisor.email || advisor.designation || "Teacher advisor"].filter(Boolean).join(" · ")}</small>
                      </div>
                    </div>
                  </td>
                  <td>{advisor.advisorJnuitsId || "Auto assigned"}</td>
                  <td>{humanize(advisor.advisorType)}</td>
                  <td>{advisor.department || "Not set"}</td>
                  <td><Badge kind="lifecycle" value={advisor.isCurrent ? "current" : "former"} /></td>
                  <td><Badge kind="access" value={advisor.isPublic ? "active" : "frozen"} /></td>
                  <td className="membership-table__actions">
                    <div className="membership-row-actions">
                      <button aria-label={`Edit ${advisor.fullName}`} onClick={(event) => { event.stopPropagation(); setEditingAdvisorId(advisor.id); setShowNewAdvisor(false); }} title="Edit advisor" type="button">
                        <Pencil size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {advisors.length === 0 ? (
          <EmptyPanel
            description="Create advisor profiles for the main advisor, moderator/mentor, and honorable advisors."
            title="No advisor profiles yet"
          />
        ) : filteredAdvisors.length === 0 ? (
          <EmptyPanel
            description="Clear the advisor filters or search another advisor identity."
            title="No advisors match this view"
          />
        ) : null}

        {selectedAdvisor || showNewAdvisor ? (
          <div className="membership-inline-editor">
            <div className="membership-inline-editor__header">
              <div>
                <strong>{selectedAdvisor ? `Edit ${selectedAdvisor.fullName}` : "Create advisor profile"}</strong>
                <small>Advisors are teachers, not members or alumni, but can log in and maintain their own profile.</small>
              </div>
              <button className="ghost-button" onClick={() => { setEditingAdvisorId(null); setShowNewAdvisor(false); }} type="button">
                <X size={13} /> Close
              </button>
            </div>
            <form action={saveAdvisorProfile}>
              <div className="membership-inline-editor__body">
                <input name="advisorId" type="hidden" value={selectedAdvisor?.id || ""} />
                <label>
                  Advisor JnUITS ID
                  <input name="advisorJnuitsId" defaultValue={selectedAdvisor?.advisorJnuitsId || ""} placeholder="Auto assigned, e.g. JNUITS-CA0001" />
                </label>
                <label>
                  Full name
                  <input name="fullName" defaultValue={selectedAdvisor?.fullName || ""} required />
                </label>
                <label>
                  Advisor type
                  <select name="advisorType" defaultValue={selectedAdvisor?.advisorType || "honorable_advisor"}>
                    <option value="main_advisor">Main Advisor</option>
                    <option value="moderator_mentor">Moderator / Mentor</option>
                    <option value="honorable_advisor">Honorable Advisor</option>
                  </select>
                </label>
                <label>
                  Auth user ID
                  <input name="userId" defaultValue={selectedAdvisor?.userId || ""} placeholder="Optional linked auth user" />
                </label>
                <label>
                  Title
                  <input name="title" defaultValue={selectedAdvisor?.title || ""} placeholder="Dr., Professor..." />
                </label>
                <label>
                  Former title
                  <input name="formerTitle" defaultValue={selectedAdvisor?.formerTitle || ""} placeholder="Former Chief Advisor / Main Advisor" />
                </label>
                <label>
                  Department
                  <input name="department" defaultValue={selectedAdvisor?.department || ""} />
                </label>
                <label>
                  Designation
                  <input name="designation" defaultValue={selectedAdvisor?.designation || ""} />
                </label>
                <label>
                  Email
                  <input name="email" defaultValue={selectedAdvisor?.email || ""} type="email" />
                </label>
                <label>
                  Phone
                  <input name="phone" defaultValue={selectedAdvisor?.phone || ""} />
                </label>
                <label>
                  Joined on
                  <input name="joinedOn" defaultValue={selectedAdvisor?.joinedOn || ""} type="date" />
                </label>
                <label>
                  Left on
                  <input name="leftOn" defaultValue={selectedAdvisor?.leftOn || ""} type="date" />
                </label>
                <label>
                  Tenure display
                  <input name="tenureDisplay" defaultValue={selectedAdvisor?.tenureDisplay || ""} placeholder="2015 - 2025" />
                </label>
                <label>
                  Date confidence
                  <select name="dateConfidence" defaultValue={selectedAdvisor?.dateConfidence || "verified"}>
                    <option value="verified">Verified</option>
                    <option value="estimated">Estimated</option>
                  </select>
                </label>
                <label>
                  Current
                  <select name="isCurrent" defaultValue={String(selectedAdvisor?.isCurrent ?? true)}>
                    <option value="true">Currently serving</option>
                    <option value="false">Left advisor board</option>
                  </select>
                </label>
                <label>
                  Public
                  <select name="isPublic" defaultValue={String(selectedAdvisor?.isPublic ?? true)}>
                    <option value="true">Public profile</option>
                    <option value="false">Internal only</option>
                  </select>
                </label>
                <label>
                  Facebook URL
                  <input name="facebookUrl" defaultValue={selectedAdvisor?.facebookUrl || ""} />
                </label>
                <label>
                  LinkedIn URL
                  <input name="linkedinUrl" defaultValue={selectedAdvisor?.linkedinUrl || ""} />
                </label>
                <label>
                  Website URL
                  <input name="websiteUrl" defaultValue={selectedAdvisor?.websiteUrl || ""} />
                </label>
                <label>
                  JnU profile URL
                  <input name="jnuProfileUrl" defaultValue={selectedAdvisor?.jnuProfileUrl || ""} placeholder="https://profile.jnu.ac.bd/..." />
                </label>
                <label>
                  Avatar URL
                  <input name="avatarSecureUrl" defaultValue={selectedAdvisor?.avatarSecureUrl || ""} />
                </label>
                <label>
                  Sort order
                  <input name="sortOrder" defaultValue={selectedAdvisor?.sortOrder || 100} min={0} type="number" />
                </label>
                <label className="membership-inline-editor__wide">
                  Speech / message
                  <textarea name="speech" defaultValue={selectedAdvisor?.speech || ""} rows={4} />
                </label>
                <label className="membership-inline-editor__wide">
                  Status note
                  <textarea name="statusNote" defaultValue={selectedAdvisor?.statusNote || ""} placeholder="Resignation, acting appointment, current role, or historical note." rows={3} />
                </label>
                <label>
                  Bio
                  <textarea name="bio" defaultValue={selectedAdvisor?.bio || ""} rows={4} />
                </label>
                <label className="membership-inline-editor__wide">
                  Work experience
                  <textarea name="workExperience" defaultValue={(selectedAdvisor?.workExperience || []).join("\n")} placeholder="One item per line" rows={4} />
                </label>
                <label>
                  Publications
                  <textarea name="publications" defaultValue={(selectedAdvisor?.publications || []).join("\n")} placeholder="One item per line" rows={4} />
                </label>
              </div>
              <div className="membership-inline-editor__footer">
                <div>
                  <button className="primary-button" type="submit">Save advisor</button>
                  <button className="ghost-button" onClick={() => { setEditingAdvisorId(null); setShowNewAdvisor(false); }} type="button">Cancel</button>
                </div>
              </div>
            </form>
          </div>
        ) : null}
      </section>

      <section className="section-band" id="committee-imports">
        <div className="membership-table-heading">
          <div>
            <span className="eyebrow">Imports</span>
            <h2 className="mt-4 font-[family-name:var(--font-heading)] text-[clamp(2rem,3vw,2.7rem)] leading-[0.96] tracking-[-0.04em]">
              Historical roster import staging
            </h2>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <article className="route-tile">
            <Import size={18} />
            <h3>Preview first</h3>
            <p>Bulk EC import should validate member links, slot counts, duplicate roles, and public visibility before committing.</p>
          </article>
          <article className="route-tile">
            <ShieldCheck size={18} />
            <h3>Keep sub-exec internal</h3>
            <p>Sub-Executive rows can be stored for election evidence, but they never appear on the public committee page.</p>
          </article>
          <article className="route-tile">
            <BookOpen size={18} />
            <h3>Advisors separate</h3>
            <p>Teacher advisors use advisor profiles, not member or alumni records, and have independent joined/left dates.</p>
          </article>
        </div>
      </section>

      <section className="section-band" id="committee-validation">
        <div className="membership-table-heading">
          <div>
            <span className="eyebrow">Validation</span>
            <h2 className="mt-4 font-[family-name:var(--font-heading)] text-[clamp(2rem,3vw,2.7rem)] leading-[0.96] tracking-[-0.04em]">
              Publication readiness
            </h2>
          </div>
        </div>
        {validationMessages.length === 0 ? (
          <div className="flash-panel" data-tone="success">
            <p className="text-sm font-semibold">Current committee role counts match the configured slot rules.</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {validationMessages.map((message) => (
              <div className="flash-panel" data-tone="warning" key={message}>
                <p className="text-sm font-semibold">{message}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="section-band" id="committee-history">
        <div className="membership-table-heading">
          <div>
            <span className="eyebrow">History</span>
            <h2 className="mt-4 font-[family-name:var(--font-heading)] text-[clamp(2rem,3vw,2.7rem)] leading-[0.96] tracking-[-0.04em]">
              Recent committee audit events
            </h2>
          </div>
        </div>
        {history.length === 0 ? (
          <EmptyPanel
            description="Committee mutations will write audit events after operators create or update records."
            title="No committee audit events yet"
          />
        ) : (
          <div className="grid gap-3">
            {history.map((event) => (
              <article className="route-tile" key={event.id}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3>{humanize(event.action)}</h3>
                  <span className="detail-chip">{formatDate(event.createdAt)}</span>
                </div>
                <p>{event.entityType} {event.entityId ? `· ${event.entityId}` : ""}</p>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
