"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { setAdminFlash } from "@/lib/admin/flash";
import {
  insertAuditEvent as recordAuditEvent,
  upsertCloudinaryMediaAsset,
} from "@/lib/content/media-assets";
import type { Json } from "@/lib/db/types";
import { requireAdminUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

function asString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function asBoolean(value: FormDataEntryValue | null) {
  return typeof value === "string" && value === "true";
}

function asInteger(value: string, fallback = 0) {
  const parsed = Number.parseInt(value, 10);

  return Number.isFinite(parsed) ? parsed : fallback;
}

function asFloat(value: string) {
  const parsed = Number.parseFloat(value);

  return Number.isFinite(parsed) ? parsed : null;
}

function parseJsonField(value: string, fallback: Json) {
  if (!value) {
    return fallback;
  }

  return JSON.parse(value) as Json;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function parseDateTime(value: string) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);

  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

async function insertAuditEvent(options: {
  action: string;
  actorUserId: string;
  entityId: string;
  entityType: string;
  metadata?: Json;
}) {
  const admin = createAdminClient();

  await recordAuditEvent(admin, options);
}

export async function saveMediaAsset(formData: FormData) {
  const auth = await requireAdminUser();
  const actorUserId = auth.user?.id;

  if (!actorUserId) {
    redirect("/login");
  }

  const admin = createAdminClient();
  const assetId = asString(formData.get("assetId"));
  const altText = asString(formData.get("altText"));
  const bytes = asString(formData.get("bytes"));
  const durationSeconds = asString(formData.get("durationSeconds"));
  const format = asString(formData.get("format"));
  const height = asString(formData.get("height"));
  const isPublic = asBoolean(formData.get("isPublic"));
  const mediaKind = asString(formData.get("mediaKind"));
  const metadataJson = asString(formData.get("metadataJson"));
  const publicId = asString(formData.get("publicId"));
  const resourceType = asString(formData.get("resourceType"));
  const secureUrl = asString(formData.get("secureUrl"));
  const thumbnailUrl = asString(formData.get("thumbnailUrl"));
  const title = asString(formData.get("title"));
  const width = asString(formData.get("width"));

  if (!publicId || !secureUrl || !resourceType || !mediaKind) {
    await setAdminFlash({
      tone: "error",
      title: "Media asset not saved",
      message:
        "Cloudinary public ID, secure URL, resource type, and media kind are required.",
    });
    redirect("/admin/content");
  }

  try {
    await upsertCloudinaryMediaAsset(admin, {
      actorUserId,
      assetId: assetId || null,
      input: {
        altText,
        bytes: bytes ? asInteger(bytes) : null,
        durationSeconds: durationSeconds ? asFloat(durationSeconds) : null,
        format,
        height: height ? asInteger(height) : null,
        isPublic,
        mediaKind: mediaKind === "video" ? "video" : "image",
        metadata: parseJsonField(metadataJson, {}),
        publicId,
        resourceType,
        secureUrl,
        thumbnailUrl,
        title,
        width: width ? asInteger(width) : null,
      },
    });

    revalidatePath("/admin/content");
    await setAdminFlash({
      tone: "success",
      title: assetId ? "Media asset updated" : "Media asset registered",
      message:
        "Cloudinary media metadata is now available for public content and committee surfaces.",
    });
  } catch (error) {
    await setAdminFlash({
      tone: "error",
      title: "Media asset not saved",
      message:
        error instanceof Error
          ? error.message
          : "The Cloudinary media asset could not be registered.",
    });
  }

  redirect("/admin/content");
}

export async function saveContentPage(formData: FormData) {
  const auth = await requireAdminUser();
  const actorUserId = auth.user?.id;

  if (!actorUserId) {
    redirect("/login");
  }

  const admin = createAdminClient();
  const bodyJson = asString(formData.get("bodyJson"));
  const eyebrow = asString(formData.get("eyebrow"));
  const slug = asString(formData.get("slug"));
  const status = asString(formData.get("status")) || "draft";
  const summary = asString(formData.get("summary"));
  const title = asString(formData.get("title"));

  if (!slug || !title) {
    await setAdminFlash({
      tone: "error",
      title: "Content page not saved",
      message: "Choose a page slug and provide a title.",
    });
    redirect("/admin/content");
  }

  try {
    const { data, error } = await admin
      .from("content_pages")
      .upsert(
        {
          body: parseJsonField(bodyJson, {}),
          created_by_user_id: actorUserId,
          eyebrow: eyebrow || null,
          slug,
          status,
          summary: summary || null,
          title,
        },
        { onConflict: "slug" }
      )
      .select("id")
      .single();

    if (error || !data) {
      throw new Error(error?.message || "Unable to save the content page.");
    }

    await insertAuditEvent({
      action: "content.page_saved",
      actorUserId,
      entityId: data.id,
      entityType: "content_page",
      metadata: {
        slug,
        status,
      },
    });

    revalidatePath("/admin/content");
    if (slug === "about") {
      revalidatePath("/about");
    }
    await setAdminFlash({
      tone: "success",
      title: "Content page saved",
      message: `${slug} is now saved in the Supabase-backed public content model.`,
    });
  } catch (error) {
    await setAdminFlash({
      tone: "error",
      title: "Content page not saved",
      message:
        error instanceof Error
          ? error.message
          : "The content page could not be saved.",
    });
  }

  redirect("/admin/content");
}

export async function saveContentPost(formData: FormData) {
  const auth = await requireAdminUser();
  const actorUserId = auth.user?.id;

  if (!actorUserId) {
    redirect("/login");
  }

  const admin = createAdminClient();
  const category = asString(formData.get("category"));
  const contentType = asString(formData.get("contentType"));
  const body = asString(formData.get("body"));
  const ctaHref = asString(formData.get("ctaHref"));
  const endsAt = asString(formData.get("endsAt"));
  const excerpt = asString(formData.get("excerpt"));
  const location = asString(formData.get("location"));
  const mediaAssetId = asString(formData.get("mediaAssetId"));
  const postId = asString(formData.get("postId"));
  const publishedAt = asString(formData.get("publishedAt"));
  const readTime = asString(formData.get("readTime"));
  const slug = slugify(asString(formData.get("slug")) || asString(formData.get("title")));
  const startsAt = asString(formData.get("startsAt"));
  const status = asString(formData.get("status")) || "draft";
  const summary = asString(formData.get("summary"));
  const title = asString(formData.get("title"));

  if (!contentType || !slug || !title) {
    await setAdminFlash({
      tone: "error",
      title: "Content post not saved",
      message: "Type, slug, and title are required for public content entries.",
    });
    redirect("/admin/content");
  }

  try {
    const payload = {
      body: body || null,
      category: category || null,
      content_type: contentType,
      created_by_user_id: actorUserId,
      cta_href: ctaHref || null,
      ends_at: endsAt || null,
      excerpt: excerpt || null,
      location: location || null,
      media_asset_id: mediaAssetId || null,
      published_at: publishedAt || null,
      read_time: readTime || null,
      slug,
      starts_at: startsAt || null,
      status,
      summary: summary || null,
      title,
    };

    const query = postId
      ? admin.from("content_posts").update(payload).eq("id", postId).select("id").single()
      : admin.from("content_posts").insert(payload).select("id").single();

    const { data, error } = await query;

    if (error || !data) {
      throw new Error(error?.message || "Unable to save the content post.");
    }

    await insertAuditEvent({
      action: postId ? "content.post_updated" : "content.post_created",
      actorUserId,
      entityId: data.id,
      entityType: "content_post",
      metadata: {
        contentType,
        slug,
        status,
      },
    });

    revalidatePath("/admin/content");
    if (contentType === "blog") {
      revalidatePath("/blogs");
    }
    if (contentType === "event") {
      revalidatePath("/events");
    }
    if (contentType === "notice") {
      revalidatePath("/notices");
    }
    await setAdminFlash({
      tone: "success",
      title: "Content post saved",
      message: `${title} is now part of the Supabase-backed public collection.`,
    });
  } catch (error) {
    await setAdminFlash({
      tone: "error",
      title: "Content post not saved",
      message:
        error instanceof Error
          ? error.message
          : "The public content entry could not be saved.",
    });
  }

  redirect("/admin/content");
}

async function loadSubmittedBlog(
  admin: ReturnType<typeof createAdminClient>,
  postId: string
) {
  const { data } = await admin
    .from("content_posts")
    .select("id, author_member_id, content_type, slug, status, title")
    .eq("id", postId)
    .eq("content_type", "blog")
    .maybeSingle();

  return data;
}

export async function publishMemberBlogSubmission(formData: FormData) {
  const auth = await requireAdminUser();
  const actorUserId = auth.user?.id;

  if (!actorUserId) {
    redirect("/login");
  }

  const admin = createAdminClient();
  const postId = asString(formData.get("postId"));
  const publishedAt = parseDateTime(asString(formData.get("publishedAt")));
  const reviewNote = asString(formData.get("reviewNote"));

  if (!postId) {
    await setAdminFlash({
      tone: "error",
      title: "Blog review failed",
      message: "The member blog identifier is missing.",
    });
    redirect("/admin/content");
  }

  const post = await loadSubmittedBlog(admin, postId);

  if (!post) {
    await setAdminFlash({
      tone: "error",
      title: "Blog review failed",
      message: "The submitted member draft could not be found.",
    });
    redirect("/admin/content");
  }

  if (post.status !== "submitted") {
    await setAdminFlash({
      tone: "error",
      title: "Blog review failed",
      message: "Only submitted member drafts can be published from this queue.",
    });
    redirect("/admin/content");
  }

  const reviewTimestamp = new Date().toISOString();
  const { error } = await admin
    .from("content_posts")
    .update({
      published_at: publishedAt || reviewTimestamp,
      review_note: reviewNote || null,
      reviewed_at: reviewTimestamp,
      reviewed_by_user_id: actorUserId,
      status: "published",
      updated_at: reviewTimestamp,
    })
    .eq("id", postId);

  if (error) {
    await setAdminFlash({
      tone: "error",
      title: "Blog review failed",
      message: error.message,
    });
    redirect("/admin/content");
  }

  if (post.author_member_id) {
    await admin.from("membership_lifecycle_events").insert({
      member_id: post.author_member_id,
      event_type: "blog_draft_published",
      summary: "A member-authored blog draft was published.",
      created_by_user_id: actorUserId,
      metadata: {
        postId,
        slug: post.slug,
      },
    });
  }

  await insertAuditEvent({
    action: "content.member_blog_published",
    actorUserId,
    entityId: postId,
    entityType: "content_post",
    metadata: {
      authorMemberId: post.author_member_id,
      slug: post.slug,
    },
  });

  revalidatePath("/admin/content");
  revalidatePath("/blogs");
  revalidatePath("/portal/blogs");
  await setAdminFlash({
    tone: "success",
    title: "Member blog published",
    message: `${post.title} is now live on the public blog route.`,
  });
  redirect("/admin/content");
}

export async function returnMemberBlogSubmission(formData: FormData) {
  const auth = await requireAdminUser();
  const actorUserId = auth.user?.id;

  if (!actorUserId) {
    redirect("/login");
  }

  const admin = createAdminClient();
  const postId = asString(formData.get("postId"));
  const reviewNote = asString(formData.get("reviewNote"));

  if (!postId) {
    await setAdminFlash({
      tone: "error",
      title: "Blog review failed",
      message: "The member blog identifier is missing.",
    });
    redirect("/admin/content");
  }

  const post = await loadSubmittedBlog(admin, postId);

  if (!post) {
    await setAdminFlash({
      tone: "error",
      title: "Blog review failed",
      message: "The submitted member draft could not be found.",
    });
    redirect("/admin/content");
  }

  const reviewTimestamp = new Date().toISOString();
  const { error } = await admin
    .from("content_posts")
    .update({
      review_note: reviewNote || "Returned to the author for revision.",
      reviewed_at: reviewTimestamp,
      reviewed_by_user_id: actorUserId,
      status: "draft",
      updated_at: reviewTimestamp,
    })
    .eq("id", postId);

  if (error) {
    await setAdminFlash({
      tone: "error",
      title: "Blog review failed",
      message: error.message,
    });
    redirect("/admin/content");
  }

  if (post.author_member_id) {
    await admin.from("membership_lifecycle_events").insert({
      member_id: post.author_member_id,
      event_type: "blog_draft_returned",
      summary: "A member-authored blog draft was returned for revision.",
      created_by_user_id: actorUserId,
      metadata: {
        postId,
        slug: post.slug,
      },
    });
  }

  await insertAuditEvent({
    action: "content.member_blog_returned",
    actorUserId,
    entityId: postId,
    entityType: "content_post",
    metadata: {
      authorMemberId: post.author_member_id,
      slug: post.slug,
    },
  });

  revalidatePath("/admin/content");
  revalidatePath("/portal/blogs");
  await setAdminFlash({
    tone: "success",
    title: "Member blog returned",
    message: `${post.title} is back in the author's draft queue with your review note.`,
  });
  redirect("/admin/content");
}

export async function saveGalleryEntry(formData: FormData) {
  const auth = await requireAdminUser();
  const actorUserId = auth.user?.id;

  if (!actorUserId) {
    redirect("/login");
  }

  const admin = createAdminClient();
  const caption = asString(formData.get("caption"));
  const entryId = asString(formData.get("entryId"));
  const mediaAssetId = asString(formData.get("mediaAssetId"));
  const sortOrder =
    Number.parseInt(asString(formData.get("sortOrder")) || "100", 10) || 100;
  const status = asString(formData.get("status")) || "draft";
  const title = asString(formData.get("title"));

  if (!title || !mediaAssetId) {
    await setAdminFlash({
      tone: "error",
      title: "Gallery entry not saved",
      message: "Title and media asset are required for the gallery.",
    });
    redirect("/admin/content");
  }

  try {
    const payload = {
      caption: caption || null,
      created_by_user_id: actorUserId,
      media_asset_id: mediaAssetId,
      sort_order: sortOrder,
      status,
      title,
    };

    const query = entryId
      ? admin.from("gallery_entries").update(payload).eq("id", entryId).select("id").single()
      : admin.from("gallery_entries").insert(payload).select("id").single();

    const { data, error } = await query;

    if (error || !data) {
      throw new Error(error?.message || "Unable to save the gallery entry.");
    }

    await insertAuditEvent({
      action: entryId ? "content.gallery_entry_updated" : "content.gallery_entry_created",
      actorUserId,
      entityId: data.id,
      entityType: "gallery_entry",
      metadata: {
        mediaAssetId,
        status,
      },
    });

    revalidatePath("/admin/content");
    revalidatePath("/gallery");
    await setAdminFlash({
      tone: "success",
      title: "Gallery entry saved",
      message: `${title} is now part of the Cloudinary-backed gallery registry.`,
    });
  } catch (error) {
    await setAdminFlash({
      tone: "error",
      title: "Gallery entry not saved",
      message:
        error instanceof Error
          ? error.message
          : "The gallery entry could not be saved.",
    });
  }

  redirect("/admin/content");
}

export async function saveDeveloperProfile(formData: FormData) {
  const auth = await requireAdminUser();
  const actorUserId = auth.user?.id;

  if (!actorUserId) {
    redirect("/login");
  }

  const admin = createAdminClient();
  const bio = asString(formData.get("bio"));
  const focus = asString(formData.get("focus"));
  const isLead = asBoolean(formData.get("isLead"));
  const mediaAssetId = asString(formData.get("mediaAssetId"));
  const name = asString(formData.get("name"));
  const profileId = asString(formData.get("profileId"));
  const role = asString(formData.get("role"));
  const sortOrder =
    Number.parseInt(asString(formData.get("sortOrder")) || "100", 10) || 100;
  const status = asString(formData.get("status")) || "draft";

  if (!name || !role || !focus || !bio) {
    await setAdminFlash({
      tone: "error",
      title: "Developer profile not saved",
      message: "Name, role, focus, and bio are required.",
    });
    redirect("/admin/content");
  }

  try {
    const payload = {
      bio,
      created_by_user_id: actorUserId,
      focus,
      is_lead: isLead,
      media_asset_id: mediaAssetId || null,
      name,
      role,
      sort_order: sortOrder,
      status,
    };

    const query = profileId
      ? admin
          .from("developer_profiles")
          .update(payload)
          .eq("id", profileId)
          .select("id")
          .single()
      : admin.from("developer_profiles").insert(payload).select("id").single();

    const { data, error } = await query;

    if (error || !data) {
      throw new Error(error?.message || "Unable to save the developer profile.");
    }

    await insertAuditEvent({
      action: profileId
        ? "content.developer_profile_updated"
        : "content.developer_profile_created",
      actorUserId,
      entityId: data.id,
      entityType: "developer_profile",
      metadata: {
        isLead,
        status,
      },
    });

    revalidatePath("/admin/content");
    revalidatePath("/developers");
    await setAdminFlash({
      tone: "success",
      title: "Developer profile saved",
      message: `${name} is now available in the public developer registry.`,
    });
  } catch (error) {
    await setAdminFlash({
      tone: "error",
      title: "Developer profile not saved",
      message:
        error instanceof Error
          ? error.message
          : "The developer profile could not be saved.",
    });
  }

  redirect("/admin/content");
}

// ── Project Showcase Actions ────────────────────────────────────────────────

function parseDate(value: string) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : value;
}

export async function createProject(formData: FormData) {
  const auth = await requireAdminUser();
  const actorUserId = auth.user?.id;
  if (!actorUserId) redirect("/login");

  const admin = createAdminClient();
  const title = asString(formData.get("title"));
  const tagline = asString(formData.get("tagline"));
  const description = asString(formData.get("description"));
  const category = asString(formData.get("category")) || "other";
  const status = asString(formData.get("status")) || "active";
  const techStackRaw = asString(formData.get("techStack"));
  const techStack = techStackRaw
    ? techStackRaw.split(",").map((t) => t.trim()).filter(Boolean)
    : [];
  const githubUrl = asString(formData.get("githubUrl"));
  const demoUrl = asString(formData.get("demoUrl"));
  const coverImageUrl = asString(formData.get("coverImageUrl"));
  const startedAt = parseDate(asString(formData.get("startedAt")));
  const completedAt = parseDate(asString(formData.get("completedAt")));
  const isFeatured = asBoolean(formData.get("isFeatured"));
  const inputSlug = asString(formData.get("slug"));
  const slug = slugify(inputSlug || title);

  if (!title || !slug) {
    await setAdminFlash({ tone: "error", title: "Project not saved", message: "Title is required." });
    redirect("/admin/content");
  }

  try {
    const { data, error } = await admin
      .from("projects")
      .insert({
        category,
        completed_at: completedAt,
        cover_image_url: coverImageUrl || null,
        created_by_user_id: actorUserId,
        demo_url: demoUrl || null,
        description: description || "",
        github_url: githubUrl || null,
        is_featured: isFeatured,
        slug,
        started_at: startedAt,
        status,
        tagline: tagline || null,
        tech_stack: techStack,
        title,
      })
      .select("id")
      .single();

    if (error || !data) throw new Error(error?.message || "Unable to create project.");

    await insertAuditEvent({
      action: "content.project_created",
      actorUserId,
      entityId: data.id,
      entityType: "project",
      metadata: { slug, status, category } as Json,
    });

    revalidatePath("/admin/content");
    revalidatePath("/projects");
    await setAdminFlash({ tone: "success", title: "Project created", message: `${title} is now in the project showcase.` });
  } catch (err) {
    await setAdminFlash({
      tone: "error",
      title: "Project not saved",
      message: err instanceof Error ? err.message : "The project could not be created.",
    });
  }

  redirect("/admin/content");
}

export async function updateProject(formData: FormData) {
  const auth = await requireAdminUser();
  const actorUserId = auth.user?.id;
  if (!actorUserId) redirect("/login");

  const admin = createAdminClient();
  const projectId = asString(formData.get("projectId"));
  const title = asString(formData.get("title"));
  const tagline = asString(formData.get("tagline"));
  const description = asString(formData.get("description"));
  const category = asString(formData.get("category")) || "other";
  const status = asString(formData.get("status")) || "active";
  const techStackRaw = asString(formData.get("techStack"));
  const techStack = techStackRaw
    ? techStackRaw.split(",").map((t) => t.trim()).filter(Boolean)
    : [];
  const githubUrl = asString(formData.get("githubUrl"));
  const demoUrl = asString(formData.get("demoUrl"));
  const coverImageUrl = asString(formData.get("coverImageUrl"));
  const startedAt = parseDate(asString(formData.get("startedAt")));
  const completedAt = parseDate(asString(formData.get("completedAt")));
  const isFeatured = asBoolean(formData.get("isFeatured"));

  if (!projectId || !title) {
    await setAdminFlash({ tone: "error", title: "Project not updated", message: "Project ID and title are required." });
    redirect("/admin/content");
  }

  try {
    const { error } = await admin
      .from("projects")
      .update({
        category,
        completed_at: completedAt,
        cover_image_url: coverImageUrl || null,
        demo_url: demoUrl || null,
        description: description || "",
        github_url: githubUrl || null,
        is_featured: isFeatured,
        started_at: startedAt,
        status,
        tagline: tagline || null,
        tech_stack: techStack,
        title,
        updated_at: new Date().toISOString(),
      })
      .eq("id", projectId);

    if (error) throw new Error(error.message);

    await insertAuditEvent({
      action: "content.project_updated",
      actorUserId,
      entityId: projectId,
      entityType: "project",
      metadata: { status, category } as Json,
    });

    revalidatePath("/admin/content");
    revalidatePath("/projects");
    await setAdminFlash({ tone: "success", title: "Project updated", message: `${title} has been updated.` });
  } catch (err) {
    await setAdminFlash({
      tone: "error",
      title: "Project not updated",
      message: err instanceof Error ? err.message : "The project could not be updated.",
    });
  }

  redirect("/admin/content");
}

export async function deleteProject(formData: FormData) {
  const auth = await requireAdminUser();
  const actorUserId = auth.user?.id;
  if (!actorUserId) redirect("/login");

  const admin = createAdminClient();
  const projectId = asString(formData.get("projectId"));

  if (!projectId) {
    await setAdminFlash({ tone: "error", title: "Delete failed", message: "Project ID is missing." });
    redirect("/admin/content");
  }

  try {
    const { error } = await admin.from("projects").delete().eq("id", projectId);
    if (error) throw new Error(error.message);

    await insertAuditEvent({
      action: "content.project_deleted",
      actorUserId,
      entityId: projectId,
      entityType: "project",
      metadata: {} as Json,
    });

    revalidatePath("/admin/content");
    revalidatePath("/projects");
    await setAdminFlash({ tone: "success", title: "Project deleted", message: "The project has been removed from the showcase." });
  } catch (err) {
    await setAdminFlash({
      tone: "error",
      title: "Delete failed",
      message: err instanceof Error ? err.message : "The project could not be deleted.",
    });
  }

  redirect("/admin/content");
}

export async function addProjectContributor(formData: FormData) {
  const auth = await requireAdminUser();
  const actorUserId = auth.user?.id;
  if (!actorUserId) redirect("/login");

  const admin = createAdminClient();
  const projectId = asString(formData.get("projectId"));
  const jnuitsId = asString(formData.get("jnuitsId")).toUpperCase();
  const role = asString(formData.get("role")) || "contributor";
  const joinedAt = parseDate(asString(formData.get("joinedAt")));

  if (!projectId || !jnuitsId) {
    await setAdminFlash({ tone: "error", title: "Contributor not added", message: "Project ID and JnUITS ID are required." });
    redirect("/admin/content");
  }

  try {
    const { data: member, error: memberError } = await admin
      .from("members")
      .select("id")
      .eq("jnuits_id", jnuitsId)
      .maybeSingle();

    if (memberError || !member) {
      await setAdminFlash({ tone: "error", title: "Contributor not added", message: `No member found with JnUITS ID: ${jnuitsId}.` });
      redirect("/admin/content");
    }

    const { error } = await admin.from("project_contributors").insert({
      joined_at: joinedAt,
      member_id: member.id,
      project_id: projectId,
      role,
    });

    if (error) throw new Error(error.message);

    revalidatePath("/admin/content");
    revalidatePath("/projects");
    await setAdminFlash({ tone: "success", title: "Contributor added", message: `${jnuitsId} has been added as ${role}.` });
  } catch (err) {
    await setAdminFlash({
      tone: "error",
      title: "Contributor not added",
      message: err instanceof Error ? err.message : "The contributor could not be added.",
    });
  }

  redirect("/admin/content");
}

export async function removeProjectContributor(formData: FormData) {
  const auth = await requireAdminUser();
  const actorUserId = auth.user?.id;
  if (!actorUserId) redirect("/login");

  const admin = createAdminClient();
  const contributorId = asString(formData.get("contributorId"));

  if (!contributorId) {
    await setAdminFlash({ tone: "error", title: "Remove failed", message: "Contributor record ID is missing." });
    redirect("/admin/content");
  }

  try {
    const { error } = await admin.from("project_contributors").delete().eq("id", contributorId);
    if (error) throw new Error(error.message);

    revalidatePath("/admin/content");
    revalidatePath("/projects");
    await setAdminFlash({ tone: "success", title: "Contributor removed", message: "The contributor has been removed from this project." });
  } catch (err) {
    await setAdminFlash({
      tone: "error",
      title: "Remove failed",
      message: err instanceof Error ? err.message : "The contributor could not be removed.",
    });
  }

  redirect("/admin/content");
}
