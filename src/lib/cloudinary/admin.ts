import "server-only";

import {
  createCloudinarySignature,
  getCloudinaryConfig,
} from "@/lib/cloudinary/config";

export type CloudinaryAdminResourceType = "image" | "video" | "raw";

type CloudinaryRenameInput = {
  fromPublicId: string;
  invalidate?: boolean;
  overwrite?: boolean;
  resourceType: CloudinaryAdminResourceType;
  toPublicId: string;
};

export type CloudinaryRenameResult = {
  bytes?: number;
  format?: string;
  height?: number;
  public_id: string;
  resource_type?: string;
  secure_url?: string;
  url?: string;
  width?: number;
};

export type CloudinaryImageResource = {
  bytes: number;
  format: string;
  height: number;
  publicId: string;
  resourceType: string;
  secureUrl: string;
  type: string;
  width: number;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export async function getCloudinaryImageResource(
  publicId: string
): Promise<CloudinaryImageResource> {
  const config = getCloudinaryConfig();
  const endpoint =
    `https://api.cloudinary.com/v1_1/${config.cloudName}` +
    `/resources/image/upload/${encodeURIComponent(publicId)}`;
  const response = await fetch(endpoint, {
    cache: "no-store",
    headers: {
      Authorization: `Basic ${Buffer.from(
        `${config.apiKey}:${config.apiSecret}`
      ).toString("base64")}`,
    },
  });
  const payload = asRecord(await response.json().catch(() => null));

  if (!response.ok) {
    const cloudinaryError = asRecord(payload.error);
    throw new Error(
      typeof cloudinaryError.message === "string"
        ? cloudinaryError.message
        : "Cloudinary could not load the uploaded resource."
    );
  }

  if (
    typeof payload.bytes !== "number" ||
    typeof payload.format !== "string" ||
    typeof payload.height !== "number" ||
    typeof payload.public_id !== "string" ||
    typeof payload.resource_type !== "string" ||
    typeof payload.secure_url !== "string" ||
    typeof payload.type !== "string" ||
    typeof payload.width !== "number"
  ) {
    throw new Error("Cloudinary returned incomplete metadata for the avatar.");
  }

  return {
    bytes: payload.bytes,
    format: payload.format.toLowerCase(),
    height: payload.height,
    publicId: payload.public_id,
    resourceType: payload.resource_type,
    secureUrl: payload.secure_url,
    type: payload.type,
    width: payload.width,
  };
}

export function normalizeCloudinaryResourceType(
  resourceType: string | null | undefined
): CloudinaryAdminResourceType {
  if (resourceType === "video" || resourceType === "raw") {
    return resourceType;
  }

  return "image";
}

export async function renameCloudinaryAsset({
  fromPublicId,
  invalidate = true,
  overwrite = false,
  resourceType,
  toPublicId,
}: CloudinaryRenameInput) {
  const config = getCloudinaryConfig();
  const timestamp = Math.floor(Date.now() / 1000);
  const params = {
    from_public_id: fromPublicId,
    invalidate,
    overwrite,
    timestamp,
    to_public_id: toPublicId,
    to_type: "upload",
    type: "upload",
  };
  const signature = createCloudinarySignature(params, config.apiSecret);
  const body = new URLSearchParams({
    api_key: config.apiKey,
    from_public_id: fromPublicId,
    invalidate: String(invalidate),
    overwrite: String(overwrite),
    signature,
    timestamp: String(timestamp),
    to_public_id: toPublicId,
    to_type: "upload",
    type: "upload",
  });

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${config.cloudName}/${resourceType}/rename`,
    {
      body,
      method: "POST",
    }
  );
  const payload = (await response.json().catch(() => null)) as
    | (CloudinaryRenameResult & { error?: { message?: string } })
    | null;

  if (!response.ok || !payload?.public_id) {
    throw new Error(
      payload?.error?.message ||
        `Cloudinary could not rename ${fromPublicId} to ${toPublicId}.`
    );
  }

  return payload;
}
