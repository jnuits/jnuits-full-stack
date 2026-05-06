import "server-only";

import { formatAdvisorJnuitsIdForDisplay } from "@/lib/members/jnuits-id";
import { createAdminClient } from "@/lib/supabase/admin";
import { asFlexibleClient } from "@/lib/supabase/flexible";

type PortalBlogAuthorMember = {
  avatar_secure_url?: string | null;
  full_name: string | null;
  id: string;
  jnuits_id: string | null;
  member_type: string | null;
};

type PortalBlogAuthorAdvisor = {
  advisor_jnuits_id?: string | null;
  advisor_type?: string | null;
  avatar_secure_url?: string | null;
  department?: string | null;
  full_name: string | null;
  id: string;
};

export async function getPortalBlogAuthorSnapshot(userId: string) {
  const admin = createAdminClient();
  const flexibleAdmin = asFlexibleClient(admin);
  const { data: member } = await flexibleAdmin
    .from("members" as string)
    .select("id, full_name, jnuits_id, member_type, avatar_secure_url")
    .eq("user_id", userId)
    .maybeSingle();

  if (member && typeof member === "object") {
    const memberRecord = member as PortalBlogAuthorMember;
    const { data: posts } = await admin
      .from("content_posts")
      .select(
        "id, slug, title, category, summary, excerpt, body, status, read_time, published_at, submitted_at, reviewed_at, review_note, updated_at"
      )
      .eq("content_type", "blog")
      .eq("author_member_id", memberRecord.id)
      .order("updated_at", { ascending: false })
      .limit(12);

    return {
      advisor: null,
      authorKind: "member" as const,
      drafts: posts || [],
      member: memberRecord,
    };
  }

  const { data: advisor } = await flexibleAdmin
    .from("advisor_profiles" as string)
    .select("id, full_name, advisor_jnuits_id, advisor_type, department, avatar_secure_url")
    .eq("user_id", userId)
    .maybeSingle();

  if (advisor && typeof advisor === "object") {
    const advisorRecord = advisor as PortalBlogAuthorAdvisor;
    advisorRecord.advisor_jnuits_id =
      formatAdvisorJnuitsIdForDisplay(advisorRecord.advisor_jnuits_id) || null;
    const { data: posts } = await flexibleAdmin
      .from("content_posts" as string)
      .select(
        "id, slug, title, category, summary, excerpt, body, status, read_time, published_at, submitted_at, reviewed_at, review_note, updated_at"
      )
      .eq("content_type", "blog")
      .eq("author_advisor_profile_id", advisorRecord.id)
      .order("updated_at", { ascending: false })
      .limit(12);

    return {
      advisor: advisorRecord,
      authorKind: "advisor" as const,
      drafts: posts || [],
      member: null,
    };
  }

  return {
    advisor: null,
    authorKind: null,
    drafts: [],
    member: null,
  };
}
