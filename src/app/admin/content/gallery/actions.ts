"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { setAdminFlash } from "@/lib/admin/flash";
import { requireAdminUser } from "@/lib/auth/session";
import { insertAuditEvent } from "@/lib/content/media-assets";
import type { Json } from "@/lib/db/types";
import { createAdminClient } from "@/lib/supabase/admin";

const statusSchema = z.enum(["draft", "published", "archived"]);
const optionalText = (max: number) => z.string().trim().max(max).optional().default("");
const optionalInteger = (fallback: number, max = 1000000) =>
  z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.coerce.number().int().min(0).max(max).optional().default(fallback)
  );

const booleanStringSchema = z
  .enum(["true", "false"])
  .optional()
  .default("false")
  .transform((value) => value === "true");

const albumFormSchema = z.object({
  albumId: optionalText(80),
  category: z.string().trim().min(1, "Choose a category.").max(80),
  cloudinaryFolder: optionalText(220),
  description: optionalText(8000),
  endsOn: optionalText(40),
  eventName: optionalText(220),
  featured: booleanStringSchema,
  month: optionalInteger(0, 12),
  slug: optionalText(160),
  startsOn: optionalText(40),
  status: statusSchema.default("draft"),
  title: z.string().trim().min(1, "Album title is required.").max(220),
  year: z.coerce.number().int().min(2015).max(2100),
});

const albumLifecycleSchema = z.object({
  albumId: z.string().trim().min(1),
  intent: z.enum(["archive", "delete", "publish", "restore"]),
});

const itemFormSchema = z.object({
  albumId: z.string().trim().min(1),
  altText: optionalText(300),
  description: optionalText(3000),
  isCover: booleanStringSchema,
  itemId: z.string().trim().min(1),
  sortOrder: optionalInteger(100, 100000),
  status: statusSchema.default("published"),
  title: optionalText(220),
});

const bulkItemSchema = z.object({
  albumId: z.string().trim().min(1),
  intent: z.enum(["archive", "delete", "publish", "remove", "restore"]),
  itemIds: z.array(z.string().trim().min(1)).min(1, "Select at least one image."),
});

const reorderSchema = z.object({
  albumId: z.string().trim().min(1),
  itemIds: z.array(z.string().trim().min(1)).min(1, "No images were provided."),
});

function asString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function pickFormFields(formData: FormData, fields: string[]) {
  return Object.fromEntries(fields.map((field) => [field, asString(formData.get(field))]));
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 140);
}

function nullableDate(value: string) {
  return value || null;
}

function restorableUntil() {
  return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
}

async function getActorUserId() {
  const auth = await requireAdminUser();
  const actorUserId = auth.user?.id;

  if (!actorUserId) {
    redirect("/login");
  }

  return actorUserId;
}

async function audit(options: {
  action: string;
  actorUserId: string;
  entityId: string;
  entityType: string;
  metadata?: Json;
}) {
  await insertAuditEvent(createAdminClient(), options);
}

function revalidateGallery(options: { albumId?: string; albumSlug?: string } = {}) {
  revalidatePath("/gallery");
  revalidatePath("/admin/content/gallery");

  if (options.albumId) {
    revalidatePath(`/admin/content/gallery/${options.albumId}`);
  }

  if (options.albumSlug) {
    revalidatePath(`/gallery/${options.albumSlug}`);
  }
}

async function getAlbumForAction(
  admin: ReturnType<typeof createAdminClient>,
  albumId: string
) {
  const { data } = await admin
    .from("gallery_albums")
    .select("id, slug, title, cover_item_id")
    .eq("id", albumId)
    .maybeSingle();

  return data;
}

async function getAlbumItemForAction(
  admin: ReturnType<typeof createAdminClient>,
  albumId: string,
  itemId: string
) {
  const { data, error } = await admin
    .from("gallery_album_items")
    .select("id, album_id, status")
    .eq("id", itemId)
    .eq("album_id", albumId)
    .maybeSingle();

  return { data, error };
}

export async function saveGalleryAlbum(formData: FormData) {
  const actorUserId = await getActorUserId();
  const parsed = albumFormSchema.safeParse(
    pickFormFields(formData, [
      "albumId",
      "category",
      "cloudinaryFolder",
      "description",
      "endsOn",
      "eventName",
      "featured",
      "month",
      "slug",
      "startsOn",
      "status",
      "title",
      "year",
    ])
  );

  if (!parsed.success) {
    await setAdminFlash({
      tone: "error",
      title: "Album not saved",
      message: parsed.error.issues[0]?.message || "Provide valid album details.",
    });
    redirect("/admin/content/gallery");
  }

  const admin = createAdminClient();
  const data = parsed.data;
  const slug = slugify(data.slug || data.title);

  if (!slug) {
    await setAdminFlash({
      tone: "error",
      title: "Album not saved",
      message: "Album title or slug must produce a valid URL slug.",
    });
    redirect("/admin/content/gallery");
  }

  const payload = {
    category: data.category,
    cloudinary_folder: data.cloudinaryFolder || null,
    description: data.description || null,
    ends_on: nullableDate(data.endsOn),
    event_name: data.eventName || data.title,
    featured: data.featured,
    month: data.month || null,
    slug,
    starts_on: nullableDate(data.startsOn),
    status: data.status,
    title: data.title,
    year: data.year,
  };

  const query = data.albumId
    ? admin.from("gallery_albums").update(payload).eq("id", data.albumId).select("id, slug").single()
    : admin
        .from("gallery_albums")
        .insert({
          ...payload,
          created_by_user_id: actorUserId,
          source: "manual",
          source_metadata: {},
        })
        .select("id, slug")
        .single();

  const { data: saved, error } = await query;

  if (error || !saved) {
    await setAdminFlash({
      tone: "error",
      title: "Album not saved",
      message: error?.message || "The gallery album could not be saved.",
    });
    redirect("/admin/content/gallery");
  }

  await audit({
    action: data.albumId ? "gallery.album_updated" : "gallery.album_created",
    actorUserId,
    entityId: saved.id,
    entityType: "gallery_album",
    metadata: { slug, status: data.status },
  });

  revalidateGallery({ albumId: saved.id, albumSlug: saved.slug });
  await setAdminFlash({
    tone: "success",
    title: "Album saved",
    message: `${data.title} is ready in the album workspace.`,
  });
  redirect(`/admin/content/gallery/${saved.id}`);
}

export async function updateGalleryAlbumLifecycle(formData: FormData) {
  const actorUserId = await getActorUserId();
  const parsed = albumLifecycleSchema.safeParse(
    pickFormFields(formData, ["albumId", "intent"])
  );

  if (!parsed.success) {
    await setAdminFlash({
      tone: "error",
      title: "Album action failed",
      message: "Choose a valid album action.",
    });
    redirect("/admin/content/gallery");
  }

  const admin = createAdminClient();
  const { albumId, intent } = parsed.data;
  const update =
    intent === "publish"
      ? { deleted_at: null, deleted_by_user_id: null, restorable_until: null, status: "published" }
      : intent === "archive"
        ? { status: "archived" }
        : intent === "restore"
          ? { deleted_at: null, deleted_by_user_id: null, restorable_until: null, status: "draft" }
          : {
              deleted_at: new Date().toISOString(),
              deleted_by_user_id: actorUserId,
              restorable_until: restorableUntil(),
              status: "archived",
              trash_reason: "operator album soft delete",
            };

  const { data, error } = await admin
    .from("gallery_albums")
    .update(update)
    .eq("id", albumId)
    .select("id, slug, title")
    .single();

  if (error || !data) {
    await setAdminFlash({
      tone: "error",
      title: "Album action failed",
      message: error?.message || "The gallery album could not be updated.",
    });
    redirect("/admin/content/gallery");
  }

  await audit({
    action: `gallery.album_${intent}`,
    actorUserId,
    entityId: albumId,
    entityType: "gallery_album",
    metadata: { slug: data.slug },
  });

  revalidateGallery({ albumId, albumSlug: data.slug });
  await setAdminFlash({
    tone: "success",
    title: "Album updated",
    message: `${data.title} was updated.`,
  });
  redirect("/admin/content/gallery");
}

export async function saveGalleryAlbumItem(formData: FormData) {
  const actorUserId = await getActorUserId();
  const parsed = itemFormSchema.safeParse(
    pickFormFields(formData, [
      "albumId",
      "altText",
      "description",
      "isCover",
      "itemId",
      "sortOrder",
      "status",
      "title",
    ])
  );

  if (!parsed.success) {
    await setAdminFlash({
      tone: "error",
      title: "Image not saved",
      message: parsed.error.issues[0]?.message || "Provide valid image details.",
    });
    redirect("/admin/content/gallery");
  }

  const admin = createAdminClient();
  const { albumId, isCover, itemId, ...item } = parsed.data;
  const album = await getAlbumForAction(admin, albumId);
  const itemRecord = await getAlbumItemForAction(admin, albumId, itemId);

  if (!album) {
    await setAdminFlash({
      tone: "error",
      title: "Image not saved",
      message: "The parent gallery album no longer exists.",
    });
    redirect("/admin/content/gallery");
  }

  if (itemRecord.error || !itemRecord.data) {
    await setAdminFlash({
      tone: "error",
      title: "Image not saved",
      message:
        itemRecord.error?.message ||
        "This image record was not found in the selected album.",
    });
    redirect(`/admin/content/gallery/${albumId}`);
  }

  const nextIsCover = item.status === "published" ? isCover : false;

  if (nextIsCover) {
    const { error: resetCoverError } = await admin
      .from("gallery_album_items")
      .update({ is_cover: false })
      .eq("album_id", albumId);

    if (resetCoverError) {
      await setAdminFlash({
        tone: "error",
        title: "Image not saved",
        message: resetCoverError.message,
      });
      redirect(`/admin/content/gallery/${albumId}`);
    }
  }

  const { data: savedItem, error } = await admin
    .from("gallery_album_items")
    .update({
      alt_text: item.altText || null,
      description: item.description || null,
      is_cover: nextIsCover,
      sort_order: item.sortOrder,
      status: item.status,
      title: item.title || null,
    })
    .eq("id", itemId)
    .eq("album_id", albumId)
    .select("id")
    .single();

  if (error || !savedItem) {
    await setAdminFlash({
      tone: "error",
      title: "Image not saved",
      message: error?.message || "The image record could not be updated.",
    });
    redirect(`/admin/content/gallery/${albumId}`);
  }

  if (nextIsCover) {
    const { error: coverError } = await admin
      .from("gallery_albums")
      .update({ cover_item_id: itemId })
      .eq("id", albumId);

    if (coverError) {
      await setAdminFlash({
        tone: "error",
        title: "Image saved, cover not updated",
        message: coverError.message,
      });
      redirect(`/admin/content/gallery/${albumId}`);
    }
  } else if (album?.cover_item_id === itemId) {
    const { error: clearCoverError } = await admin
      .from("gallery_albums")
      .update({ cover_item_id: null })
      .eq("id", albumId);

    if (clearCoverError) {
      await setAdminFlash({
        tone: "error",
        title: "Image saved, cover not updated",
        message: clearCoverError.message,
      });
      redirect(`/admin/content/gallery/${albumId}`);
    }
  }

  await audit({
    action: "gallery.album_item_updated",
    actorUserId,
    entityId: itemId,
    entityType: "gallery_album_item",
    metadata: { albumId, isCover: nextIsCover, status: item.status },
  });

  revalidateGallery({ albumId, albumSlug: album?.slug });
  await setAdminFlash({
    tone: "success",
    title: "Image saved",
    message: "The album image metadata was updated.",
  });
  redirect(`/admin/content/gallery/${albumId}`);
}

export async function bulkUpdateGalleryAlbumItems(formData: FormData) {
  const actorUserId = await getActorUserId();
  const parsed = bulkItemSchema.safeParse({
    albumId: asString(formData.get("albumId")),
    intent: asString(formData.get("intent")),
    itemIds: formData.getAll("itemIds").map((value) => asString(value)),
  });

  if (!parsed.success) {
    await setAdminFlash({
      tone: "error",
      title: "Bulk action failed",
      message: parsed.error.issues[0]?.message || "Select images and a valid action.",
    });
    redirect("/admin/content/gallery");
  }

  const admin = createAdminClient();
  const { albumId, intent, itemIds } = parsed.data;
  const album = await getAlbumForAction(admin, albumId);
  const update =
    intent === "publish"
      ? { deleted_at: null, deleted_by_user_id: null, restorable_until: null, status: "published" }
      : intent === "archive"
        ? { is_cover: false, status: "archived" }
        : intent === "restore"
          ? { deleted_at: null, deleted_by_user_id: null, restorable_until: null, status: "draft" }
          : {
              deleted_at: new Date().toISOString(),
              deleted_by_user_id: actorUserId,
              is_cover: false,
              restorable_until: restorableUntil(),
              status: "archived",
              trash_reason:
                intent === "remove"
                  ? "operator removed image from album"
                  : "operator soft-deleted album item",
            };

  const { error } = await admin
    .from("gallery_album_items")
    .update(update)
    .in("id", itemIds)
    .eq("album_id", albumId);

  if (error) {
    await setAdminFlash({
      tone: "error",
      title: "Bulk action failed",
      message: error.message,
    });
    redirect(`/admin/content/gallery/${albumId}`);
  }

  if (
    album?.cover_item_id &&
    itemIds.includes(album.cover_item_id) &&
    ["archive", "delete", "remove"].includes(intent)
  ) {
    await admin.from("gallery_albums").update({ cover_item_id: null }).eq("id", albumId);
  }

  await audit({
    action: `gallery.album_items_${intent}`,
    actorUserId,
    entityId: albumId,
    entityType: "gallery_album",
    metadata: { count: itemIds.length, itemIds },
  });

  revalidateGallery({ albumId, albumSlug: album?.slug });
  await setAdminFlash({
    tone: "success",
    title: "Bulk action complete",
    message: `${itemIds.length} image record(s) were updated. Media assets and Cloudinary files were preserved.`,
  });
  redirect(`/admin/content/gallery/${albumId}`);
}

export async function reorderGalleryAlbumItems(formData: FormData) {
  const actorUserId = await getActorUserId();
  const parsed = reorderSchema.safeParse({
    albumId: asString(formData.get("albumId")),
    itemIds: formData.getAll("itemIds").map((value) => asString(value)),
  });

  if (!parsed.success) {
    await setAdminFlash({
      tone: "error",
      title: "Reorder failed",
      message: "No valid image order was submitted.",
    });
    redirect("/admin/content/gallery");
  }

  const admin = createAdminClient();
  const { albumId, itemIds } = parsed.data;

  for (let index = 0; index < itemIds.length; index += 1) {
    const { error } = await admin
      .from("gallery_album_items")
      .update({ sort_order: (index + 1) * 10 })
      .eq("album_id", albumId)
      .eq("id", itemIds[index]);

    if (error) {
      await setAdminFlash({
        tone: "error",
        title: "Reorder failed",
        message: error.message,
      });
      redirect(`/admin/content/gallery/${albumId}`);
    }
  }

  await audit({
    action: "gallery.album_items_reordered",
    actorUserId,
    entityId: albumId,
    entityType: "gallery_album",
    metadata: { count: itemIds.length },
  });

  const album = await getAlbumForAction(admin, albumId);
  revalidateGallery({ albumId, albumSlug: album?.slug });
  await setAdminFlash({
    tone: "success",
    title: "Album order saved",
    message: "The album image order was updated.",
  });
  redirect(`/admin/content/gallery/${albumId}`);
}
