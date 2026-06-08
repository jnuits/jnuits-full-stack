import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdminApiPermission } from "@/lib/admin/api-auth";
import {
  insertAuditEvent,
  upsertCloudinaryMediaAsset,
} from "@/lib/content/media-assets";
import { getCloudinaryBlurUrl } from "@/lib/cloudinary/urls";
import type { Json } from "@/lib/db/types";
import { apiError } from "@/lib/errors/api-error";
import { withApiGuard } from "@/lib/security/with-api-guard";
import { createAdminClient } from "@/lib/supabase/admin";

const uploadedAssetSchema = z.object({
  altText: z.string().trim().max(300).optional(),
  bytes: z.number().int().nonnegative().nullable().optional(),
  durationSeconds: z.number().nonnegative().nullable().optional(),
  format: z.string().trim().max(40).nullable().optional(),
  height: z.number().int().positive().nullable().optional(),
  isPublic: z.boolean().optional().default(true),
  mediaKind: z.enum(["image", "video"]).default("image"),
  metadata: z.record(z.string(), z.unknown()).optional(),
  publicId: z.string().trim().min(1),
  resourceType: z.string().trim().min(1),
  secureUrl: z.string().trim().url(),
  thumbnailUrl: z.string().trim().url().nullable().optional(),
  title: z.string().trim().max(180).optional(),
  width: z.number().int().positive().nullable().optional(),
});

const requestSchema = z.object({
  assets: z.array(uploadedAssetSchema).min(1).max(80),
});

async function fetchBlurDataUrl(secureUrl: string) {
  try {
    const response = await fetch(getCloudinaryBlurUrl(secureUrl));

    if (!response.ok) {
      return null;
    }

    const contentType = response.headers.get("content-type") || "image/jpeg";
    const buffer = Buffer.from(await response.arrayBuffer());

    return `data:${contentType};base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  }
}

async function handlePost(
  request: NextRequest,
  context: { params: Promise<{ albumId: string }> }
) {
  const [{ albumId }, permission] = await Promise.all([
    context.params,
    requireAdminApiPermission("cms.gallery.manage", {
      forbiddenMessage: "Only gallery managers can register gallery uploads.",
      unauthenticatedMessage: "Sign in before registering gallery uploads.",
    }),
  ]);

  if (permission.response) {
    return permission.response;
  }
  const auth = permission.auth;

  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { message: "Provide one or more valid Cloudinary upload payloads." },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const { data: album, error: albumError } = await admin
    .from("gallery_albums")
    .select("id, slug, title, cover_item_id")
    .eq("id", albumId)
    .maybeSingle();

  if (albumError || !album) {
    if (!album) {
      return NextResponse.json(
        { message: "Gallery album was not found." },
        { status: 404 }
      );
    }

    return apiError(albumError, {
      context: "admin.galleryAlbumUpload.albumLookup",
      fallback: "Gallery album could not be loaded.",
      status: 500,
    });
  }

  const { data: lastItem } = await admin
    .from("gallery_album_items")
    .select("sort_order")
    .eq("album_id", albumId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  let nextSortOrder = (lastItem?.sort_order || 0) + 10;
  let nextPhotoIndex = Math.floor((lastItem?.sort_order || 0) / 10) + 1;
  const attachedIds: string[] = [];
  let firstAttachedId: string | null = null;

  for (const asset of parsed.data.assets) {
    const itemTitle = `${album.title} - Photo ${nextPhotoIndex}`;
    const media = await upsertCloudinaryMediaAsset(admin, {
      actorUserId: auth.user.id,
      input: {
        ...asset,
        metadata: {
          ...(asset.metadata || {}),
          albumId,
          source: "gallery-album-bulk-upload",
        } as Json,
        thumbnailUrl: asset.thumbnailUrl || asset.secureUrl,
      },
    });
    const blurDataURL =
      asset.mediaKind === "image" ? await fetchBlurDataUrl(asset.secureUrl) : null;
    const { data: item, error: itemError } = await admin
      .from("gallery_album_items")
      .upsert(
        {
          album_id: albumId,
          alt_text: itemTitle,
          blur_data_url: blurDataURL,
          deleted_at: null,
          deleted_by_user_id: null,
          description: null,
          height: asset.height ?? null,
          media_asset_id: media.id,
          restorable_until: null,
          sort_order: nextSortOrder,
          source_caption: null,
          source_metadata: {
            source: "direct-cloudinary-upload",
          },
          status: "published",
          title: itemTitle,
          trash_metadata: {},
          trash_reason: null,
          width: asset.width ?? null,
        },
        { onConflict: "album_id,media_asset_id" }
      )
      .select("id")
      .single();

    if (itemError || !item) {
      return apiError(itemError, {
        context: "admin.galleryAlbumUpload.attachItem",
        fallback: "Gallery image could not be attached.",
      });
    }

    attachedIds.push(item.id);
    firstAttachedId ||= item.id;
    nextSortOrder += 10;
    nextPhotoIndex += 1;
  }

  if (!album.cover_item_id && firstAttachedId) {
    await admin
      .from("gallery_album_items")
      .update({ is_cover: true })
      .eq("id", firstAttachedId)
      .eq("album_id", albumId);
    await admin
      .from("gallery_albums")
      .update({ cover_item_id: firstAttachedId })
      .eq("id", albumId);
  }

  await insertAuditEvent(admin, {
    action: "gallery.album_items_uploaded",
    actorUserId: auth.user.id,
    entityId: albumId,
    entityType: "gallery_album",
    metadata: {
      count: attachedIds.length,
      itemIds: attachedIds,
    },
  });

  revalidatePath("/gallery");
  revalidatePath(`/gallery/${album.slug}`);
  revalidatePath("/admin/content/gallery");
  revalidatePath(`/admin/content/gallery/${albumId}`);

  return NextResponse.json(
    {
      data: {
        count: attachedIds.length,
        itemIds: attachedIds,
      },
      message: "Gallery uploads were registered and attached to this album.",
    },
    { status: 201 }
  );
}

export const POST = withApiGuard(handlePost);
