import "server-only";

import { createHash } from "node:crypto";
import { getCloudinaryConfig } from "@/lib/cloudinary/config";
import type { FormSubmissionAsset } from "./upload-proof";

const FORMAT_BY_CONTENT_TYPE = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

type CloudinaryAssetDetails = {
  asset_folder?: string;
  asset_id?: string;
  bytes?: number;
  context?: { custom?: Record<string, string> };
  format?: string;
  public_id?: string;
  resource_type?: string;
  type?: string;
  version?: number;
};

type ExpectedFormOwnership = {
  expectedFormDefinitionId: string;
  expectedFormVersionId: string;
};

function basicAuthorization(apiKey: string, apiSecret: string) {
  return `Basic ${Buffer.from(`${apiKey}:${apiSecret}`, "utf8").toString("base64")}`;
}

function normalizedFormat(contentType: FormSubmissionAsset["contentType"], format: string | undefined, resourceType: FormSubmissionAsset["resourceType"]) {
  // Raw PDF resources have no image-format field in Cloudinary's Admin API.
  if (contentType === "application/pdf") return resourceType === "raw" && (format === undefined || format === "pdf");
  if (resourceType !== "image") return false;
  if (contentType === "image/jpeg") return format === "jpg" || format === "jpeg";
  return format === FORMAT_BY_CONTENT_TYPE[contentType];
}

export async function loadVerifiedCloudinaryFormAsset(
  asset: FormSubmissionAsset,
  options: ExpectedFormOwnership & { fetchImpl?: typeof fetch }
) {
  const config = getCloudinaryConfig();
  const response = await (options.fetchImpl || fetch)(
    `https://api.cloudinary.com/v1_1/${encodeURIComponent(config.cloudName)}/resources/${encodeURIComponent(asset.cloudinaryAssetId)}`,
    {
      headers: { Authorization: basicAuthorization(config.apiKey, config.apiSecret) },
      signal: AbortSignal.timeout(5_000),
    }
  );
  const details = (await response.json().catch(() => null)) as CloudinaryAssetDetails | null;
  const context = details?.context?.custom || {};

  if (
    !response.ok ||
    !details ||
    details.asset_id !== asset.cloudinaryAssetId ||
    details.public_id !== asset.cloudinaryPublicId ||
    String(details.version) !== asset.cloudinaryVersion ||
    details.asset_folder !== asset.cloudinaryFolder ||
    details.resource_type !== asset.resourceType ||
    details.type !== "authenticated" ||
    details.bytes !== asset.bytes ||
    !normalizedFormat(asset.contentType, details.format, asset.resourceType) ||
    context.form_definition_id !== options.expectedFormDefinitionId ||
    context.form_version_id !== options.expectedFormVersionId ||
    context.field_id !== asset.fieldId ||
    context.upload_id !== asset.uploadId ||
    context.sha256 !== asset.sha256
  ) {
    throw new Error("Cloudinary upload metadata does not match its signed authorization.");
  }

  return details;
}

function encodePublicId(value: string) {
  return value.split("/").map(encodeURIComponent).join("/");
}

export function buildSignedCloudinaryFormAssetUrl(asset: FormSubmissionAsset) {
  const config = getCloudinaryConfig();
  const format = FORMAT_BY_CONTENT_TYPE[asset.contentType];
  const leaf = asset.resourceType === "raw" ? asset.cloudinaryPublicId : `${asset.cloudinaryPublicId}.${format}`;
  // Preserve the existing version-inclusive manual delivery signature. Both
  // this and SDK-style signatures were verified against the live provider.
  const deliveryPath = `v${asset.cloudinaryVersion}/${encodePublicId(leaf)}`;
  const signature = createHash("sha256")
    .update(`${deliveryPath}${config.apiSecret}`)
    .digest("base64url")
    .slice(0, 8);

  return `https://res.cloudinary.com/${encodeURIComponent(config.cloudName)}/${asset.resourceType}/authenticated/s--${signature}--/v${asset.cloudinaryVersion}/${encodePublicId(leaf)}`;
}

export async function verifyCloudinaryFormAssets(
  assets: FormSubmissionAsset[],
  ownership: ExpectedFormOwnership
) {
  await Promise.all(
    assets.map((asset) => loadVerifiedCloudinaryFormAsset(asset, ownership))
  );
}
