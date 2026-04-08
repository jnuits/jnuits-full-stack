"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAuthenticatedUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

function asString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

async function loadAuthorMember(userId: string) {
  const admin = createAdminClient();
  const { data: member } = await admin
    .from("members")
    .select("id, full_name, jnuits_id")
    .eq("user_id", userId)
    .maybeSingle();

  return {
    admin,
    member,
  };
}

async function loadOwnedDraft(
  admin: ReturnType<typeof createAdminClient>,
  memberId: string,
  postId: string
) {
  const { data } = await admin
    .from("content_posts")
    .select("id, author_member_id, content_type, status, title")
    .eq("id", postId)
    .eq("author_member_id", memberId)
    .eq("content_type", "blog")
    .maybeSingle();

  return data;
}

export async function saveMemberBlogDraft(formData: FormData) {
  const auth = await requireAuthenticatedUser();

  if (!auth.user) {
    redirect("/login");
  }

  const { admin, member } = await loadAuthorMember(auth.user.id);

  if (!member) {
    redirect("/portal/blogs?error=member-required");
  }

  const postId = asString(formData.get("postId"));
  const title = asString(formData.get("title"));
  const slug = slugify(asString(formData.get("slug")) || title);
  const category = asString(formData.get("category"));
  const summary = asString(formData.get("summary"));
  const excerpt = asString(formData.get("excerpt"));
  const body = asString(formData.get("body"));
  const readTime = asString(formData.get("readTime"));

  if (!title || !slug || !summary || !body) {
    redirect("/portal/blogs?error=draft-required");
  }

  if (postId) {
    const owned = await loadOwnedDraft(admin, member.id, postId);

    if (!owned) {
      redirect("/portal/blogs?error=draft-missing");
    }
  }

  const payload = {
    author_member_id: member.id,
    body,
    category: category || null,
    content_type: "blog",
    created_by_user_id: auth.user.id,
    excerpt: excerpt || null,
    read_time: readTime || null,
    review_note: null,
    reviewed_at: null,
    reviewed_by_user_id: null,
    slug,
    status: "draft",
    submitted_at: null,
    summary,
    title,
  };

  const query = postId
    ? admin.from("content_posts").update(payload).eq("id", postId).select("id").single()
    : admin.from("content_posts").insert(payload).select("id").single();

  const { data, error } = await query;

  if (error || !data) {
    redirect("/portal/blogs?error=draft-save");
  }

  await admin.from("audit_events").insert({
    action: postId ? "member.blog_draft_updated" : "member.blog_draft_created",
    actor_user_id: auth.user.id,
    entity_id: data.id,
    entity_type: "content_post",
    metadata: {
      authorMemberId: member.id,
      jnuitsId: member.jnuits_id,
      slug,
    },
  });

  revalidatePath("/portal/blogs");
  redirect(`/portal/blogs?message=draft-saved&edit=${data.id}`);
}

export async function submitMemberBlogDraft(formData: FormData) {
  const auth = await requireAuthenticatedUser();

  if (!auth.user) {
    redirect("/login");
  }

  const { admin, member } = await loadAuthorMember(auth.user.id);

  if (!member) {
    redirect("/portal/blogs?error=member-required");
  }

  const postId = asString(formData.get("postId"));

  if (!postId) {
    redirect("/portal/blogs?error=draft-missing");
  }

  const owned = await loadOwnedDraft(admin, member.id, postId);

  if (!owned) {
    redirect("/portal/blogs?error=draft-missing");
  }

  const nowIso = new Date().toISOString();
  const { error } = await admin
    .from("content_posts")
    .update({
      review_note: null,
      reviewed_at: null,
      reviewed_by_user_id: null,
      status: "submitted",
      submitted_at: nowIso,
      updated_at: nowIso,
    })
    .eq("id", postId);

  if (error) {
    redirect("/portal/blogs?error=draft-submit");
  }

  await admin.from("audit_events").insert({
    action: "member.blog_draft_submitted",
    actor_user_id: auth.user.id,
    entity_id: postId,
    entity_type: "content_post",
    metadata: {
      authorMemberId: member.id,
      jnuitsId: member.jnuits_id,
    },
  });

  await admin.from("membership_lifecycle_events").insert({
    member_id: member.id,
    event_type: "blog_draft_submitted",
    summary: "A member-authored blog draft was submitted for review.",
    created_by_user_id: auth.user.id,
    metadata: {
      postId,
    },
  });

  revalidatePath("/portal/blogs");
  revalidatePath("/admin/content");
  redirect("/portal/blogs?message=draft-submitted");
}
