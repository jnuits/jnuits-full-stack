import { cookies } from "next/headers";

import {
  CommitteeWorkspaceClient,
  type AdvisorProfileClientRecord,
  type CommitteeAssignmentClientRecord,
  type CommitteeHistoryRecord,
  type CommitteeMemberOption,
  type CommitteeRoleClientRecord,
  type CommitteeTermClientRecord,
} from "@/components/admin/committee-workspace-client";
import {
  ADMIN_FLASH_COOKIE_NAME,
  parseAdminFlash,
} from "@/lib/admin/flash";
import { formatMembershipIdForDisplay } from "@/lib/members/jnuits-id";
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

type MemberRecord = {
  email: null | string;
  full_name: string;
  id: string;
  jnuits_id: null | string;
};

type AssignmentRecord = {
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
      }
    | {
        email?: null | string;
        full_name?: null | string;
        jnuits_id?: null | string;
      }[]
    | null;
  public_title_override?: null | string;
  role_id: string;
  sort_order: number;
  starts_on: null | string;
  status: string;
  term_id: string;
};

type AdvisorRecord = {
  advisor_type: string;
  avatar_secure_url?: null | string;
  bio?: null | string;
  department?: null | string;
  designation?: null | string;
  email?: null | string;
  facebook_url?: null | string;
  full_name: string;
  id: string;
  is_current?: boolean | null;
  is_public?: boolean | null;
  joined_on?: null | string;
  left_on?: null | string;
  linkedin_url?: null | string;
  phone?: null | string;
  publications?: unknown;
  sort_order?: number | null;
  speech?: null | string;
  title?: null | string;
  user_id?: null | string;
  website_url?: null | string;
  work_experience?: unknown;
};

type AuditRecord = {
  action: string;
  created_at: string;
  entity_id: null | string;
  entity_type: string;
  id: string;
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
      "id, term_id, role_id, member_id, display_name, public_title_override, bio, sort_order, starts_on, ends_on, status, is_public, committee_roles(id, code, title, title_bn, role_group), committee_terms(title), members(full_name, jnuits_id, email)"
    )
    .in("term_id", termIds)
    .order("sort_order", { ascending: true });

  if (!extended.error) {
    return (extended.data || []) as AssignmentRecord[];
  }

  const base = await flexibleAdmin
    .from("committee_assignments" as string)
    .select(
      "id, term_id, role_id, member_id, display_name, bio, sort_order, starts_on, ends_on, status, committee_roles(id, code, title), committee_terms(title), members(full_name, jnuits_id, email)"
    )
    .in("term_id", termIds)
    .order("sort_order", { ascending: true });

  return (base.data || []) as AssignmentRecord[];
}

async function loadAdvisors(
  flexibleAdmin: ReturnType<typeof asFlexibleClient>
): Promise<AdvisorRecord[]> {
  const result = await flexibleAdmin
    .from("advisor_profiles" as string)
    .select(
      "id, user_id, advisor_type, full_name, title, department, designation, email, phone, avatar_secure_url, speech, bio, work_experience, publications, facebook_url, linkedin_url, website_url, joined_on, left_on, is_current, is_public, sort_order"
    )
    .order("sort_order", { ascending: true });

  if (result.error) return [];
  return (result.data || []) as AdvisorRecord[];
}

function mapTerm(term: TermRecord, assignmentCount: number): CommitteeTermClientRecord {
  return {
    assignmentCount,
    dateConfidence: term.date_confidence || "verified",
    electionDate: term.election_date || null,
    endsOn: term.ends_on || null,
    id: term.id,
    isCurrent: Boolean(term.is_current) || term.status === "active",
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
    defaultSlots: role.default_slots || 1,
    id: role.id,
    maxSlots: role.max_slots || 1,
    minSlots: role.min_slots || 1,
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
    displayName: assignment.display_name || null,
    email: member?.email || null,
    endsOn: assignment.ends_on || null,
    id: assignment.id,
    isPublic: assignment.is_public ?? true,
    jnuitsId: formatMembershipIdForDisplay(member?.jnuits_id) || member?.jnuits_id || null,
    memberId: assignment.member_id || null,
    memberName: member?.full_name || null,
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

function mapAdvisor(advisor: AdvisorRecord): AdvisorProfileClientRecord {
  return {
    advisorType: advisor.advisor_type,
    avatarSecureUrl: advisor.avatar_secure_url || null,
    bio: advisor.bio || null,
    department: advisor.department || null,
    designation: advisor.designation || null,
    email: advisor.email || null,
    facebookUrl: advisor.facebook_url || null,
    fullName: advisor.full_name,
    id: advisor.id,
    isCurrent: advisor.is_current ?? true,
    isPublic: advisor.is_public ?? true,
    joinedOn: advisor.joined_on || null,
    leftOn: advisor.left_on || null,
    linkedinUrl: advisor.linkedin_url || null,
    phone: advisor.phone || null,
    publications: asStringList(advisor.publications),
    sortOrder: advisor.sort_order || 100,
    speech: advisor.speech || null,
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

  const [termsRaw, rolesRaw, membersResult, advisorsRaw, historyResult] =
    await Promise.all([
      loadTerms(flexibleAdmin),
      loadRoles(flexibleAdmin),
      flexibleAdmin
        .from("members" as string)
        .select("id, full_name, jnuits_id, email")
        .not("jnuits_id", "like", "JNUITS-ADMIN-%")
        .order("full_name", { ascending: true })
        .limit(500),
      loadAdvisors(flexibleAdmin),
      flexibleAdmin
        .from("audit_events" as string)
        .select("id, action, entity_type, entity_id, created_at")
        .like("action", "committee.%")
        .order("created_at", { ascending: false })
        .limit(30),
    ]);

  const termIds = termsRaw.map((term) => term.id);
  const assignmentsRaw = await loadAssignments(flexibleAdmin, termIds);
  const assignmentCounts = new Map<string, number>();

  for (const assignment of assignmentsRaw) {
    const role = resolveOne(assignment.committee_roles);
    const roleGroup = role?.role_group || (role?.is_executive ? "executive" : null);
    if (roleGroup !== "executive") continue;
    if ((assignment.status || "") === "planned") continue;
    if (assignment.is_public === false) continue;
    assignmentCounts.set(
      assignment.term_id,
      (assignmentCounts.get(assignment.term_id) || 0) + 1
    );
  }

  const members = ((membersResult.data || []) as MemberRecord[]).map(
    (member): CommitteeMemberOption => ({
      email: member.email || null,
      fullName: member.full_name,
      id: member.id,
      jnuitsId: formatMembershipIdForDisplay(member.jnuits_id) || member.jnuits_id,
    })
  );
  const history = ((historyResult.data || []) as AuditRecord[]).map(
    (event): CommitteeHistoryRecord => ({
      action: event.action,
      createdAt: event.created_at,
      entityId: event.entity_id || null,
      entityType: event.entity_type,
      id: event.id,
    })
  );

  return (
    <CommitteeWorkspaceClient
      advisors={advisorsRaw.map(mapAdvisor)}
      assignments={assignmentsRaw.map(mapAssignment)}
      flash={flash}
      history={history}
      members={members}
      roles={rolesRaw.map(mapRole)}
      terms={termsRaw.map((term) => mapTerm(term, assignmentCounts.get(term.id) || 0))}
    />
  );
}
