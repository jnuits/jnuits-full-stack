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
