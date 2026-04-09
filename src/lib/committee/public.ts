import { cache } from "react";
import type { Tables } from "@/lib/db/types";
import { createClient } from "@/lib/supabase/server";

type CommitteeTermRecord = Tables<"committee_terms">;
type CommitteeAssignmentRecord = Tables<"committee_assignments">;
type CommitteeRoleRecord = Pick<
  Tables<"committee_roles">,
  "code" | "is_executive" | "sort_order" | "title"
>;
type MemberRecord = Pick<
  Tables<"members">,
  "current_organization" | "designation" | "full_name" | "jnuits_id"
>;
type CommitteeAssignmentWithRelations = CommitteeAssignmentRecord & {
  committee_roles?: CommitteeRoleRecord | CommitteeRoleRecord[] | null;
  members?: MemberRecord | MemberRecord[] | null;
  term_id: string;
};

function resolveRelation<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) {
    return value[0] || null;
  }

  return value || null;
}

export const getPublicCommitteeDirectory = cache(async () => {
  const supabase = await createClient();
  const { data: terms } = await supabase
    .from("committee_terms")
    .select("id, slug, title, summary, starts_on, ends_on, status")
    .eq("is_public", true)
    .in("status", ["active", "upcoming", "archived"])
    .order("starts_on", { ascending: false })
    .order("title", { ascending: true })
    .limit(12);

  if (!terms?.length) {
    return [];
  }

  const termIds = terms.map((term) => term.id);
  const { data: assignments } = await supabase
    .from("committee_assignments")
    .select(
      "id, term_id, display_name, bio, sort_order, status, starts_on, ends_on, committee_roles(title, code, is_executive, sort_order), members(full_name, jnuits_id, designation, current_organization)"
    )
    .in("term_id", termIds)
    .neq("status", "planned")
    .order("sort_order", { ascending: true })
    .limit(256);

  const assignmentsByTerm = new Map<string, CommitteeAssignmentWithRelations[]>();

  for (const assignment of ((assignments || []) as CommitteeAssignmentWithRelations[])) {
    const list = assignmentsByTerm.get(assignment.term_id) || [];
    list.push(assignment);
    assignmentsByTerm.set(assignment.term_id, list);
  }

  return (terms as CommitteeTermRecord[]).map((term) => ({
    assignments: (assignmentsByTerm.get(term.id) || []).map((assignment) => {
      const role = resolveRelation(assignment.committee_roles);
      const member = resolveRelation(assignment.members);

      return {
        bio: assignment.bio,
        displayName: assignment.display_name || member?.full_name || "Committee member",
        endsOn: assignment.ends_on,
        id: assignment.id,
        jnuitsId: member?.jnuits_id,
        organization: member?.current_organization,
        roleCode: role?.code || "committee-role",
        roleTitle: role?.title || "Committee role",
        sortOrder: assignment.sort_order,
        startsOn: assignment.starts_on,
        status: assignment.status,
        subtitle: member?.designation,
      };
    }),
    term,
  }));
});

function matchCommitteeAlias(
  alias: "5th" | "advisory",
  term: Pick<CommitteeTermRecord, "slug" | "title">
) {
  const slug = term.slug.toLowerCase();
  const title = term.title.toLowerCase();

  if (alias === "5th") {
    return slug.includes("5th") || title.includes("5th");
  }

  return slug.includes("advisory") || title.includes("advisory");
}

export const resolveCommitteeAliasSlug = cache(
  async (alias: "5th" | "advisory") => {
    const directory = await getPublicCommitteeDirectory();
    const matched = directory.find(({ term }) => matchCommitteeAlias(alias, term));
    return matched?.term.slug || null;
  }
);

export const getPublicCommitteeTermByIdentifier = cache(
  async (identifier: string) => {
    const normalized = identifier.trim().toLowerCase();

    if (!normalized) {
      return null;
    }

    const supabase = await createClient();
    const { data: directTerm } = await supabase
      .from("committee_terms")
      .select("id, slug, title, summary, starts_on, ends_on, status")
      .eq("is_public", true)
      .in("status", ["active", "upcoming", "archived"])
      .eq("slug", normalized)
      .maybeSingle();

    if (!directTerm) {
      return null;
    }

    const { data: assignments } = await supabase
      .from("committee_assignments")
      .select(
        "id, term_id, display_name, bio, sort_order, status, starts_on, ends_on, committee_roles(title, code, is_executive, sort_order), members(full_name, jnuits_id, designation, current_organization)"
      )
      .eq("term_id", directTerm.id)
      .neq("status", "planned")
      .order("sort_order", { ascending: true })
      .limit(256);

    return {
      assignments: ((assignments || []) as CommitteeAssignmentWithRelations[]).map(
        (assignment) => {
          const role = resolveRelation(assignment.committee_roles);
          const member = resolveRelation(assignment.members);

          return {
            bio: assignment.bio,
            displayName:
              assignment.display_name || member?.full_name || "Committee member",
            endsOn: assignment.ends_on,
            id: assignment.id,
            jnuitsId: member?.jnuits_id,
            organization: member?.current_organization,
            roleCode: role?.code || "committee-role",
            roleTitle: role?.title || "Committee role",
            sortOrder: assignment.sort_order,
            startsOn: assignment.starts_on,
            status: assignment.status,
            subtitle: member?.designation,
          };
        }
      ),
      term: directTerm as CommitteeTermRecord,
    };
  }
);
