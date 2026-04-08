"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { setAdminFlash } from "@/lib/admin/flash";
import { isCloudinaryAssetUrl } from "@/lib/cloudinary/config";
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

async function insertAuditEvent(options: {
  action: string;
  actorUserId: string;
  entityId: string;
  entityType: string;
  metadata?: Json;
}) {
  const admin = createAdminClient();

  await admin.from("audit_events").insert({
    action: options.action,
    actor_user_id: options.actorUserId,
    entity_id: options.entityId,
    entity_type: options.entityType,
    metadata: options.metadata || {},
  });
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

  if (!isCloudinaryAssetUrl(secureUrl)) {
    await setAdminFlash({
      tone: "error",
      title: "Media asset not saved",
      message: "Use a Cloudinary delivery URL for secure_url.",
    });
    redirect("/admin/content");
  }

  try {
    const payload = {
      alt_text: altText || null,
      bytes: bytes ? asInteger(bytes) : null,
      created_by_user_id: actorUserId,
      duration_seconds: durationSeconds ? asFloat(durationSeconds) : null,
      format: format || null,
      height: height ? asInteger(height) : null,
      is_public: isPublic,
      media_kind: mediaKind,
      metadata: parseJsonField(metadataJson, {}),
      provider: "cloudinary",
      public_id: publicId,
      resource_type: resourceType,
      secure_url: secureUrl,
      thumbnail_url: thumbnailUrl || null,
      title: title || null,
      width: width ? asInteger(width) : null,
    };

    const query = assetId
      ? admin.from("media_assets").update(payload).eq("id", assetId).select("id").single()
      : admin.from("media_assets").insert(payload).select("id").single();

    const { data, error } = await query;

    if (error || !data) {
      throw new Error(error?.message || "Unable to save the Cloudinary asset.");
    }

    await insertAuditEvent({
      action: assetId ? "content.media_asset_updated" : "content.media_asset_created",
      actorUserId,
      entityId: data.id,
      entityType: "media_asset",
      metadata: {
        isPublic,
        mediaKind,
        publicId,
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
