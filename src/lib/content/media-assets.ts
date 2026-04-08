import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/db/types";
import { isCloudinaryAssetUrl } from "@/lib/cloudinary/config";

type AdminClient = SupabaseClient<Database>;

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
        .select("id")
        .single()
    : admin.from("media_assets").insert(payload).select("id").single();

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
