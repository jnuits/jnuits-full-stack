import "server-only";

import { createCloudinarySignature, getCloudinaryConfig } from "@/lib/cloudinary/config";

export type SliderCloudinaryAsset = {
  filename: string;
  publicId: string;
  url: string;
};

const SLIDER_CLOUDINARY_FOLDER = "jnuits/slider";

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

export async function uploadSliderImageToCloudinary(file: File) {
  const config = getCloudinaryConfig();
  const timestamp = Math.floor(Date.now() / 1000);
  const publicId = `${sanitizePublicId(file.name) || "slider-image"}-${timestamp}`;
  const params = {
    folder: SLIDER_CLOUDINARY_FOLDER,
    overwrite: false,
    public_id: publicId,
    timestamp,
  };
  const signature = createCloudinarySignature(params, config.apiSecret);
  const body = new FormData();

  body.append("api_key", config.apiKey);
  body.append("file", file);
  body.append("folder", SLIDER_CLOUDINARY_FOLDER);
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
  const expression = cleanedQuery
    ? `folder:${SLIDER_CLOUDINARY_FOLDER} AND filename:${cleanedQuery}*`
    : `folder:${SLIDER_CLOUDINARY_FOLDER}`;
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
