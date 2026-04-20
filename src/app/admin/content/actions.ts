"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

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

const booleanStringSchema = z
  .enum(["true", "false"])
  .optional()
  .default("false")
  .transform((value) => value === "true");
const optionalInteger = (fallback: number, max = 1000000000) =>
  z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.coerce.number().int().min(0).max(max).optional().default(fallback)
  );
const optionalText = (max: number) => z.string().trim().max(max).optional().default("");

const mediaAssetFormSchema = z.object({
  altText: optionalText(300),
  assetId: optionalText(80),
  bytes: optionalInteger(0).optional(),
  durationSeconds: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.coerce.number().nonnegative().optional()
  ),
  format: optionalText(40),
  height: optionalInteger(0, 100000),
  isPublic: booleanStringSchema,
  mediaKind: z.enum(["image", "video"]),
  metadataJson: optionalText(50000),
  publicId: z.string().trim().min(1, "Cloudinary public ID is required.").max(300),
  resourceType: z.string().trim().min(1, "Resource type is required.").max(80),
  secureUrl: z.string().trim().url("Secure URL must be valid.").max(1000),
  thumbnailUrl: z.string().trim().url().optional().or(z.literal("")),
  title: optionalText(180),
  width: optionalInteger(0, 100000),
});

const contentPageFormSchema = z.object({
  bodyJson: optionalText(500000),
  eyebrow: optionalText(120),
  slug: z.string().trim().min(1, "Choose a page slug.").max(120),
  status: optionalText(40).default("draft"),
  summary: optionalText(1000),
  title: z.string().trim().min(1, "Provide a title.").max(180),
});

const contentPostFormSchema = z.object({
  body: optionalText(100000),
  category: optionalText(80),
  contentType: z.string().trim().min(1, "Type is required.").max(40),
  ctaHref: optionalText(1000),
  endsAt: optionalText(80),
  excerpt: optionalText(1000),
  location: optionalText(180),
  mediaAssetId: optionalText(80),
  postId: optionalText(80),
  publishedAt: optionalText(80),
  readTime: optionalText(40),
  slug: optionalText(180),
  startsAt: optionalText(80),
  status: optionalText(40).default("draft"),
  summary: optionalText(1000),
  title: z.string().trim().min(1, "Title is required.").max(220),
});

const blogReviewFormSchema = z.object({
  postId: z.string().trim().min(1, "The member blog identifier is missing.").max(80),
  publishedAt: optionalText(80),
  reviewNote: optionalText(1500),
});

const galleryEntryFormSchema = z.object({
  caption: optionalText(1000),
  entryId: optionalText(80),
  mediaAssetId: z.string().trim().min(1, "Media asset is required.").max(80),
  sortOrder: optionalInteger(100, 9999),
  status: optionalText(40).default("draft"),
  title: z.string().trim().min(1, "Title is required.").max(180),
});

const developerProfileFormSchema = z.object({
  bio: z.string().trim().min(1, "Bio is required.").max(3000),
  focus: z.string().trim().min(1, "Focus is required.").max(180),
  isLead: booleanStringSchema,
  mediaAssetId: optionalText(80),
  name: z.string().trim().min(1, "Name is required.").max(180),
  profileId: optionalText(80),
  role: z.string().trim().min(1, "Role is required.").max(180),
  sortOrder: optionalInteger(100, 9999),
  status: optionalText(40).default("draft"),
});

const projectFormSchema = z.object({
  category: optionalText(80).default("other"),
  completedAt: optionalText(80),
  coverImageUrl: optionalText(1000),
  demoUrl: optionalText(1000),
  description: optionalText(10000),
  githubUrl: optionalText(1000),
  isFeatured: booleanStringSchema,
  slug: optionalText(180),
  startedAt: optionalText(80),
  status: optionalText(40).default("active"),
  tagline: optionalText(300),
  techStack: optionalText(1000),
  title: z.string().trim().min(1, "Title is required.").max(180),
});

const updateProjectFormSchema = projectFormSchema.extend({
  projectId: z.string().trim().min(1, "Project ID is required.").max(80),
});

const deleteProjectFormSchema = z.object({
  projectId: z.string().trim().min(1, "Project ID is missing.").max(80),
});

const projectContributorFormSchema = z.object({
  joinedAt: optionalText(80),
  jnuitsId: z.string().trim().min(1, "JnUITS ID is required.").max(80).transform((value) => value.toUpperCase()),
  projectId: z.string().trim().min(1, "Project ID is required.").max(80),
  role: optionalText(120).default("contributor"),
});

const removeContributorFormSchema = z.object({
  contributorId: z.string().trim().min(1, "Contributor record ID is missing.").max(80),
});

function pickFormFields(formData: FormData, fields: string[]) {
  return Object.fromEntries(
    fields.map((field) => [field, asString(formData.get(field))])
  );
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
  const parsed = mediaAssetFormSchema.safeParse(
    pickFormFields(formData, [
      "assetId",
      "altText",
      "bytes",
      "durationSeconds",
      "format",
      "height",
      "isPublic",
      "mediaKind",
      "metadataJson",
      "publicId",
      "resourceType",
      "secureUrl",
      "thumbnailUrl",
      "title",
      "width",
    ])
  );

  if (!parsed.success) {
    await setAdminFlash({
      tone: "error",
      title: "Media asset not saved",
      message:
        parsed.error.issues[0]?.message ||
        "Cloudinary public ID, secure URL, resource type, and media kind are required.",
    });
    redirect("/admin/content/media");
  }

  const {
    altText,
    assetId,
    bytes,
    durationSeconds,
    format,
    height,
    isPublic,
    mediaKind,
    metadataJson,
    publicId,
    resourceType,
    secureUrl,
    thumbnailUrl,
    title,
    width,
  } = parsed.data;

  try {
    await upsertCloudinaryMediaAsset(admin, {
      actorUserId,
      assetId: assetId || null,
      input: {
        altText,
        bytes: bytes || null,
        durationSeconds: durationSeconds ?? null,
        format,
        height: height || null,
        isPublic,
        mediaKind,
        metadata: parseJsonField(metadataJson, {}),
        publicId,
        resourceType,
        secureUrl,
        thumbnailUrl,
        title,
        width: width || null,
      },
    });

    revalidatePath("/admin/content");
    revalidatePath("/admin/content/media");
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

  redirect("/admin/content/media");
}

export async function saveContentPage(formData: FormData) {
  const auth = await requireAdminUser();
  const actorUserId = auth.user?.id;

  if (!actorUserId) {
    redirect("/login");
  }

  const admin = createAdminClient();
  const parsed = contentPageFormSchema.safeParse(
    pickFormFields(formData, ["bodyJson", "eyebrow", "slug", "status", "summary", "title"])
  );

  if (!parsed.success) {
    await setAdminFlash({
      tone: "error",
      title: "Content page not saved",
      message: parsed.error.issues[0]?.message || "Choose a page slug and provide a title.",
    });
    redirect("/admin/content");
  }

  const { bodyJson, eyebrow, slug, status, summary, title } = parsed.data;

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
  const parsed = contentPostFormSchema.safeParse(
    pickFormFields(formData, [
      "category",
      "contentType",
      "body",
      "ctaHref",
      "endsAt",
      "excerpt",
      "location",
      "mediaAssetId",
      "postId",
      "publishedAt",
      "readTime",
      "slug",
      "startsAt",
      "status",
      "summary",
      "title",
    ])
  );

  if (!parsed.success) {
    await setAdminFlash({
      tone: "error",
      title: "Content post not saved",
      message:
        parsed.error.issues[0]?.message ||
        "Type, slug, and title are required for public content entries.",
    });
    redirect("/admin/content");
  }

  const {
    body,
    category,
    contentType,
    ctaHref,
    endsAt,
    excerpt,
    location,
    mediaAssetId,
    postId,
    publishedAt,
    readTime,
    startsAt,
    status,
    summary,
    title,
  } = parsed.data;
  const slug = slugify(parsed.data.slug || title);

  if (!slug) {
    await setAdminFlash({
      tone: "error",
      title: "Content post not saved",
      message: "Title or slug must produce a valid public slug.",
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
  const parsed = blogReviewFormSchema.safeParse(
    pickFormFields(formData, ["postId", "publishedAt", "reviewNote"])
  );

  if (!parsed.success) {
    await setAdminFlash({
      tone: "error",
      title: "Blog review failed",
      message:
        parsed.error.issues[0]?.message ||
        "The member blog identifier is missing.",
    });
    redirect("/admin/content");
  }

  const { postId, reviewNote } = parsed.data;
  const publishedAt = parseDateTime(parsed.data.publishedAt);

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
  const parsed = blogReviewFormSchema.safeParse(
    pickFormFields(formData, ["postId", "publishedAt", "reviewNote"])
  );

  if (!parsed.success) {
    await setAdminFlash({
      tone: "error",
      title: "Blog review failed",
      message:
        parsed.error.issues[0]?.message ||
        "The member blog identifier is missing.",
    });
    redirect("/admin/content");
  }

  const { postId, reviewNote } = parsed.data;

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
  const parsed = galleryEntryFormSchema.safeParse(
    pickFormFields(formData, [
      "caption",
      "entryId",
      "mediaAssetId",
      "sortOrder",
      "status",
      "title",
    ])
  );

  if (!parsed.success) {
    await setAdminFlash({
      tone: "error",
      title: "Gallery entry not saved",
      message:
        parsed.error.issues[0]?.message ||
        "Title and media asset are required for the gallery.",
    });
    redirect("/admin/content");
  }

  const { caption, entryId, mediaAssetId, sortOrder, status, title } = parsed.data;

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
  const parsed = developerProfileFormSchema.safeParse(
    pickFormFields(formData, [
      "bio",
      "focus",
      "isLead",
      "mediaAssetId",
      "name",
      "profileId",
      "role",
      "sortOrder",
      "status",
    ])
  );

  if (!parsed.success) {
    await setAdminFlash({
      tone: "error",
      title: "Developer profile not saved",
      message:
        parsed.error.issues[0]?.message ||
        "Name, role, focus, and bio are required.",
    });
    redirect("/admin/content");
  }

  const {
    bio,
    focus,
    isLead,
    mediaAssetId,
    name,
    profileId,
    role,
    sortOrder,
    status,
  } = parsed.data;

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
  const parsed = projectFormSchema.safeParse(
    pickFormFields(formData, [
      "title",
      "tagline",
      "description",
      "category",
      "status",
      "techStack",
      "githubUrl",
      "demoUrl",
      "coverImageUrl",
      "startedAt",
      "completedAt",
      "isFeatured",
      "slug",
    ])
  );

  if (!parsed.success) {
    await setAdminFlash({
      tone: "error",
      title: "Project not saved",
      message: parsed.error.issues[0]?.message || "Title is required.",
    });
    redirect("/admin/content");
  }

  const {
    category,
    completedAt: completedAtRaw,
    coverImageUrl,
    demoUrl,
    description,
    githubUrl,
    isFeatured,
    startedAt: startedAtRaw,
    status,
    tagline,
    title,
  } = parsed.data;
  const techStackRaw = parsed.data.techStack;
  const techStack = techStackRaw
    ? techStackRaw.split(",").map((t) => t.trim()).filter(Boolean)
    : [];
  const startedAt = parseDate(startedAtRaw);
  const completedAt = parseDate(completedAtRaw);
  const inputSlug = parsed.data.slug;
  const slug = slugify(inputSlug || title);

  if (!slug) {
    await setAdminFlash({ tone: "error", title: "Project not saved", message: "Title or slug must produce a valid public slug." });
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
  const parsed = updateProjectFormSchema.safeParse(
    pickFormFields(formData, [
      "projectId",
      "title",
      "tagline",
      "description",
      "category",
      "status",
      "techStack",
      "githubUrl",
      "demoUrl",
      "coverImageUrl",
      "startedAt",
      "completedAt",
      "isFeatured",
      "slug",
    ])
  );

  if (!parsed.success) {
    await setAdminFlash({
      tone: "error",
      title: "Project not updated",
      message:
        parsed.error.issues[0]?.message ||
        "Project ID and title are required.",
    });
    redirect("/admin/content");
  }

  const {
    category,
    completedAt: completedAtRaw,
    coverImageUrl,
    demoUrl,
    description,
    githubUrl,
    isFeatured,
    projectId,
    startedAt: startedAtRaw,
    status,
    tagline,
    title,
  } = parsed.data;
  const techStackRaw = parsed.data.techStack;
  const techStack = techStackRaw
    ? techStackRaw.split(",").map((t) => t.trim()).filter(Boolean)
    : [];
  const startedAt = parseDate(startedAtRaw);
  const completedAt = parseDate(completedAtRaw);

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
  const parsed = deleteProjectFormSchema.safeParse(
    pickFormFields(formData, ["projectId"])
  );

  if (!parsed.success) {
    await setAdminFlash({
      tone: "error",
      title: "Delete failed",
      message: parsed.error.issues[0]?.message || "Project ID is missing.",
    });
    redirect("/admin/content");
  }

  const { projectId } = parsed.data;

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
  const parsed = projectContributorFormSchema.safeParse(
    pickFormFields(formData, ["projectId", "jnuitsId", "role", "joinedAt"])
  );

  if (!parsed.success) {
    await setAdminFlash({
      tone: "error",
      title: "Contributor not added",
      message:
        parsed.error.issues[0]?.message ||
        "Project ID and JnUITS ID are required.",
    });
    redirect("/admin/content");
  }

  const { jnuitsId, projectId, role } = parsed.data;
  const joinedAt = parseDate(parsed.data.joinedAt);

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
  const parsed = removeContributorFormSchema.safeParse(
    pickFormFields(formData, ["contributorId"])
  );

  if (!parsed.success) {
    await setAdminFlash({
      tone: "error",
      title: "Remove failed",
      message:
        parsed.error.issues[0]?.message ||
        "Contributor record ID is missing.",
    });
    redirect("/admin/content");
  }

  const { contributorId } = parsed.data;

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
