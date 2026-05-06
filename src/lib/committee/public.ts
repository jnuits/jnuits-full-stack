import { cache } from "react";

import type { Tables } from "@/lib/db/types";
import {
  formatAdvisorJnuitsIdForDisplay,
  formatMembershipIdForDisplay,
} from "@/lib/members/jnuits-id";
import { asFlexibleClient } from "@/lib/supabase/flexible";
import { createClient } from "@/lib/supabase/server";

type CommitteeTermRecord = Pick<
  Tables<"committee_terms">,
  "ends_on" | "id" | "is_public" | "slug" | "starts_on" | "status" | "summary" | "title"
> & {
  date_confidence?: string | null;
  election_date?: string | null;
  is_current?: boolean | null;
  target_executive_slots?: number | null;
  tenure_note?: string | null;
  term_kind?: string | null;
  term_number?: number | null;
  voter_rule_note?: string | null;
};

type CommitteeRoleRecord = Pick<
  Tables<"committee_roles">,
  "code" | "is_executive" | "is_public" | "sort_order" | "title"
> & {
  default_slots?: number | null;
  max_slots?: number | null;
  min_slots?: number | null;
  role_group?: string | null;
  title_bn?: string | null;
};

type MemberRecord = {
  avatar_secure_url?: string | null;
  department_code?: string | null;
  facebook_url?: string | null;
  full_name?: string | null;
  jnuits_id?: string | null;
  linkedin_url?: string | null;
  website_url?: string | null;
  departments?: { name?: string | null } | { name?: string | null }[] | null;
};

type CommitteeAssignmentRecord = Pick<
  Tables<"committee_assignments">,
  "bio" | "display_name" | "ends_on" | "id" | "sort_order" | "starts_on" | "status" | "term_id"
> & {
  is_public?: boolean | null;
  public_title_override?: string | null;
  committee_roles?: CommitteeRoleRecord | CommitteeRoleRecord[] | null;
  members?: MemberRecord | MemberRecord[] | null;
};

type AdvisorProfileRecord = Pick<
  Tables<"advisor_profiles">,
  | "advisor_type"
  | "advisor_jnuits_id"
  | "avatar_secure_url"
  | "bio"
  | "date_confidence"
  | "department"
  | "designation"
  | "email"
  | "facebook_url"
  | "former_title"
  | "full_name"
  | "id"
  | "is_current"
  | "is_public"
  | "jnu_profile_url"
  | "joined_on"
  | "left_on"
  | "linkedin_url"
  | "publications"
  | "sort_order"
  | "speech"
  | "status_note"
  | "tenure_display"
  | "title"
  | "website_url"
  | "work_experience"
>;

export type PublicCommitteeAssignment = {
  avatarUrl: string | null;
  bio: string | null;
  departmentName: string | null;
  displayName: string;
  endsOn: string | null;
  facebookUrl: string | null;
  id: string;
  jnuitsId: string | null;
  linkedinUrl: string | null;
  roleCode: string;
  roleGroup: string;
  roleTitle: string;
  roleTitleBn: string | null;
  sortOrder: number;
  startsOn: string | null;
  status: string;
  websiteUrl: string | null;
};

export type PublicCommitteeTerm = {
  assignments: PublicCommitteeAssignment[];
  dateConfidence: "estimated" | "verified";
  electionDate: string | null;
  endsOn: string | null;
  id: string;
  isCurrent: boolean;
  slug: string;
  startsOn: string;
  status: string;
  summary: string | null;
  targetExecutiveSlots: number;
  tenureNote: string | null;
  termNumber: number | null;
  title: string;
  voterRuleNote: string | null;
};

export type PublicAdvisorProfile = {
  advisorJnuitsId: string | null;
  advisorType: "honorable_advisor" | "main_advisor" | "moderator_mentor";
  avatarUrl: string | null;
  bio: string | null;
  dateConfidence: "estimated" | "verified";
  department: string | null;
  designation: string | null;
  email: string | null;
  facebookUrl: string | null;
  formerTitle: string | null;
  fullName: string;
  id: string;
  isCurrent: boolean;
  jnuProfileUrl: string | null;
  joinedOn: string | null;
  leftOn: string | null;
  linkedinUrl: string | null;
  publications: string[];
  sortOrder: number;
  speech: string | null;
  statusNote: string | null;
  tenureDisplay: string | null;
  title: string | null;
  websiteUrl: string | null;
  workExperience: string[];
};

export type PublicCommitteeDirectory = {
  advisors: PublicAdvisorProfile[];
  currentTerm: PublicCommitteeTerm | null;
  terms: PublicCommitteeTerm[];
};

function resolveRelation<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] || null : value || null;
}

function resolveDepartmentName(member: MemberRecord | null) {
  const departments = member?.departments;

  if (!departments) {
    return member?.department_code || null;
  }

  if (Array.isArray(departments)) {
    return departments[0]?.name || member?.department_code || null;
  }

  return departments.name || member?.department_code || null;
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (typeof item === "string") {
        return item.trim();
      }

      if (item && typeof item === "object") {
        const record = item as Record<string, unknown>;
        return String(record.title || record.name || record.label || "").trim();
      }

      return "";
    })
    .filter(Boolean)
    .slice(0, 6);
}

function asAdvisorType(value: string): PublicAdvisorProfile["advisorType"] {
  if (
    value === "main_advisor" ||
    value === "moderator_mentor" ||
    value === "honorable_advisor"
  ) {
    return value;
  }

  return "honorable_advisor";
}

function isExecutiveRole(role: CommitteeRoleRecord | null) {
  if (!role) {
    return false;
  }

  if (role.role_group) {
    return role.role_group === "executive";
  }

  return role.is_executive && role.code !== "sub-executive-member";
}

function mapAssignment(assignment: CommitteeAssignmentRecord) {
  const role = resolveRelation(assignment.committee_roles);
  const member = resolveRelation(assignment.members);

  if (!isExecutiveRole(role)) {
    return null;
  }

  return {
    avatarUrl: member?.avatar_secure_url ?? null,
    bio: assignment.bio,
    departmentName: resolveDepartmentName(member),
    displayName: assignment.display_name || member?.full_name || "Committee member",
    endsOn: assignment.ends_on,
    facebookUrl: member?.facebook_url ?? null,
    id: assignment.id,
    jnuitsId: formatMembershipIdForDisplay(member?.jnuits_id) || null,
    linkedinUrl: member?.linkedin_url ?? null,
    roleCode: role?.code || "committee-role",
    roleGroup: role?.role_group || "executive",
    roleTitle: assignment.public_title_override || role?.title || "Committee role",
    roleTitleBn: role?.title_bn || null,
    sortOrder: assignment.sort_order,
    startsOn: assignment.starts_on,
    status: assignment.status,
    websiteUrl: member?.website_url ?? null,
  } satisfies PublicCommitteeAssignment;
}

async function loadTerms() {
  const supabase = await createClient();
  const flexible = asFlexibleClient(supabase);
  const extendedSelect =
    "id, slug, title, summary, starts_on, ends_on, status, is_public, term_number, term_kind, election_date, is_current, date_confidence, tenure_note, target_executive_slots, voter_rule_note";
  const baseSelect = "id, slug, title, summary, starts_on, ends_on, status, is_public";

  const extended = await flexible
    .from("committee_terms" as string)
    .select(extendedSelect)
    .eq("is_public", true)
    .in("status", ["active", "upcoming", "archived"])
    .order("starts_on", { ascending: false })
    .limit(24);

  if (!extended.error) {
    return (extended.data || []) as CommitteeTermRecord[];
  }

  const fallback = await flexible
    .from("committee_terms" as string)
    .select(baseSelect)
    .eq("is_public", true)
    .in("status", ["active", "upcoming", "archived"])
    .order("starts_on", { ascending: false })
    .limit(24);

  return (fallback.data || []) as CommitteeTermRecord[];
}

async function loadAssignments(termIds: string[]) {
  if (termIds.length === 0) {
    return [] as CommitteeAssignmentRecord[];
  }

  const supabase = await createClient();
  const flexible = asFlexibleClient(supabase);
  const extendedSelect =
    "id, term_id, display_name, bio, sort_order, starts_on, ends_on, status, is_public, public_title_override, committee_roles(title, title_bn, code, is_executive, is_public, sort_order, role_group), members(full_name, jnuits_id, department_code, avatar_secure_url, facebook_url, linkedin_url, website_url, departments(name))";
  const baseSelect =
    "id, term_id, display_name, bio, sort_order, starts_on, ends_on, status, committee_roles(title, code, is_executive, is_public, sort_order), members(full_name, jnuits_id, department_code, facebook_url, linkedin_url, website_url, departments(name))";

  const extended = await flexible
    .from("committee_assignments" as string)
    .select(extendedSelect)
    .in("term_id", termIds)
    .neq("status", "planned")
    .order("sort_order", { ascending: true })
    .limit(512);

  if (!extended.error) {
    return (extended.data || []) as CommitteeAssignmentRecord[];
  }

  const fallback = await flexible
    .from("committee_assignments" as string)
    .select(baseSelect)
    .in("term_id", termIds)
    .neq("status", "planned")
    .order("sort_order", { ascending: true })
    .limit(512);

  return (fallback.data || []) as CommitteeAssignmentRecord[];
}

async function loadAdvisors() {
  const supabase = await createClient();
  const flexible = asFlexibleClient(supabase);
  const extendedSelect =
    "id, advisor_jnuits_id, advisor_type, full_name, title, former_title, department, designation, email, avatar_secure_url, speech, bio, work_experience, publications, facebook_url, linkedin_url, website_url, jnu_profile_url, joined_on, left_on, tenure_display, date_confidence, status_note, is_current, is_public, sort_order";
  const baseSelect =
    "id, advisor_type, full_name, title, department, designation, email, avatar_secure_url, speech, bio, work_experience, publications, facebook_url, linkedin_url, website_url, joined_on, left_on, is_current, is_public, sort_order";

  const extended = await flexible
    .from("advisor_profiles" as string)
    .select(extendedSelect)
    .eq("is_public", true)
    .order("sort_order", { ascending: true })
    .order("full_name", { ascending: true })
    .limit(32);

  const result = !extended.error
    ? extended
    : await flexible
        .from("advisor_profiles" as string)
        .select(baseSelect)
        .eq("is_public", true)
        .order("sort_order", { ascending: true })
        .order("full_name", { ascending: true })
        .limit(32);

  if (result.error) {
    return [] as PublicAdvisorProfile[];
  }

  return ((result.data || []) as AdvisorProfileRecord[]).map((advisor): PublicAdvisorProfile => ({
    advisorJnuitsId: formatAdvisorJnuitsIdForDisplay(advisor.advisor_jnuits_id),
    advisorType: asAdvisorType(advisor.advisor_type),
    avatarUrl: advisor.avatar_secure_url,
    bio: advisor.bio,
    dateConfidence: advisor.date_confidence === "estimated" ? "estimated" : "verified",
    department: advisor.department,
    designation: advisor.designation,
    email: advisor.email,
    facebookUrl: advisor.facebook_url,
    formerTitle: advisor.former_title || null,
    fullName: advisor.full_name,
    id: advisor.id,
    isCurrent: advisor.is_current,
    jnuProfileUrl: advisor.jnu_profile_url || null,
    joinedOn: advisor.joined_on,
    leftOn: advisor.left_on,
    linkedinUrl: advisor.linkedin_url,
    publications: asStringList(advisor.publications),
    sortOrder: advisor.sort_order,
    speech: advisor.speech,
    statusNote: advisor.status_note || null,
    tenureDisplay: advisor.tenure_display || null,
    title: advisor.title,
    websiteUrl: advisor.website_url,
    workExperience: asStringList(advisor.work_experience),
  }));
}

function mapTerm(
  term: CommitteeTermRecord,
  assignments: CommitteeAssignmentRecord[]
): PublicCommitteeTerm {
  return {
    assignments: assignments
      .map(mapAssignment)
      .filter((assignment): assignment is PublicCommitteeAssignment =>
        Boolean(assignment)
      )
      .sort((left, right) => left.sortOrder - right.sortOrder),
    dateConfidence: term.date_confidence === "estimated" ? "estimated" : "verified",
    electionDate: term.election_date || null,
    endsOn: term.ends_on,
    id: term.id,
    isCurrent: Boolean(term.is_current) || term.status === "active",
    slug: term.slug,
    startsOn: term.starts_on,
    status: term.status,
    summary: term.summary,
    targetExecutiveSlots: term.target_executive_slots || 21,
    tenureNote: term.tenure_note || null,
    termNumber: term.term_number || null,
    title: term.title,
    voterRuleNote: term.voter_rule_note || null,
  };
}

export const getPublicCommitteeDirectory = cache(async () => {
  const [terms, advisors] = await Promise.all([loadTerms(), loadAdvisors()]);
  const executiveTerms = terms.filter((term) => (term.term_kind || "executive") === "executive");
  const termIds = executiveTerms.map((term) => term.id);
  const assignments = await loadAssignments(termIds);
  const assignmentsByTerm = new Map<string, CommitteeAssignmentRecord[]>();

  for (const assignment of assignments) {
    if (assignment.is_public === false) {
      continue;
    }

    const list = assignmentsByTerm.get(assignment.term_id) || [];
    list.push(assignment);
    assignmentsByTerm.set(assignment.term_id, list);
  }

  const mappedTerms = executiveTerms.map((term) =>
    mapTerm(term, assignmentsByTerm.get(term.id) || [])
  );
  const currentTerm =
    mappedTerms.find((term) => term.isCurrent) || mappedTerms[0] || null;

  return {
    advisors,
    currentTerm,
    terms: mappedTerms,
  } satisfies PublicCommitteeDirectory;
});

function matchCommitteeAlias(
  alias: "5th" | "advisory",
  term: Pick<PublicCommitteeTerm, "slug" | "title">
) {
  const slug = term.slug.toLowerCase();
  const title = term.title.toLowerCase();

  if (alias === "5th") {
    return slug.includes("5th") || title.includes("5th");
  }

  return slug.includes("advisor") || title.includes("advisor");
}

export const resolveCommitteeAliasSlug = cache(
  async (alias: "5th" | "advisory") => {
    const directory = await getPublicCommitteeDirectory();

    if (alias === "advisory") {
      return null;
    }

    const matched = directory.terms.find((term) => matchCommitteeAlias(alias, term));
    return matched?.slug || null;
  }
);

export const getPublicCommitteeTermByIdentifier = cache(
  async (identifier: string) => {
    const normalized = identifier.trim().toLowerCase();

    if (!normalized) {
      return null;
    }

    const directory = await getPublicCommitteeDirectory();
    return directory.terms.find((term) => term.slug === normalized) || null;
  }
);
