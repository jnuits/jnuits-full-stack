import type { Tables } from "@/lib/db/types";
import {
  formatAdvisorJnuitsIdForDisplay,
  formatMembershipIdForDisplay,
} from "@/lib/members/jnuits-id";

import type {
  PublicAdvisorProfile,
  PublicCommitteeAssignment,
  PublicCommitteeDirectory,
  PublicCommitteeMemberProfile,
  PublicCommitteeTerm,
} from "./public-contracts";

export type PublicCommitteeProjectionTermRow = Pick<
  Tables<"committee_terms">,
  | "date_confidence"
  | "election_date"
  | "ends_on"
  | "id"
  | "is_current"
  | "is_public"
  | "slug"
  | "starts_on"
  | "status"
  | "summary"
  | "target_executive_slots"
  | "tenure_note"
  | "term_kind"
  | "term_number"
  | "title"
  | "voter_rule_note"
>;

export type PublicCommitteeProjectionPositionRow = Pick<
  Tables<"committee_term_positions">,
  | "id"
  | "is_public"
  | "max_slots"
  | "min_slots"
  | "priority"
  | "public_label"
  | "public_label_bn"
  | "role_group"
  | "role_id"
  | "target_slots"
  | "term_id"
>;

export type PublicCommitteeProjectionAssignmentRow = Pick<
  Tables<"committee_assignments">,
  | "display_name"
  | "id"
  | "is_public"
  | "member_id"
  | "public_title_override"
  | "role_id"
  | "sort_order"
  | "status"
  | "term_id"
>;

export type PublicCommitteeProjectionRoleRow = Pick<
  Tables<"committee_roles">,
  "code" | "id"
>;

export type PublicCommitteeProjectionMemberRow = Pick<
  Tables<"members">,
  | "avatar_secure_url"
  | "department_code"
  | "facebook_url"
  | "full_name"
  | "id"
  | "jnuits_id"
  | "linkedin_url"
  | "website_url"
>;

export type PublicCommitteeProjectionDepartmentRow = Pick<
  Tables<"departments">,
  "code" | "name"
>;

export type PublicCommitteeProjectionAdvisorRow = Pick<
  Tables<"advisor_profiles">,
  | "advisor_jnuits_id"
  | "advisor_type"
  | "avatar_secure_url"
  | "bio"
  | "date_confidence"
  | "department"
  | "designation"
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
  | "sort_order"
  | "status_note"
  | "tenure_display"
  | "title"
  | "website_url"
>;

export type PublicCommitteeProjectionInput = {
  advisors: readonly PublicCommitteeProjectionAdvisorRow[];
  assignments: readonly PublicCommitteeProjectionAssignmentRow[];
  departments: readonly PublicCommitteeProjectionDepartmentRow[];
  members: readonly PublicCommitteeProjectionMemberRow[];
  positions: readonly PublicCommitteeProjectionPositionRow[];
  roles: readonly PublicCommitteeProjectionRoleRow[];
  terms: readonly PublicCommitteeProjectionTermRow[];
};

const PUBLIC_TERM_STATUSES = new Set(["active", "archived", "upcoming"]);

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

function mapAdvisors(
  advisors: readonly PublicCommitteeProjectionAdvisorRow[]
): PublicAdvisorProfile[] {
  return advisors
    .filter((advisor) => advisor.is_public)
    .map(
      (advisor): PublicAdvisorProfile => ({
        advisorJnuitsId: formatAdvisorJnuitsIdForDisplay(
          advisor.advisor_jnuits_id
        ),
        advisorType: asAdvisorType(advisor.advisor_type),
        avatarUrl: advisor.avatar_secure_url,
        bio: advisor.bio,
        dateConfidence:
          advisor.date_confidence === "estimated" ? "estimated" : "verified",
        department: advisor.department,
        designation: advisor.designation,
        facebookUrl: advisor.facebook_url,
        formerTitle: advisor.former_title,
        fullName: advisor.full_name,
        id: advisor.id,
        isCurrent: advisor.is_current,
        jnuProfileUrl: advisor.jnu_profile_url,
        joinedOn: advisor.joined_on,
        leftOn: advisor.left_on,
        linkedinUrl: advisor.linkedin_url,
        sortOrder: advisor.sort_order,
        statusNote: advisor.status_note,
        tenureDisplay: advisor.tenure_display,
        title: advisor.title,
        websiteUrl: advisor.website_url,
      })
    )
    .sort(
      (left, right) =>
        left.sortOrder - right.sortOrder ||
        left.fullName.localeCompare(right.fullName, "en") ||
        left.id.localeCompare(right.id)
    );
}

function compareTerms(
  left: PublicCommitteeProjectionTermRow,
  right: PublicCommitteeProjectionTermRow
) {
  return (
    (right.term_number ?? -1) - (left.term_number ?? -1) ||
    right.starts_on.localeCompare(left.starts_on) ||
    left.id.localeCompare(right.id)
  );
}

function buildMemberProfiles(
  terms: readonly PublicCommitteeTerm[]
): PublicCommitteeMemberProfile[] {
  const profiles = new Map<string, PublicCommitteeMemberProfile>();

  for (const term of terms) {
    for (const assignment of term.assignments) {
      if (!assignment.jnuitsId) {
        continue;
      }

      const key = assignment.jnuitsId.toLowerCase();
      const existing = profiles.get(key);
      const appointment = {
        assignmentId: assignment.id,
        dateConfidence: term.dateConfidence,
        endsOn: term.endsOn,
        roleCode: assignment.roleCode,
        roleGroup: assignment.roleGroup,
        roleTitle: assignment.roleTitle,
        roleTitleBn: assignment.roleTitleBn,
        startsOn: term.startsOn,
        termNumber: term.termNumber,
        termSlug: term.slug,
        termTitle: term.title,
      } as const;

      if (existing) {
        existing.appointments.push(appointment);
        continue;
      }

      profiles.set(key, {
        appointments: [appointment],
        avatarUrl: assignment.avatarUrl,
        departmentName: assignment.departmentName,
        displayName: assignment.displayName,
        facebookUrl: assignment.facebookUrl,
        jnuitsId: assignment.jnuitsId,
        linkedinUrl: assignment.linkedinUrl,
        websiteUrl: assignment.websiteUrl,
      });
    }
  }

  return [...profiles.values()];
}

export function projectPublicCommitteeDirectory(
  input: PublicCommitteeProjectionInput
): PublicCommitteeDirectory {
  const roleById = new Map(input.roles.map((role) => [role.id, role]));
  const memberById = new Map(input.members.map((member) => [member.id, member]));
  const departmentByCode = new Map(
    input.departments.flatMap((department) => [
      [department.code, department.name] as const,
      [department.code.toLowerCase(), department.name] as const,
    ])
  );
  const assignmentsByTerm = new Map<
    string,
    PublicCommitteeProjectionAssignmentRow[]
  >();
  const positionsByTerm = new Map<
    string,
    PublicCommitteeProjectionPositionRow[]
  >();

  for (const assignment of input.assignments) {
    const list = assignmentsByTerm.get(assignment.term_id) || [];
    list.push(assignment);
    assignmentsByTerm.set(assignment.term_id, list);
  }

  for (const position of input.positions) {
    const list = positionsByTerm.get(position.term_id) || [];
    list.push(position);
    positionsByTerm.set(position.term_id, list);
  }

  const publicTerms = [...input.terms]
    .filter(
      (term) =>
        term.is_public &&
        term.term_kind === "executive" &&
        PUBLIC_TERM_STATUSES.has(term.status)
    )
    .sort(compareTerms);

  const terms = publicTerms.map((term): PublicCommitteeTerm => {
    const publicPositions = (positionsByTerm.get(term.id) || []).filter(
      (position) => position.is_public && position.role_group !== "advisor"
    );
    const positionByRoleId = new Map(
      publicPositions.map((position) => [position.role_id, position])
    );
    const assignments = (assignmentsByTerm.get(term.id) || [])
      .flatMap((assignment) => {
        if (!assignment.is_public || assignment.status === "planned") {
          return [];
        }

        const position = positionByRoleId.get(assignment.role_id);
        const role = roleById.get(assignment.role_id);

        if (!position || !role) {
          return [];
        }

        const member = assignment.member_id
          ? memberById.get(assignment.member_id) || null
          : null;
        const displayName = assignment.display_name?.trim() || member?.full_name.trim();

        if (!displayName) {
          return [];
        }

        const jnuitsId = member
          ? formatMembershipIdForDisplay(member.jnuits_id) || null
          : null;
        const departmentName = member?.department_code
          ? departmentByCode.get(member.department_code) ||
            departmentByCode.get(member.department_code.toLowerCase()) ||
            member.department_code
          : null;
        const projected = {
          avatarUrl: member?.avatar_secure_url ?? null,
          departmentName,
          displayName,
          facebookUrl: member?.facebook_url ?? null,
          id: assignment.id,
          jnuitsId,
          linkedinUrl: member?.linkedin_url ?? null,
          positionId: position.id,
          roleCode: role.code,
          roleGroup: position.role_group,
          roleId: role.id,
          roleTitle:
            assignment.public_title_override?.trim() || position.public_label,
          roleTitleBn: position.public_label_bn,
          sortOrder: assignment.sort_order,
          websiteUrl: member?.website_url ?? null,
        } satisfies PublicCommitteeAssignment;

        return [{ positionPriority: position.priority, projected }];
      })
      .sort(
        (left, right) =>
          left.positionPriority - right.positionPriority ||
          left.projected.sortOrder - right.projected.sortOrder ||
          left.projected.id.localeCompare(right.projected.id)
      )
      .map(({ projected }) => projected);
    const configuredSeats = publicPositions.reduce(
      (total, position) => total + position.target_slots,
      0
    );

    return {
      assignments,
      dateConfidence:
        term.date_confidence === "estimated" ? "estimated" : "verified",
      electionDate: term.election_date,
      endsOn: term.ends_on,
      id: term.id,
      isCurrent: term.is_current,
      slug: term.slug,
      startsOn: term.starts_on,
      status: term.status,
      summary: term.summary,
      targetExecutiveSlots:
        publicPositions.length > 0
          ? configuredSeats
          : term.target_executive_slots,
      tenureNote: term.tenure_note,
      termNumber: term.term_number,
      title: term.title,
      voterRuleNote: term.voter_rule_note,
    };
  });

  return {
    advisors: mapAdvisors(input.advisors),
    currentTerm: terms.find((term) => term.isCurrent) || terms[0] || null,
    memberProfiles: buildMemberProfiles(terms),
    terms,
  };
}
