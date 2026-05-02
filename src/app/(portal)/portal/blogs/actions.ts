"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requirePortalUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { asFlexibleClient } from "@/lib/supabase/flexible";

function asString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

const memberBlogDraftSchema = z.object({
  body: z.string().trim().min(1, "Blog body is required.").max(50000),
  category: z.string().trim().max(80).optional().default(""),
  excerpt: z.string().trim().max(500).optional().default(""),
  postId: z.string().trim().max(80).optional().default(""),
  readTime: z.string().trim().max(40).optional().default(""),
  slug: z.string().trim().max(160).optional().default(""),
  summary: z.string().trim().min(1, "Summary is required.").max(500),
  title: z.string().trim().min(3, "Title is required.").max(180),
});

const submitDraftSchema = z.object({
  postId: z.string().trim().min(1, "Draft is required.").max(80),
});

type BlogAuthor =
  | {
      advisor: null;
      advisorId: null;
      authorKind: "member";
      jnuitsId: null | string;
      memberId: string;
      name: null | string;
    }
  | {
      advisor: string;
      advisorId: string;
      authorKind: "advisor";
      jnuitsId: null;
      memberId: null;
      name: null | string;
    };

function pickFormFields(formData: FormData, fields: string[]) {
  return Object.fromEntries(
    fields.map((field) => [field, asString(formData.get(field))])
  );
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

async function loadBlogAuthor(userId: string) {
  const admin = createAdminClient();
  const flexibleAdmin = asFlexibleClient(admin);
  const { data: member } = await flexibleAdmin
    .from("members" as string)
    .select("id, full_name, jnuits_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (member && typeof member === "object") {
    const record = member as Record<string, unknown>;
    if (typeof record.id === "string") {
      return {
        admin,
        author: {
          advisor: null,
          advisorId: null,
          authorKind: "member",
          jnuitsId: typeof record.jnuits_id === "string" ? record.jnuits_id : null,
          memberId: record.id,
          name: typeof record.full_name === "string" ? record.full_name : null,
        } satisfies BlogAuthor,
      };
    }
  }

  const { data: advisor } = await flexibleAdmin
    .from("advisor_profiles" as string)
    .select("id, full_name")
    .eq("user_id", userId)
    .maybeSingle();

  if (advisor && typeof advisor === "object") {
    const record = advisor as Record<string, unknown>;
    if (typeof record.id === "string") {
      return {
        admin,
        author: {
          advisor: record.id,
          advisorId: record.id,
          authorKind: "advisor",
          jnuitsId: null,
          memberId: null,
          name: typeof record.full_name === "string" ? record.full_name : null,
        } satisfies BlogAuthor,
      };
    }
  }

  return {
    admin,
    author: null,
  };
}

async function loadOwnedDraft(
  admin: ReturnType<typeof createAdminClient>,
  author: BlogAuthor,
  postId: string
) {
  let query = asFlexibleClient(admin)
    .from("content_posts" as string)
    .select("id, author_member_id, author_advisor_profile_id, content_type, status, title")
    .eq("id", postId)
    .eq("content_type", "blog");

  query =
    author.authorKind === "member"
      ? query.eq("author_member_id", author.memberId)
      : query.eq("author_advisor_profile_id", author.advisorId);

  const { data } = await query.maybeSingle();
  return data;
}

export async function saveMemberBlogDraft(formData: FormData) {
  const auth = await requirePortalUser({ fallbackPath: "/portal/blogs" });

  if (!auth.user) {
    redirect("/portal/login");
  }

  const { admin, author } = await loadBlogAuthor(auth.user.id);
  const flexibleAdmin = asFlexibleClient(admin);

  if (!author) {
    redirect("/portal/blogs?error=author-required");
  }

  const parsed = memberBlogDraftSchema.safeParse(
    pickFormFields(formData, [
      "postId",
      "title",
      "slug",
      "category",
      "summary",
      "excerpt",
      "body",
      "readTime",
    ])
  );

  if (!parsed.success) {
    redirect("/portal/blogs?error=draft-required");
  }

  const { body, category, excerpt, postId, readTime, summary, title } = parsed.data;
  const slug = slugify(parsed.data.slug || title);

  if (!slug) {
    redirect("/portal/blogs?error=draft-required");
  }

  if (postId) {
    const owned = await loadOwnedDraft(admin, author, postId);

    if (!owned) {
      redirect("/portal/blogs?error=draft-missing");
    }
  }

  const payload = {
    author_advisor_profile_id: author.authorKind === "advisor" ? author.advisorId : null,
    author_member_id: author.authorKind === "member" ? author.memberId : null,
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
    ? flexibleAdmin.from("content_posts" as string).update(payload).eq("id", postId).select("id").single()
    : flexibleAdmin.from("content_posts" as string).insert(payload).select("id").single();

  const { data, error } = await query;
  const postIdResult =
    data && typeof data === "object" && typeof (data as Record<string, unknown>).id === "string"
      ? String((data as Record<string, unknown>).id)
      : "";

  if (error || !postIdResult) {
    redirect("/portal/blogs?error=draft-save");
  }

  await flexibleAdmin.from("audit_events" as string).insert({
    action: postId
      ? `${author.authorKind}.blog_draft_updated`
      : `${author.authorKind}.blog_draft_created`,
    actor_user_id: auth.user.id,
    entity_id: postIdResult,
    entity_type: "content_post",
    metadata: {
      authorAdvisorProfileId: author.advisorId,
      authorMemberId: author.memberId,
      jnuitsId: author.jnuitsId,
      slug,
    },
  });

  revalidatePath("/portal/blogs");
  redirect(`/portal/blogs?message=draft-saved&edit=${postIdResult}`);
}

export async function submitMemberBlogDraft(formData: FormData) {
  const auth = await requirePortalUser({ fallbackPath: "/portal/blogs" });

  if (!auth.user) {
    redirect("/portal/login");
  }

  const { admin, author } = await loadBlogAuthor(auth.user.id);
  const flexibleAdmin = asFlexibleClient(admin);

  if (!author) {
    redirect("/portal/blogs?error=author-required");
  }

  const parsed = submitDraftSchema.safeParse(pickFormFields(formData, ["postId"]));

  if (!parsed.success) {
    redirect("/portal/blogs?error=draft-missing");
  }

  const { postId } = parsed.data;
  const owned = await loadOwnedDraft(admin, author, postId);

  if (!owned) {
    redirect("/portal/blogs?error=draft-missing");
  }

  const nowIso = new Date().toISOString();
  const { error } = await flexibleAdmin
    .from("content_posts" as string)
    .update({
      review_note: null,
      reviewed_at: null,
      reviewed_by_user_id: null,
      status: "pending_review",
      submitted_at: nowIso,
      updated_at: nowIso,
    })
    .eq("id", postId);

  if (error) {
    redirect("/portal/blogs?error=draft-submit");
  }

  await flexibleAdmin.from("audit_events" as string).insert({
    action: `${author.authorKind}.blog_draft_pending_review`,
    actor_user_id: auth.user.id,
    entity_id: postId,
    entity_type: "content_post",
    metadata: {
      authorAdvisorProfileId: author.advisorId,
      authorMemberId: author.memberId,
      jnuitsId: author.jnuitsId,
    },
  });

  if (author.authorKind === "member") {
    await admin.from("membership_lifecycle_events").insert({
      member_id: author.memberId,
      event_type: "blog_draft_pending_review",
      summary: "A member-authored blog draft entered editorial review.",
      created_by_user_id: auth.user.id,
      metadata: {
        postId,
      },
    });
  }

  await flexibleAdmin.from("blog_review_events" as string).insert({
    action: "submitted_for_review",
    note: null,
    post_id: postId,
    reviewer_user_id: auth.user.id,
  });

  revalidatePath("/portal/blogs");
  revalidatePath("/admin/content");
  redirect("/portal/blogs?message=draft-submitted");
}
