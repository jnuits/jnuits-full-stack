import { cookies } from "next/headers";

import {
  CommitteeWorkspaceClient,
  type AdvisorProfileClientRecord,
  type CommitteeAssignmentClientRecord,
  type CommitteeHistoryRecord,
  type CommitteeRoleClientRecord,
  type CommitteeTermClientRecord,
} from "@/components/admin/committee-workspace-client";
import {
  ADMIN_FLASH_COOKIE_NAME,
  parseAdminFlash,
} from "@/lib/admin/flash";
import {
  formatAdvisorJnuitsIdForDisplay,
  formatMembershipIdForDisplay,
} from "@/lib/members/jnuits-id";
import type { CommitteeTermPositionClientRecord } from "@/lib/committee/term-positions";
import { createAdminClient } from "@/lib/supabase/admin";
import { asFlexibleClient } from "@/lib/supabase/flexible";

type TermRecord = {
  assignment_count?: number | null;
  date_confidence?: string | null;
  election_date?: string | null;
  ends_on: string | null;
  id: string;
  is_current?: boolean | null;
  is_public: boolean;
  slug: string;
  starts_on: string;
  status: string;
  summary: string | null;
  target_executive_slots?: number | null;
  tenure_note?: string | null;
  term_kind?: string | null;
  term_number?: number | null;
  title: string;
  voter_rule_note?: string | null;
};

type RoleRecord = {
  code: string;
  default_slots?: number | null;
  id: string;
  is_executive?: boolean | null;
  max_slots?: number | null;
  min_slots?: number | null;
  role_group?: string | null;
  sort_order: number;
  title: string;
  title_bn?: string | null;
};

type AssignmentRecord = {
  speech?: null | string;
  bio: null | string;
  committee_roles?: RoleRecord | RoleRecord[] | null;
  committee_terms?: { title?: null | string } | { title?: null | string }[] | null;
  display_name: null | string;
  email?: null | string;
  ends_on: null | string;
  id: string;
  is_public?: boolean | null;
  member_id: null | string;
  members?:
    | {
        email?: null | string;
        full_name?: null | string;
        jnuits_id?: null | string;
        lifecycle_status?: null | string;
        member_type?: null | string;
      }
    | {
        email?: null | string;
        full_name?: null | string;
        jnuits_id?: null | string;
        lifecycle_status?: null | string;
        member_type?: null | string;
      }[]
    | null;
  public_title_override?: null | string;
  role_id: string;
  sort_order: number;
  starts_on: null | string;
  status: string;
  term_id: string;
};

type PositionRecord = {
  committee_roles?: { code?: null | string } | { code?: null | string }[] | null;
  id: string;
  is_public: boolean;
  max_slots: number;
  min_slots: number;
  priority: number;
  public_label: string;
  public_label_bn: null | string;
  role_group: string;
  role_id: string;
  target_slots: number;
  term_id: string;
};

type AdvisorRecord = {
  advisor_jnuits_id?: null | string;
  advisor_type: string;
  avatar_secure_url?: null | string;
  bio?: null | string;
  date_confidence?: null | string;
  department?: null | string;
  designation?: null | string;
  email?: null | string;
  facebook_url?: null | string;
  former_title?: null | string;
  full_name: string;
  id: string;
  is_current?: boolean | null;
  is_public?: boolean | null;
  jnu_profile_url?: null | string;
  joined_on?: null | string;
  left_on?: null | string;
  linkedin_url?: null | string;
  phone?: null | string;
  publications?: unknown;
  sort_order?: number | null;
  speech?: null | string;
  status_note?: null | string;
  tenure_display?: null | string;
  title?: null | string;
  user_id?: null | string;
  website_url?: null | string;
  work_experience?: unknown;
};

type AuditRecord = {
  action: string;
  actor_user_id?: null | string;
  created_at: string;
  entity_id: null | string;
  entity_type: string;
  id: string;
  metadata?: Record<string, unknown> | null;
};

function resolveOne<T>(relation: T | T[] | null | undefined) {
  if (!relation) return null;
  return Array.isArray(relation) ? relation[0] || null : relation;
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

async function loadTerms(
  flexibleAdmin: ReturnType<typeof asFlexibleClient>
): Promise<TermRecord[]> {
  const extendedSelect =
    "id, slug, title, summary, starts_on, ends_on, status, is_public, term_number, term_kind, election_date, is_current, date_confidence, tenure_note, target_executive_slots, voter_rule_note";
  const baseSelect =
    "id, slug, title, summary, starts_on, ends_on, status, is_public";
  const extended = await flexibleAdmin
    .from("committee_terms" as string)
    .select(extendedSelect)
    .order("starts_on", { ascending: false });

  if (!extended.error) {
    return (extended.data || []) as TermRecord[];
  }

  const base = await flexibleAdmin
    .from("committee_terms" as string)
    .select(baseSelect)
    .order("starts_on", { ascending: false });

  return (base.data || []) as TermRecord[];
}

async function loadRoles(
  flexibleAdmin: ReturnType<typeof asFlexibleClient>
): Promise<RoleRecord[]> {
  const extended = await flexibleAdmin
    .from("committee_roles" as string)
    .select("id, code, title, title_bn, sort_order, role_group, min_slots, max_slots, default_slots, is_executive")
    .order("sort_order", { ascending: true });

  if (!extended.error) {
    return (extended.data || []) as RoleRecord[];
  }

  const base = await flexibleAdmin
    .from("committee_roles" as string)
    .select("id, code, title, sort_order, is_executive")
    .order("sort_order", { ascending: true });

  return (base.data || []) as RoleRecord[];
}

async function loadAssignments(
  flexibleAdmin: ReturnType<typeof asFlexibleClient>,
  termIds: string[]
): Promise<AssignmentRecord[]> {
  if (termIds.length === 0) return [];

  const extended = await flexibleAdmin
    .from("committee_assignments" as string)
    .select(
      "id, term_id, role_id, member_id, display_name, public_title_override, bio, speech, sort_order, starts_on, ends_on, status, is_public, committee_roles(id, code, title, title_bn, role_group), committee_terms(title), members(full_name, jnuits_id, email, lifecycle_status, member_type)"
    )
    .in("term_id", termIds)
    .order("sort_order", { ascending: true });

  if (!extended.error) {
    return (extended.data || []) as AssignmentRecord[];
  }

  const base = await flexibleAdmin
    .from("committee_assignments" as string)
    .select(
      "id, term_id, role_id, member_id, display_name, bio, sort_order, starts_on, ends_on, status, committee_roles(id, code, title), committee_terms(title), members(full_name, jnuits_id, email, lifecycle_status, member_type)"
    )
    .in("term_id", termIds)
    .order("sort_order", { ascending: true });

  return (base.data || []) as AssignmentRecord[];
}

async function loadPositions(
  flexibleAdmin: ReturnType<typeof asFlexibleClient>,
  termIds: string[]
): Promise<PositionRecord[]> {
  if (termIds.length === 0) return [];

  const result = await flexibleAdmin
    .from("committee_term_positions" as string)
    .select(
      "id, term_id, role_id, public_label, public_label_bn, role_group, priority, is_public, min_slots, max_slots, target_slots, committee_roles(code)"
    )
    .in("term_id", termIds)
    .order("priority", { ascending: true })
    .order("id", { ascending: true });

  if (result.error) throw result.error;
  return (result.data || []) as PositionRecord[];
}

async function loadAdvisors(
  flexibleAdmin: ReturnType<typeof asFlexibleClient>
): Promise<AdvisorRecord[]> {
  const extended = await flexibleAdmin
    .from("advisor_profiles" as string)
    .select(
      "id, user_id, advisor_jnuits_id, advisor_type, full_name, title, former_title, department, designation, email, phone, avatar_secure_url, speech, bio, work_experience, publications, facebook_url, linkedin_url, website_url, jnu_profile_url, joined_on, left_on, tenure_display, date_confidence, status_note, is_current, is_public, sort_order"
    )
    .order("sort_order", { ascending: true });

  if (!extended.error) return (extended.data || []) as AdvisorRecord[];

  const base = await flexibleAdmin
    .from("advisor_profiles" as string)
    .select(
      "id, user_id, advisor_type, full_name, title, department, designation, email, phone, avatar_secure_url, speech, bio, work_experience, publications, facebook_url, linkedin_url, website_url, joined_on, left_on, is_current, is_public, sort_order"
    )
    .order("sort_order", { ascending: true });

  if (base.error) return [];
  return (base.data || []) as AdvisorRecord[];
}

function mapTerm(term: TermRecord, assignmentCount: number): CommitteeTermClientRecord {
  return {
    assignmentCount,
    dateConfidence: term.date_confidence || "verified",
    electionDate: term.election_date || null,
    endsOn: term.ends_on || null,
    id: term.id,
    isCurrent: Boolean(term.is_current),
    isPublic: Boolean(term.is_public),
    slug: term.slug,
    startsOn: term.starts_on,
    status: term.status,
    summary: term.summary || null,
    targetExecutiveSlots: term.target_executive_slots || 21,
    tenureNote: term.tenure_note || null,
    termKind: term.term_kind || "executive",
    termNumber: term.term_number || null,
    title: term.title,
    voterRuleNote: term.voter_rule_note || null,
  };
}

function mapRole(role: RoleRecord): CommitteeRoleClientRecord {
  return {
    code: role.code,
    defaultSlots: role.default_slots ?? 1,
    id: role.id,
    maxSlots: role.max_slots ?? 1,
    minSlots: role.min_slots ?? 1,
    roleGroup: role.role_group || (role.is_executive ? "executive" : "advisor"),
    sortOrder: role.sort_order,
    title: role.title,
    titleBn: role.title_bn || null,
  };
}

function mapAssignment(assignment: AssignmentRecord): CommitteeAssignmentClientRecord {
  const role = resolveOne(assignment.committee_roles);
  const term = resolveOne(assignment.committee_terms);
  const member = resolveOne(assignment.members);

  return {
    bio: assignment.bio || null,
    speech: assignment.speech || null,
    displayName: assignment.display_name || null,
    email: member?.email || null,
    endsOn: assignment.ends_on || null,
    id: assignment.id,
    isPublic: assignment.is_public ?? true,
    jnuitsId: formatMembershipIdForDisplay(member?.jnuits_id) || member?.jnuits_id || null,
    memberId: assignment.member_id || null,
    memberLifecycleStatus: member?.lifecycle_status || null,
    memberName: member?.full_name || null,
    memberType: member?.member_type || null,
    publicTitleOverride: assignment.public_title_override || null,
    roleCode: role?.code || null,
    roleGroup: role?.role_group || (role?.is_executive ? "executive" : null),
    roleId: assignment.role_id,
    roleTitle: role?.title || null,
    roleTitleBn: role?.title_bn || null,
    sortOrder: assignment.sort_order,
    startsOn: assignment.starts_on || null,
    status: assignment.status,
    termId: assignment.term_id,
    termTitle: term?.title || null,
  };
}

function mapPosition(position: PositionRecord): CommitteeTermPositionClientRecord {
  const role = resolveOne(position.committee_roles);
  return {
    id: position.id,
    isPublic: position.is_public,
    maxSlots: position.max_slots,
    minSlots: position.min_slots,
    priority: position.priority,
    publicLabel: position.public_label,
    publicLabelBn: position.public_label_bn || null,
    roleCode: role?.code || "unknown-role",
    roleGroup: position.role_group,
    roleId: position.role_id,
    targetSlots: position.target_slots,
    termId: position.term_id,
  };
}

function mapAdvisor(advisor: AdvisorRecord): AdvisorProfileClientRecord {
  return {
    advisorJnuitsId: formatAdvisorJnuitsIdForDisplay(advisor.advisor_jnuits_id) || null,
    advisorType: advisor.advisor_type,
    avatarSecureUrl: advisor.avatar_secure_url || null,
    bio: advisor.bio || null,
    dateConfidence: advisor.date_confidence || "verified",
    department: advisor.department || null,
    designation: advisor.designation || null,
    email: advisor.email || null,
    facebookUrl: advisor.facebook_url || null,
    formerTitle: advisor.former_title || null,
    fullName: advisor.full_name,
    id: advisor.id,
    isCurrent: advisor.is_current ?? true,
    isPublic: advisor.is_public ?? true,
    jnuProfileUrl: advisor.jnu_profile_url || null,
    joinedOn: advisor.joined_on || null,
    leftOn: advisor.left_on || null,
    linkedinUrl: advisor.linkedin_url || null,
    phone: advisor.phone || null,
    publications: asStringList(advisor.publications),
    sortOrder: advisor.sort_order ?? 100,
    speech: advisor.speech || null,
    statusNote: advisor.status_note || null,
    tenureDisplay: advisor.tenure_display || null,
    title: advisor.title || null,
    userId: advisor.user_id || null,
    websiteUrl: advisor.website_url || null,
    workExperience: asStringList(advisor.work_experience),
  };
}

export const metadata = { title: "Committee — Admin | JnUITS" };

export default async function AdminCommitteePage() {
  const admin = createAdminClient();
  const flexibleAdmin = asFlexibleClient(admin);
  const cookieStore = await cookies();
  const flash = parseAdminFlash(
    cookieStore.get(ADMIN_FLASH_COOKIE_NAME)?.value
  );

  const [termsRawAll, rolesRaw, advisorsRaw, historyResult] =
    await Promise.all([
      loadTerms(flexibleAdmin),
      loadRoles(flexibleAdmin),
      loadAdvisors(flexibleAdmin),
      flexibleAdmin
        .from("audit_events" as string)
        .select("id, action, entity_type, entity_id, actor_user_id, metadata, created_at")
        .like("action", "committee.%")
        .order("created_at", { ascending: false })
        .limit(30),
    ]);

  const termsRaw = termsRawAll.filter(
    (term) => (term.term_kind || "executive") === "executive"
  );
  const termIds = termsRaw.map((term) => term.id);
  const [assignmentsRaw, positionsRaw] = await Promise.all([
    loadAssignments(flexibleAdmin, termIds),
    loadPositions(flexibleAdmin, termIds),
  ]);
  const publicExecutivePositionKeys = new Set(
    positionsRaw
      .filter((position) => position.role_group === "executive" && position.is_public)
      .map((position) => `${position.term_id}:${position.role_id}`)
  );
  const assignmentCounts = new Map<string, number>();

  for (const assignment of assignmentsRaw) {
    if (!publicExecutivePositionKeys.has(`${assignment.term_id}:${assignment.role_id}`)) continue;
    if ((assignment.status || "") === "planned") continue;
    if (assignment.is_public === false) continue;
    assignmentCounts.set(
      assignment.term_id,
      (assignmentCounts.get(assignment.term_id) || 0) + 1
    );
  }

  const history = ((historyResult.data || []) as AuditRecord[]).map(
    (event): CommitteeHistoryRecord => ({
      action: event.action,
      actorUserId: event.actor_user_id || null,
      createdAt: event.created_at,
      entityId: event.entity_id || null,
      entityType: event.entity_type,
      id: event.id,
      metadata: event.metadata || {},
    })
  );

  return (
    <CommitteeWorkspaceClient
      advisors={advisorsRaw.map(mapAdvisor)}
      assignments={assignmentsRaw.map(mapAssignment)}
      flash={flash}
      history={history}
      positions={positionsRaw.map(mapPosition)}
      roles={rolesRaw.map(mapRole)}
      terms={termsRaw.map((term) => mapTerm(term, assignmentCounts.get(term.id) || 0))}
    />
  );
}
