import "server-only";

import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

const uploadSchema = z.object({
  assetFolder: z.string().min(1).max(180), fieldId: z.string().regex(/^[a-z][a-z0-9_]{0,63}$/),
  mimeType: z.enum(["application/pdf", "image/jpeg", "image/png", "image/webp"]), publicId: z.string().min(1).max(255),
  resourceType: z.enum(["image", "raw"]), sha256: z.string().regex(/^[a-f0-9]{64}$/),
  size: z.number().int().positive().max(10 * 1024 * 1024), uploadId: z.string().uuid(),
}).strict();
const proofPayloadSchema = z.object({
  expiresAt: z.number().int().positive(), formDefinitionId: z.string().uuid(), formVersionId: z.string().uuid(),
  sessionId: z.string().uuid(), uploads: z.array(uploadSchema).min(1).max(25), version: z.literal(2),
}).strict();
type FormUploadProofPayload = z.infer<typeof proofPayloadSchema>;
export type FormUploadProofUpload = z.infer<typeof uploadSchema>;
const submittedAssetSchema = z.object({
  bytes: z.number().int().positive().max(10 * 1024 * 1024), cloudinaryAssetId: z.string().regex(/^[a-f0-9]{32}$/),
  cloudinaryFolder: z.string().min(1).max(180), cloudinaryPublicId: z.string().min(1).max(255), cloudinaryVersion: z.string().regex(/^\d+$/),
  contentType: z.enum(["application/pdf", "image/jpeg", "image/png", "image/webp"]), fieldId: z.string().regex(/^[a-z][a-z0-9_]{0,63}$/),
  resourceType: z.enum(["image", "raw"]), sha256: z.string().regex(/^[a-f0-9]{64}$/), uploadId: z.string().uuid(),
}).strict();
export type FormSubmissionAsset = z.infer<typeof submittedAssetSchema>;
function encode(value: string) { return Buffer.from(value, "utf8").toString("base64url"); }
function decode(value: string) { return Buffer.from(value, "base64url").toString("utf8"); }
function signature(payload: string, secret: string) { return createHmac("sha256", secret).update(payload).digest("base64url"); }
function isValidSignature(expected: string, actual: string) {
  const expectedBytes = Buffer.from(expected); const actualBytes = Buffer.from(actual);
  return expectedBytes.length === actualBytes.length && timingSafeEqual(expectedBytes, actualBytes);
}
export function hashFormUploadManifest(uploads: FormUploadProofUpload[]) {
  return createHash("sha256").update(JSON.stringify([...uploads].sort((l, r) => l.uploadId.localeCompare(r.uploadId)))).digest("hex");
}
export function validateProofBoundFormAssets(options: { assets: unknown; uploads: FormUploadProofUpload[] }): FormSubmissionAsset[] {
  if (!Array.isArray(options.assets) || options.assets.length === 0) throw new Error("A signed upload is missing or unexpected.");
  const assets = z.array(submittedAssetSchema).max(25).parse(options.assets);
  if (assets.length !== options.uploads.length) throw new Error("A signed upload is missing or unexpected.");
  const signedUploads = new Map(options.uploads.map((upload) => [upload.uploadId, upload])); const seen = new Set<string>();
  for (const asset of assets) {
    if (seen.has(asset.uploadId)) throw new Error("A signed upload was submitted more than once.");
    const signed = signedUploads.get(asset.uploadId); if (!signed) throw new Error("A submitted upload was not signed for this form.");
    if (asset.fieldId !== signed.fieldId || asset.cloudinaryPublicId !== signed.publicId || asset.cloudinaryFolder !== signed.assetFolder ||
      asset.resourceType !== signed.resourceType || asset.contentType !== signed.mimeType || asset.bytes !== signed.size || asset.sha256 !== signed.sha256)
      throw new Error("Submitted upload metadata does not match its signed upload.");
    seen.add(asset.uploadId);
  }
  if (seen.size !== signedUploads.size) throw new Error("A signed upload is missing."); return assets;
}
export function createFormUploadProof(options: { expiresAt: Date; formDefinitionId: string; formVersionId: string; secret: string; sessionId: string; uploads: FormUploadProofUpload[] }) {
  if (!options.secret) throw new Error("A form upload proof secret is required.");
  const payload = proofPayloadSchema.parse({ expiresAt: Math.floor(options.expiresAt.getTime() / 1000), formDefinitionId: options.formDefinitionId,
    formVersionId: options.formVersionId, sessionId: options.sessionId, uploads: options.uploads, version: 2 });
  const encoded = encode(JSON.stringify(payload)); return `${encoded}.${signature(encoded, options.secret)}`;
}
export function verifyFormUploadProof(options: { expectedFormDefinitionId: string; expectedFormVersionId?: string; now?: Date; proof: string; secret: string }): null | Pick<FormUploadProofPayload, "formDefinitionId" | "formVersionId" | "sessionId" | "uploads"> {
  if (!options.secret) return null; const [encoded, supplied, ...extra] = options.proof.split(".");
  if (!encoded || !supplied || extra.length || !isValidSignature(signature(encoded, options.secret), supplied)) return null;
  try {
    const payload = proofPayloadSchema.parse(JSON.parse(decode(encoded))); const now = Math.floor((options.now || new Date()).getTime() / 1000);
    if (payload.expiresAt <= now || payload.formDefinitionId !== options.expectedFormDefinitionId ||
      (options.expectedFormVersionId && payload.formVersionId !== options.expectedFormVersionId)) return null;
    return { formDefinitionId: payload.formDefinitionId, formVersionId: payload.formVersionId, sessionId: payload.sessionId, uploads: payload.uploads };
  } catch { return null; }
}
