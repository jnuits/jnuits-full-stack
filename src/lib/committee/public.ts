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

function resolveRelation<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) {
    return value[0] || null;
  }

  return value || null;
}

export const getPublicCommitteeSnapshot = cache(async () => {
  const supabase = await createClient();
  const { data: term } = await supabase
    .from("committee_terms")
    .select("id, slug, title, summary, starts_on, ends_on, status")
    .eq("is_public", true)
    .in("status", ["active", "upcoming", "archived"])
    .order("starts_on", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!term) {
    return null;
  }

  const { data: assignments } = await supabase
    .from("committee_assignments")
    .select(
      "id, display_name, bio, sort_order, status, starts_on, ends_on, committee_roles(title, code, is_executive, sort_order), members(full_name, jnuits_id, designation, current_organization)"
    )
    .eq("term_id", term.id)
    .neq("status", "planned")
    .order("sort_order", { ascending: true })
    .limit(64);

  return {
    term: term as CommitteeTermRecord,
    assignments: ((assignments || []) as (CommitteeAssignmentRecord & {
      committee_roles?: CommitteeRoleRecord | CommitteeRoleRecord[] | null;
      members?: MemberRecord | MemberRecord[] | null;
    })[]).map((assignment) => {
      const role = resolveRelation(assignment.committee_roles);
      const member = resolveRelation(assignment.members);

      return {
        id: assignment.id,
        bio: assignment.bio,
        displayName: assignment.display_name || member?.full_name || "Committee member",
        endsOn: assignment.ends_on,
        organization: member?.current_organization,
        roleCode: role?.code || "committee-role",
        roleTitle: role?.title || "Committee role",
        sortOrder: assignment.sort_order,
        startsOn: assignment.starts_on,
        status: assignment.status,
        subtitle: member?.designation,
        jnuitsId: member?.jnuits_id,
      };
    }),
  };
});
