import "server-only";

import { createHash } from "node:crypto";
import { CLOUDINARY_PROJECT_ROOT_FOLDER } from "@/lib/branding";

export type CloudinaryConfig = {
  apiKey: string;
  apiSecret: string;
  cloudName: string;
  uploadPreset: string | null;
};

export type CloudinaryPublicConfig = Omit<CloudinaryConfig, "apiSecret">;

function clean(value: string | undefined) {
  const trimmed = value?.trim();

  return trimmed ? trimmed : null;
}

export function getCloudinaryConfig(): CloudinaryConfig {
  const cloudName =
    clean(process.env.CLOUDINARY_CLOUD_NAME) ||
    clean(process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME);
  const apiKey = clean(process.env.CLOUDINARY_API_KEY);
  const apiSecret = clean(process.env.CLOUDINARY_API_SECRET);

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error(
      "Cloudinary is not fully configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET."
    );
  }

  return {
    apiKey,
    apiSecret,
    cloudName,
    uploadPreset: clean(process.env.CLOUDINARY_UPLOAD_PRESET),
  };
}

export function isCloudinaryConfigured() {
  return Boolean(
    (clean(process.env.CLOUDINARY_CLOUD_NAME) ||
      clean(process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME)) &&
      clean(process.env.CLOUDINARY_API_KEY) &&
      clean(process.env.CLOUDINARY_API_SECRET)
  );
}

export function getCloudinaryPublicConfig(): CloudinaryPublicConfig {
  const config = getCloudinaryConfig();

  return {
    apiKey: config.apiKey,
    cloudName: config.cloudName,
    uploadPreset: config.uploadPreset,
  };
}

export function isCloudinaryAssetUrl(value: string) {
  try {
    const url = new URL(value);

    return url.hostname.endsWith("res.cloudinary.com");
  } catch {
    return false;
  }
}

export function normalizeCloudinaryFolder(value: string) {
  const normalized = value
    .trim()
    .replace(/\\/g, "/")
    .replace(/[^a-zA-Z0-9/_-]+/g, "-")
    .replace(/\/{2,}/g, "/")
    .replace(/^\/+|\/+$/g, "")
    .slice(0, 180);

  if (!normalized) {
    return CLOUDINARY_PROJECT_ROOT_FOLDER;
  }

  if (
    normalized === CLOUDINARY_PROJECT_ROOT_FOLDER ||
    normalized.startsWith(`${CLOUDINARY_PROJECT_ROOT_FOLDER}/`)
  ) {
    return normalized;
  }

  const withoutLegacyPrefix = normalized.replace(/^jnuits\//, "");
  const withoutProjectRoot = withoutLegacyPrefix.replace(/^jnuits-full-stack\//, "");

  return `${CLOUDINARY_PROJECT_ROOT_FOLDER}/${withoutProjectRoot}`.replace(/\/{2,}/g, "/");
}

export function createCloudinarySignature(
  params: Record<string, boolean | number | string | null | undefined>,
  apiSecret: string
) {
  const serialized = Object.entries(params)
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${String(value)}`)
    .join("&");

  return createHash("sha1")
    .update(`${serialized}${apiSecret}`)
    .digest("hex");
}
