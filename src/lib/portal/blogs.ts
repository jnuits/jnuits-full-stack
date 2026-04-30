import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { asFlexibleClient } from "@/lib/supabase/flexible";

type PortalBlogAuthorMember = {
  avatar_secure_url?: string | null;
  full_name: string | null;
  id: string;
  jnuits_id: string | null;
  member_type: string | null;
};

export async function getPortalBlogAuthorSnapshot(userId: string) {
  const admin = createAdminClient();
  const flexibleAdmin = asFlexibleClient(admin);
  const { data: member } = await flexibleAdmin
    .from("members" as string)
    .select("id, full_name, jnuits_id, member_type, avatar_secure_url")
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
    member: member as PortalBlogAuthorMember,
  };
}
