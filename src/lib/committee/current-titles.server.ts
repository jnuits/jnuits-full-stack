import "server-only";
import { projectCurrentCommitteeTitles } from "./current-titles";
import { collectSupabasePages } from "./public";
import { createAdminClient } from "@/lib/supabase/admin";
import { asFlexibleClient } from "@/lib/supabase/flexible";

// Read only the displayed members and the explicitly current public term.
// Committee labels never become authorization claims or portal role grants.
export async function loadCurrentPublicCommitteeTitles(memberIds: readonly string[]): Promise<Map<string, string[]>> {
  if (memberIds.length === 0) return new Map();
  const admin = asFlexibleClient(createAdminClient());
  const { data: terms, error } = await admin.from("committee_terms").select("id, is_current, is_public, status, term_kind").eq("is_current", true).eq("is_public", true).eq("status", "active").eq("term_kind", "executive").limit(1);
  if (error) throw new Error("Unable to load current committee titles.");
  if (!terms?.length) return new Map();
  const termId = terms[0].id as string;
  const positions = await collectSupabasePages((from, to) => admin.from("committee_term_positions").select("term_id, role_id, is_public, public_label, role_group, priority").eq("term_id", termId).eq("is_public", true).order("id").range(from, to));
  const assignments: Parameters<typeof projectCurrentCommitteeTitles>[2][number][] = [];
  const uniqueIds = [...new Set(memberIds)];
  for (let index = 0; index < uniqueIds.length; index += 100) {
    const rows = await collectSupabasePages((from, to) => admin.from("committee_assignments").select("id, member_id, term_id, role_id, is_public, status, public_title_override, sort_order").eq("term_id", termId).eq("is_public", true).eq("status", "active").in("member_id", uniqueIds.slice(index, index + 100)).order("id").range(from, to));
    assignments.push(...rows as typeof assignments);
  }
  return projectCurrentCommitteeTitles(terms as Parameters<typeof projectCurrentCommitteeTitles>[0], positions as Parameters<typeof projectCurrentCommitteeTitles>[1], assignments);
}
