import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { CLOUDINARY_PROJECT_ROOT_FOLDER } from "@/lib/branding";
import {
  normalizeCloudinaryResourceType,
  renameCloudinaryAsset,
} from "@/lib/cloudinary/admin";
import type { Database, Json } from "@/lib/db/types";
import { isCloudinaryAssetUrl } from "@/lib/cloudinary/config";

type AdminClient = SupabaseClient<Database>;
type MediaAssetRow = Database["public"]["Tables"]["media_assets"]["Row"];

export type CloudinaryMediaAssetInput = {
  altText?: string | null;
  bytes?: number | null;
  durationSeconds?: number | null;
  format?: string | null;
  height?: number | null;
  isPublic: boolean;
  mediaKind: "image" | "video";
  metadata?: Json;
  publicId: string;
  resourceType: string;
  secureUrl: string;
  thumbnailUrl?: string | null;
  title?: string | null;
  width?: number | null;
};

function trimValue(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeInteger(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value) : null;
}

function normalizeFloat(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);

  next.setDate(next.getDate() + days);

  return next;
}

function safeSegment(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function metadataString(metadata: Json, key: string) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const value = (metadata as Record<string, Json>)[key];

  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function buildTrashPublicId(asset: MediaAssetRow, now = new Date()) {
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const originalPublicId = asset.trash_original_public_id || asset.public_id;
  const originalFileName = originalPublicId.split("/").pop() || asset.id;
  const sourceFolder =
    metadataString(asset.metadata, "albumSlug") ||
    metadataString(asset.metadata, "folder")?.split("/").pop() ||
    originalPublicId.split("/").slice(-2, -1)[0] ||
    "media-library";
  const safeFolder = safeSegment(sourceFolder) || "media-library";
  const safeFileName = safeSegment(originalFileName) || asset.id;

  return `${CLOUDINARY_PROJECT_ROOT_FOLDER}/trash/${year}/${month}/${safeFolder}/${safeFileName}`.replace(
    /\/{2,}/g,
    "/"
  );
}

async function resolveCount(
  label: string,
  query: PromiseLike<{ count: number | null; error: { message: string } | null }>
) {
  const result = await query;

  if (result.error) {
    return {
      count: 0,
      label,
      warning: `${label}: ${result.error.message}`,
    };
  }

  return {
    count: result.count || 0,
    label,
    warning: null,
  };
}

export async function insertAuditEvent(
  admin: AdminClient,
  options: {
    action: string;
    actorUserId: string;
    entityId: string;
    entityType: string;
    metadata?: Json;
  }
) {
  await admin.from("audit_events").insert({
    action: options.action,
    actor_user_id: options.actorUserId,
    entity_id: options.entityId,
    entity_type: options.entityType,
    metadata: options.metadata || {},
  });
}

export function buildCloudinaryMediaAssetPayload(
  actorUserId: string,
  input: CloudinaryMediaAssetInput
) {
  const publicId = trimValue(input.publicId);
  const secureUrl = trimValue(input.secureUrl);
  const resourceType = trimValue(input.resourceType);

  if (!publicId || !secureUrl || !resourceType) {
    throw new Error(
      "Cloudinary public ID, secure URL, and resource type are required."
    );
  }

  if (!isCloudinaryAssetUrl(secureUrl)) {
    throw new Error("Use a Cloudinary delivery URL for secure_url.");
  }

  return {
    alt_text: trimValue(input.altText) || null,
    bytes: normalizeInteger(input.bytes),
    created_by_user_id: actorUserId,
    duration_seconds: normalizeFloat(input.durationSeconds),
    format: trimValue(input.format),
    height: normalizeInteger(input.height),
    is_public: input.isPublic,
    media_kind: input.mediaKind,
    metadata: input.metadata || {},
    provider: "cloudinary" as const,
    public_id: publicId,
    resource_type: resourceType,
    secure_url: secureUrl,
    thumbnail_url: trimValue(input.thumbnailUrl),
    title: trimValue(input.title),
    width: normalizeInteger(input.width),
  };
}

export async function upsertCloudinaryMediaAsset(
  admin: AdminClient,
  options: {
    actorUserId: string;
    assetId?: string | null;
    input: CloudinaryMediaAssetInput;
  }
) {
  const payload = buildCloudinaryMediaAssetPayload(options.actorUserId, options.input);

  const query = options.assetId
    ? admin
        .from("media_assets")
        .update(payload)
        .eq("id", options.assetId)
        .select("id, title, public_id, media_kind, secure_url, thumbnail_url, alt_text")
        .single()
    : admin
        .from("media_assets")
        .insert(payload)
        .select("id, title, public_id, media_kind, secure_url, thumbnail_url, alt_text")
        .single();

  const { data, error } = await query;

  if (error || !data) {
    throw new Error(error?.message || "Unable to save the Cloudinary asset.");
  }

  await insertAuditEvent(admin, {
    action: options.assetId
      ? "content.media_asset_updated"
      : "content.media_asset_created",
    actorUserId: options.actorUserId,
    entityId: data.id,
    entityType: "media_asset",
    metadata: {
      isPublic: options.input.isPublic,
      mediaKind: options.input.mediaKind,
      publicId: payload.public_id,
      resourceType: payload.resource_type,
    },
  });

  return data;
}

export async function getMediaAssetReferenceSummary(
  admin: AdminClient,
  assetId: string
) {
  const checks = await Promise.all([
    resolveCount(
      "gallery album items",
      admin
        .from("gallery_album_items")
        .select("id", { count: "exact", head: true })
        .eq("media_asset_id", assetId)
        .is("deleted_at", null)
    ),
    resolveCount(
      "content posts",
      admin
        .from("content_posts")
        .select("id", { count: "exact", head: true })
        .eq("media_asset_id", assetId)
        .neq("status", "archived")
    ),
    resolveCount(
      "developer profiles",
      admin
        .from("developer_profiles")
        .select("id", { count: "exact", head: true })
        .eq("media_asset_id", assetId)
        .neq("status", "archived")
    ),
  ]);

  return {
    references: checks.map(({ count, label }) => ({ count, label })),
    total: checks.reduce((sum, item) => sum + item.count, 0),
    warnings: checks
      .map((item) => item.warning)
      .filter((warning): warning is string => Boolean(warning)),
  };
}

export async function moveMediaAssetToCloudinaryTrash(
  admin: AdminClient,
  options: {
    actorUserId: string;
    asset: MediaAssetRow;
  }
) {
  const { actorUserId, asset } = options;

  if (asset.deleted_at) {
    throw new Error("This media asset is already in trash.");
  }

  const referenceSummary = await getMediaAssetReferenceSummary(admin, asset.id);

  if (referenceSummary.warnings.length > 0) {
    throw new Error(
      `Reference checks did not complete safely: ${referenceSummary.warnings.join(
        "; "
      )}`
    );
  }

  if (referenceSummary.total > 0) {
    throw new Error(
      `This asset is still referenced by ${referenceSummary.total} published or active content record(s). Remove those links before moving it to trash.`
    );
  }

  const now = new Date();
  const originalPublicId = asset.trash_original_public_id || asset.public_id;
  const trashPublicId = buildTrashPublicId(asset, now);
  const resourceType = normalizeCloudinaryResourceType(asset.resource_type);
  const renameResult = await renameCloudinaryAsset({
    fromPublicId: asset.public_id,
    resourceType,
    toPublicId: trashPublicId,
  });
  const restoreDeadline = addDays(now, 30);

  const updatePayload = {
    deleted_at: now.toISOString(),
    deleted_by_user_id: actorUserId,
    is_public: false,
    public_id: renameResult.public_id,
    secure_url: renameResult.secure_url || asset.secure_url,
    thumbnail_url: renameResult.secure_url || asset.thumbnail_url,
    trash_moved_at: now.toISOString(),
    trash_original_public_id: originalPublicId,
    trash_public_id: renameResult.public_id,
    trash_restore_deadline: restoreDeadline.toISOString(),
    updated_at: now.toISOString(),
  };
  const { error } = await admin
    .from("media_assets")
    .update(updatePayload)
    .eq("id", asset.id);

  if (error) {
    await renameCloudinaryAsset({
      fromPublicId: renameResult.public_id,
      resourceType,
      toPublicId: originalPublicId,
    }).catch(() => null);
    throw new Error(error.message);
  }

  await insertAuditEvent(admin, {
    action: "content.media_asset_moved_to_trash",
    actorUserId,
    entityId: asset.id,
    entityType: "media_asset",
    metadata: {
      originalPublicId,
      trashPublicId: renameResult.public_id,
    },
  });
}

export async function restoreMediaAssetFromCloudinaryTrash(
  admin: AdminClient,
  options: {
    actorUserId: string;
    asset: MediaAssetRow;
  }
) {
  const { actorUserId, asset } = options;

  if (!asset.deleted_at) {
    throw new Error("This media asset is not currently in trash.");
  }

  if (!asset.trash_original_public_id || !asset.trash_public_id) {
    throw new Error("This media asset does not have enough trash metadata to restore safely.");
  }

  if (
    asset.trash_restore_deadline &&
    new Date(asset.trash_restore_deadline).getTime() < Date.now()
  ) {
    throw new Error(
      "The 30-day app restore window has passed. Restore this asset manually from Cloudinary trash review."
    );
  }

  const resourceType = normalizeCloudinaryResourceType(asset.resource_type);
  const renameResult = await renameCloudinaryAsset({
    fromPublicId: asset.trash_public_id,
    overwrite: false,
    resourceType,
    toPublicId: asset.trash_original_public_id,
  });
  const now = new Date().toISOString();
  const { error } = await admin
    .from("media_assets")
    .update({
      deleted_at: null,
      deleted_by_user_id: null,
      is_public: true,
      public_id: renameResult.public_id,
      secure_url: renameResult.secure_url || asset.secure_url,
      thumbnail_url: renameResult.secure_url || asset.thumbnail_url,
      trash_moved_at: null,
      trash_original_public_id: null,
      trash_public_id: null,
      trash_restore_deadline: null,
      updated_at: now,
    })
    .eq("id", asset.id);

  if (error) {
    await renameCloudinaryAsset({
      fromPublicId: renameResult.public_id,
      resourceType,
      toPublicId: asset.trash_public_id,
    }).catch(() => null);
    throw new Error(error.message);
  }

  await insertAuditEvent(admin, {
    action: "content.media_asset_restored_from_trash",
    actorUserId,
    entityId: asset.id,
    entityType: "media_asset",
    metadata: {
      restoredPublicId: renameResult.public_id,
      trashPublicId: asset.trash_public_id,
    },
  });
}
