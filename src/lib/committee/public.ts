import "server-only";

import { cache } from "react";

import type {
  PublicCommitteeDirectory,
  PublicCommitteeMemberProfile,
  PublicCommitteeTerm,
} from "@/lib/committee/public-contracts";
import {
  projectPublicCommitteeDirectory,
  type PublicCommitteeProjectionAdvisorRow,
  type PublicCommitteeProjectionAssignmentRow,
  type PublicCommitteeProjectionDepartmentRow,
  type PublicCommitteeProjectionMemberRow,
  type PublicCommitteeProjectionPositionRow,
  type PublicCommitteeProjectionRoleRow,
  type PublicCommitteeProjectionTermRow,
} from "@/lib/committee/public-projection";
import { formatMembershipIdForDisplay } from "@/lib/members/jnuits-id";
import { createAdminClient } from "@/lib/supabase/admin";
import { asFlexibleClient } from "@/lib/supabase/flexible";

export type {
  PublicAdvisorProfile,
  PublicCommitteeAppointment,
  PublicCommitteeAssignment,
  PublicCommitteeDirectory,
  PublicCommitteeMemberProfile,
  PublicCommitteeTerm,
} from "@/lib/committee/public-contracts";

const PUBLIC_COMMITTEE_PAGE_SIZE = 500;
const PUBLIC_COMMITTEE_FILTER_CHUNK_SIZE = 100;

const PUBLIC_COMMITTEE_TERM_SELECT =
  "id, slug, title, summary, starts_on, ends_on, status, is_public, term_number, term_kind, election_date, is_current, date_confidence, tenure_note, target_executive_slots, voter_rule_note";
const PUBLIC_COMMITTEE_POSITION_SELECT =
  "id, term_id, role_id, public_label, public_label_bn, role_group, priority, is_public, min_slots, max_slots, target_slots";
const PUBLIC_COMMITTEE_ASSIGNMENT_SELECT =
  "id, term_id, role_id, member_id, display_name, sort_order, status, is_public, public_title_override";
const PUBLIC_COMMITTEE_ROLE_SELECT = "id, code";
const PUBLIC_COMMITTEE_MEMBER_SELECT =
  "id, jnuits_id, full_name, department_code, avatar_secure_url, facebook_url, linkedin_url, website_url";
const PUBLIC_COMMITTEE_DEPARTMENT_SELECT = "code, name";
const PUBLIC_COMMITTEE_ADVISOR_SELECT =
  "id, advisor_jnuits_id, advisor_type, full_name, title, former_title, department, designation, avatar_secure_url, bio, facebook_url, linkedin_url, website_url, jnu_profile_url, joined_on, left_on, tenure_display, date_confidence, status_note, is_current, is_public, sort_order";

type SupabasePageResult<T> = {
  data: T[] | null;
  error: unknown;
};

export async function collectSupabasePages<T>(
  fetchPage: (
    from: number,
    to: number
  ) => PromiseLike<SupabasePageResult<T>>,
  pageSize = PUBLIC_COMMITTEE_PAGE_SIZE
): Promise<T[]> {
  if (!Number.isInteger(pageSize) || pageSize < 1) {
    throw new Error("Unable to load public committee data.");
  }

  const rows: T[] = [];

  for (let from = 0; ; from += pageSize) {
    const result = await fetchPage(from, from + pageSize - 1);

    if (result.error) {
      throw new Error("Unable to load public committee data.");
    }

    const page = result.data || [];
    rows.push(...page);

    if (page.length < pageSize) {
      return rows;
    }
  }
}

function unique(values: Array<string | null>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function chunks<T>(
  values: readonly T[],
  size = PUBLIC_COMMITTEE_FILTER_CHUNK_SIZE
) {
  const result: T[][] = [];

  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }

  return result;
}

async function collectFilteredRows<T>(
  values: readonly string[],
  fetchChunkPage: (
    chunk: readonly string[],
    from: number,
    to: number
  ) => PromiseLike<SupabasePageResult<T>>
) {
  const rows: T[] = [];

  for (const chunk of chunks(values)) {
    rows.push(
      ...(await collectSupabasePages<T>((from, to) =>
        fetchChunkPage(chunk, from, to)
      ))
    );
  }

  return rows;
}

async function loadTerms() {
  const admin = asFlexibleClient(createAdminClient());

  return collectSupabasePages<PublicCommitteeProjectionTermRow>((from, to) =>
    admin
      .from("committee_terms" as string)
      .select(PUBLIC_COMMITTEE_TERM_SELECT)
      .eq("is_public", true)
      .eq("term_kind", "executive")
      .in("status", ["active", "upcoming", "archived"])
      .order("term_number", { ascending: false, nullsFirst: false })
      .order("starts_on", { ascending: false })
      .range(from, to)
  );
}

async function loadPositions(termIds: readonly string[]) {
  if (termIds.length === 0) return [];
  const admin = asFlexibleClient(createAdminClient());

  return collectFilteredRows<PublicCommitteeProjectionPositionRow>(
    termIds,
    (termIdChunk, from, to) =>
      admin
        .from("committee_term_positions" as string)
        .select(PUBLIC_COMMITTEE_POSITION_SELECT)
        .in("term_id", termIdChunk)
        .order("term_id", { ascending: true })
        .order("priority", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to)
  );
}

async function loadAssignments(termIds: readonly string[]) {
  if (termIds.length === 0) return [];
  const admin = asFlexibleClient(createAdminClient());

  return collectFilteredRows<PublicCommitteeProjectionAssignmentRow>(
    termIds,
    (termIdChunk, from, to) =>
      admin
        .from("committee_assignments" as string)
        .select(PUBLIC_COMMITTEE_ASSIGNMENT_SELECT)
        .in("term_id", termIdChunk)
        .eq("is_public", true)
        .neq("status", "planned")
        .order("term_id", { ascending: true })
        .order("sort_order", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to)
  );
}

async function loadRoles(roleIds: readonly string[]) {
  if (roleIds.length === 0) return [];
  const admin = asFlexibleClient(createAdminClient());

  return collectFilteredRows<PublicCommitteeProjectionRoleRow>(
    roleIds,
    (roleIdChunk, from, to) =>
      admin
        .from("committee_roles" as string)
        .select(PUBLIC_COMMITTEE_ROLE_SELECT)
        .in("id", roleIdChunk)
        .order("id", { ascending: true })
        .range(from, to)
  );
}

async function loadMembers(memberIds: readonly string[]) {
  if (memberIds.length === 0) return [];
  const admin = asFlexibleClient(createAdminClient());

  return collectFilteredRows<PublicCommitteeProjectionMemberRow>(
    memberIds,
    (memberIdChunk, from, to) =>
      admin
        .from("members" as string)
        .select(PUBLIC_COMMITTEE_MEMBER_SELECT)
        .in("id", memberIdChunk)
        .order("id", { ascending: true })
        .range(from, to)
  );
}

async function loadDepartments(departmentCodes: readonly string[]) {
  if (departmentCodes.length === 0) return [];
  const admin = asFlexibleClient(createAdminClient());

  return collectFilteredRows<PublicCommitteeProjectionDepartmentRow>(
    departmentCodes,
    (departmentCodeChunk, from, to) =>
      admin
        .from("departments" as string)
        .select(PUBLIC_COMMITTEE_DEPARTMENT_SELECT)
        .in("code", departmentCodeChunk)
        .order("code", { ascending: true })
        .range(from, to)
  );
}

async function loadAdvisors() {
  const admin = asFlexibleClient(createAdminClient());

  return collectSupabasePages<PublicCommitteeProjectionAdvisorRow>((from, to) =>
    admin
      .from("advisor_profiles" as string)
      .select(PUBLIC_COMMITTEE_ADVISOR_SELECT)
      .eq("is_public", true)
      .order("sort_order", { ascending: true })
      .order("full_name", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to)
  );
}

export const getPublicCommitteeDirectory = cache(
  async (): Promise<PublicCommitteeDirectory> => {
    const [terms, advisors] = await Promise.all([loadTerms(), loadAdvisors()]);
    const termIds = terms.map((term) => term.id);
    const [positions, assignments] = await Promise.all([
      loadPositions(termIds),
      loadAssignments(termIds),
    ]);
    const roleIds = unique([
      ...positions.map((position) => position.role_id),
      ...assignments.map((assignment) => assignment.role_id),
    ]);
    const memberIds = unique(assignments.map((assignment) => assignment.member_id));
    const [roles, members] = await Promise.all([
      loadRoles(roleIds),
      loadMembers(memberIds),
    ]);
    const departmentCodes = unique(
      members.map((member) => member.department_code)
    );
    const departments = await loadDepartments(departmentCodes);

    return projectPublicCommitteeDirectory({
      advisors,
      assignments,
      departments,
      members,
      positions,
      roles,
      terms,
    });
  }
);

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
    if (alias === "advisory") {
      return null;
    }

    const directory = await getPublicCommitteeDirectory();
    return (
      directory.terms.find((term) => matchCommitteeAlias(alias, term))?.slug ||
      null
    );
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

export const getPublicCommitteeMemberProfileByJnuitsId = cache(
  async (jnuitsId: string): Promise<PublicCommitteeMemberProfile | null> => {
    let decodedId: string;

    try {
      decodedId = decodeURIComponent(jnuitsId);
    } catch {
      return null;
    }

    const displayId = formatMembershipIdForDisplay(decodedId);

    if (!displayId) {
      return null;
    }

    const directory = await getPublicCommitteeDirectory();
    return (
      directory.memberProfiles.find(
        (profile) => profile.jnuitsId.toLowerCase() === displayId.toLowerCase()
      ) || null
    );
  }
);
