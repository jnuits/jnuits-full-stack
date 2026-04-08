import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export async function getPortalBlogAuthorSnapshot(userId: string) {
  const admin = createAdminClient();
  const { data: member } = await admin
    .from("members")
    .select("id, full_name, jnuits_id, member_type")
    .eq("user_id", userId)
    .maybeSingle();

  if (!member) {
    return {
      drafts: [],
      member: null,
    };
  }

  const { data: posts } = await admin
    .from("content_posts")
    .select(
      "id, slug, title, category, summary, excerpt, body, status, read_time, published_at, submitted_at, reviewed_at, review_note, updated_at"
    )
    .eq("content_type", "blog")
    .eq("author_member_id", member.id)
    .order("updated_at", { ascending: false })
    .limit(12);

  return {
    drafts: posts || [],
    member,
  };
}
