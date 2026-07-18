import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

const uploadSchema = z
  .object({
    assetFolder: z.string().min(1).max(180),
    fieldId: z.string().regex(/^[a-z][a-z0-9_]{0,63}$/),
    mimeType: z.enum([
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp",
    ]),
    publicId: z.string().min(1).max(255),
    resourceType: z.enum(["image", "raw"]),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    size: z.number().int().positive().max(10 * 1024 * 1024),
    uploadId: z.string().uuid(),
  })
  .strict();

const proofPayloadSchema = z
  .object({
    expiresAt: z.number().int().positive(),
    formDefinitionId: z.string().uuid(),
    uploads: z.array(uploadSchema).min(1).max(25),
    version: z.literal(1),
  })
  .strict();

type FormUploadProofPayload = z.infer<typeof proofPayloadSchema>;
export type FormUploadProofUpload = z.infer<typeof uploadSchema>;

const submittedAssetSchema = z
  .object({
    bytes: z.number().int().positive().max(10 * 1024 * 1024),
    cloudinaryAssetId: z.string().regex(/^[a-f0-9]{32}$/),
    cloudinaryFolder: z.string().min(1).max(180),
    cloudinaryPublicId: z.string().min(1).max(255),
    cloudinaryVersion: z.string().regex(/^\d+$/),
    contentType: z.enum([
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp",
    ]),
    fieldId: z.string().regex(/^[a-z][a-z0-9_]{0,63}$/),
    resourceType: z.enum(["image", "raw"]),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    uploadId: z.string().uuid(),
  })
  .strict();

export type FormSubmissionAsset = z.infer<typeof submittedAssetSchema>;

function encode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signature(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function isValidSignature(expected: string, actual: string) {
  const expectedBytes = Buffer.from(expected);
  const actualBytes = Buffer.from(actual);

  return (
    expectedBytes.length === actualBytes.length &&
    timingSafeEqual(expectedBytes, actualBytes)
  );
}

export function validateProofBoundFormAssets(options: {
  assets: unknown;
  uploads: FormUploadProofUpload[];
}): FormSubmissionAsset[] {
  if (!Array.isArray(options.assets) || options.assets.length === 0) {
    throw new Error("A signed upload is missing or unexpected.");
  }

  const assets = z.array(submittedAssetSchema).max(25).parse(options.assets);

  if (assets.length !== options.uploads.length) {
    throw new Error("A signed upload is missing or unexpected.");
  }

  const signedUploads = new Map(options.uploads.map((upload) => [upload.uploadId, upload]));
  const seenUploadIds = new Set<string>();

  for (const asset of assets) {
    if (seenUploadIds.has(asset.uploadId)) {
      throw new Error("A signed upload was submitted more than once.");
    }

    const signedUpload = signedUploads.get(asset.uploadId);
    if (!signedUpload) {
      throw new Error("A submitted upload was not signed for this form.");
    }

    if (
      asset.fieldId !== signedUpload.fieldId ||
      asset.cloudinaryPublicId !== signedUpload.publicId ||
      asset.cloudinaryFolder !== signedUpload.assetFolder ||
      asset.resourceType !== signedUpload.resourceType ||
      asset.contentType !== signedUpload.mimeType ||
      asset.bytes !== signedUpload.size ||
      asset.sha256 !== signedUpload.sha256
    ) {
      throw new Error("Submitted upload metadata does not match its signed upload.");
    }

    seenUploadIds.add(asset.uploadId);
  }

  if (seenUploadIds.size !== signedUploads.size) {
    throw new Error("A signed upload is missing.");
  }

  return assets;
}

export function createFormUploadProof(options: {
  expiresAt: Date;
  formDefinitionId: string;
  secret: string;
  uploads: FormUploadProofUpload[];
}) {
  if (!options.secret) {
    throw new Error("A form upload proof secret is required.");
  }

  const payload = proofPayloadSchema.parse({
    expiresAt: Math.floor(options.expiresAt.getTime() / 1000),
    formDefinitionId: options.formDefinitionId,
    uploads: options.uploads,
    version: 1,
  });
  const encodedPayload = encode(JSON.stringify(payload));

  return `${encodedPayload}.${signature(encodedPayload, options.secret)}`;
}

export function verifyFormUploadProof(options: {
  expectedFormDefinitionId: string;
  now?: Date;
  proof: string;
  secret: string;
}): null | Pick<FormUploadProofPayload, "formDefinitionId" | "uploads"> {
  if (!options.secret) {
    return null;
  }

  const [encodedPayload, suppliedSignature, ...extraParts] = options.proof.split(".");
  if (!encodedPayload || !suppliedSignature || extraParts.length > 0) {
    return null;
  }

  if (!isValidSignature(signature(encodedPayload, options.secret), suppliedSignature)) {
    return null;
  }

  try {
    const payload = proofPayloadSchema.parse(JSON.parse(decode(encodedPayload)));
    const now = Math.floor((options.now || new Date()).getTime() / 1000);

    if (
      payload.expiresAt <= now ||
      payload.formDefinitionId !== options.expectedFormDefinitionId
    ) {
      return null;
    }

    return {
      formDefinitionId: payload.formDefinitionId,
      uploads: payload.uploads,
    };
  } catch {
    return null;
  }
}
