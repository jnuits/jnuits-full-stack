import "server-only";

import { createCloudinarySignature, getCloudinaryConfig } from "@/lib/cloudinary/config";
import {
  CLOUDINARY_PROJECT_ROOT_FOLDER,
  CLOUDINARY_SLIDER_FOLDER,
} from "@/lib/branding";

export type SliderCloudinaryAsset = {
  filename: string;
  publicId: string;
  url: string;
};

const SLIDER_MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const SLIDER_ALLOWED_IMAGE_TYPES = new Set([
  "image/avif",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const SLIDER_ALLOWED_IMAGE_EXTENSION = /\.(avif|gif|jpe?g|png|webp)$/i;

function sanitizePublicId(value: string) {
  const withoutExtension = value.replace(/\.[^/.]+$/, "");

  return withoutExtension
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function escapeSearchTerm(value: string) {
  return value.replace(/[^\w-]+/g, "").slice(0, 80);
}

function getBasicAuthHeader(apiKey: string, apiSecret: string) {
  return `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString("base64")}`;
}

function getRemotePublicIdBase(imageUrl: string, fallback: string) {
  try {
    const pathname = new URL(imageUrl).pathname;
    const filename = decodeURIComponent(pathname.split("/").pop() || "");

    return sanitizePublicId(filename) || sanitizePublicId(fallback);
  } catch {
    return sanitizePublicId(fallback);
  }
}

function validateSliderImageFile(file: File) {
  if (file.size <= 0) {
    throw new Error("Choose a non-empty image file for the slider.");
  }

  if (file.size > SLIDER_MAX_UPLOAD_BYTES) {
    throw new Error("Slider images must be 10 MB or smaller.");
  }

  const hasAllowedType = SLIDER_ALLOWED_IMAGE_TYPES.has(file.type);
  const hasAllowedExtension = SLIDER_ALLOWED_IMAGE_EXTENSION.test(file.name);

  if (!hasAllowedType && !hasAllowedExtension) {
    throw new Error("Slider uploads must be JPEG, PNG, WebP, GIF, or AVIF images.");
  }
}

export async function uploadSliderImageToCloudinary(file: File) {
  validateSliderImageFile(file);

  return uploadSliderSourceToCloudinary(
    file,
    sanitizePublicId(file.name) || "slider-image"
  );
}

export async function copySliderImageToCloudinary(imageUrl: string, fallbackName: string) {
  const sourceUrl = imageUrl.trim();

  if (!/^https?:\/\//i.test(sourceUrl)) {
    throw new Error("Provide a valid image URL to copy into the slider folder.");
  }

  return uploadSliderSourceToCloudinary(
    sourceUrl,
    getRemotePublicIdBase(sourceUrl, fallbackName) || "slider-image"
  );
}

export function isSliderCloudinaryUrl(imageUrl: string) {
  try {
    const url = new URL(imageUrl);
    const pathname = decodeURIComponent(url.pathname);

    return (
      url.hostname.endsWith("res.cloudinary.com") &&
      pathname.includes(`/${CLOUDINARY_SLIDER_FOLDER}/`)
    );
  } catch {
    return false;
  }
}

export async function ensureSliderImageInDefaultFolder(
  imageUrl: string,
  fallbackName: string
) {
  const sourceUrl = imageUrl.trim();

  if (!sourceUrl) {
    throw new Error("Upload an image or provide an existing image URL.");
  }

  if (isSliderCloudinaryUrl(sourceUrl)) {
    return {
      publicId: "",
      url: sourceUrl,
    };
  }

  return copySliderImageToCloudinary(sourceUrl, fallbackName);
}

async function uploadSliderSourceToCloudinary(source: File | string, publicIdBase: string) {
  const config = getCloudinaryConfig();
  const timestamp = Math.floor(Date.now() / 1000);
  const publicId = `${publicIdBase}-${timestamp}`;
  const params = {
    folder: CLOUDINARY_SLIDER_FOLDER,
    overwrite: false,
    public_id: publicId,
    timestamp,
  };
  const signature = createCloudinarySignature(params, config.apiSecret);
  const body = new FormData();

  body.append("api_key", config.apiKey);
  body.append("file", source);
  body.append("folder", CLOUDINARY_SLIDER_FOLDER);
  body.append("overwrite", "false");
  body.append("public_id", publicId);
  body.append("signature", signature);
  body.append("timestamp", String(timestamp));

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${config.cloudName}/image/upload`,
    {
      body,
      method: "POST",
    }
  );
  const payload = (await response.json().catch(() => null)) as
    | {
        error?: { message?: string };
        public_id?: string;
        secure_url?: string;
      }
    | null;

  if (!response.ok || !payload?.secure_url || !payload.public_id) {
    throw new Error(
      payload?.error?.message || "Cloudinary upload failed for the slider image."
    );
  }

  return {
    publicId: payload.public_id,
    url: payload.secure_url,
  };
}

export async function searchSliderCloudinaryFolder(query = "") {
  const config = getCloudinaryConfig();
  const cleanedQuery = escapeSearchTerm(query.trim());
  const projectRootExpression = `public_id:${CLOUDINARY_PROJECT_ROOT_FOLDER}/*`;
  const expression = cleanedQuery
    ? `${projectRootExpression} AND filename:${cleanedQuery}*`
    : projectRootExpression;
  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${config.cloudName}/resources/search`,
    {
      body: JSON.stringify({
        expression,
        max_results: 50,
        sort_by: [{ created_at: "desc" }],
      }),
      headers: {
        Authorization: getBasicAuthHeader(config.apiKey, config.apiSecret),
        "Content-Type": "application/json",
      },
      method: "POST",
    }
  );
  const payload = (await response.json().catch(() => null)) as
    | {
        error?: { message?: string };
        resources?: Array<{
          filename?: string;
          public_id?: string;
          secure_url?: string;
        }>;
      }
    | null;

  if (!response.ok || !payload?.resources) {
    throw new Error(
      payload?.error?.message || "Cloudinary slider image search failed."
    );
  }

  return payload.resources
    .map((resource) => {
      if (!resource.public_id || !resource.secure_url) {
        return null;
      }

      return {
        filename:
          resource.filename ||
          resource.public_id.split("/").pop() ||
          resource.public_id,
        publicId: resource.public_id,
        url: resource.secure_url,
      };
    })
    .filter((resource): resource is SliderCloudinaryAsset => Boolean(resource));
}
