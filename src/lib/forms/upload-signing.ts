import "server-only";

import { createHash, randomUUID } from "node:crypto";
import type { FormDefinition, FormField } from "./definition";
import { createFormUploadProof, hashFormUploadManifest, type FormUploadProofUpload } from "./upload-proof";

export const FORM_UPLOAD_MAX_BYTES = 10 * 1024 * 1024;
export const FORM_UPLOAD_PROOF_TTL_MS = 10 * 60 * 1000;
type SupportedMimeType = FormUploadProofUpload["mimeType"];
export type FormUploadRequest = { fieldId: string; mimeType: SupportedMimeType; sha256: string; size: number };
export type FormUploadSigningConfig = { apiKey: string; apiSecret: string; cloudName: string };
export type FormUploadInstruction = FormUploadProofUpload & { allowedFormats: string; apiKey: string; context: string; signature: string; timestamp: number; uploadUrl: string };
const IMAGE_MIME_TYPES = new Set<SupportedMimeType>(["image/jpeg", "image/png", "image/webp"]);
function cloudinarySignature(parameters: Record<string, string | number>, apiSecret: string) {
  const payload = Object.entries(parameters).filter(([, value]) => value !== "").sort(([l], [r]) => l.localeCompare(r))
    .map(([key, value]) => `${key}=${value}`).join("&");
  return createHash("sha1").update(`${payload}${apiSecret}`).digest("hex");
}
function asUploadField(definition: FormDefinition, fieldId: string): Extract<FormField, { type: "image" | "pdf" }> {
  const field = definition.fields.find((candidate) => candidate.id === fieldId);
  if (!field || (field.type !== "image" && field.type !== "pdf")) throw new Error("This form field does not accept file uploads.");
  return field;
}
function assertUploadMatchesField(field: Extract<FormField, { type: "image" | "pdf" }>, upload: FormUploadRequest) {
  if (!Number.isInteger(upload.size) || upload.size <= 0 || upload.size > FORM_UPLOAD_MAX_BYTES) throw new Error("Files must be 10 MB or smaller.");
  if (!/^[a-f0-9]{64}$/.test(upload.sha256)) throw new Error("The file checksum is invalid.");
  const acceptsMime = (field.type === "pdf" && upload.mimeType === "application/pdf") || (field.type === "image" && IMAGE_MIME_TYPES.has(upload.mimeType));
  if (!acceptsMime) throw new Error("This field does not accept that file type.");
}
export function buildFormUploadInstructions(options: {
  config: FormUploadSigningConfig; definition: FormDefinition; formDefinitionId: string; formVersionId: string;
  now?: Date; randomId?: () => string; uploads: FormUploadRequest[];
}) {
  if (!options.config.apiKey || !options.config.apiSecret || !options.config.cloudName) throw new Error("Cloudinary form uploads are not configured.");
  if (!options.uploads.length || options.uploads.length > 25) throw new Error("Select between 1 and 25 files.");
  const uploadCounts = new Map<string, number>();
  const fields = options.uploads.map((upload) => {
    const field = asUploadField(options.definition, upload.fieldId); assertUploadMatchesField(field, upload);
    const count = (uploadCounts.get(field.id) || 0) + 1; uploadCounts.set(field.id, count);
    if (count > field.maxFiles) throw new Error(`${field.label} accepts at most ${field.maxFiles} file(s).`);
    return field;
  });
  const now = options.now || new Date(); const timestamp = Math.floor(now.getTime() / 1000);
  const expiresAt = new Date(now.getTime() + FORM_UPLOAD_PROOF_TTL_MS); const createId = options.randomId || randomUUID;
  const sessionId = createId();
  const assetFolder = `jnuits/jnuits-full-stack/private/forms/${options.formDefinitionId}/${sessionId}`;
  const proofUploads: FormUploadProofUpload[] = []; const instructions: FormUploadInstruction[] = [];
  for (const [index, upload] of options.uploads.entries()) {
    const field = fields[index]; const uploadId = createId(); const resourceType = field.type === "pdf" ? "raw" : "image";
    const allowedFormats = field.type === "pdf" ? "pdf" : "jpg,jpeg,png,webp"; const publicId = field.type === "pdf" ? `${uploadId}.pdf` : uploadId;
    const context = [`form_definition_id=${options.formDefinitionId}`, `form_version_id=${options.formVersionId}`, `field_id=${field.id}`, `upload_id=${uploadId}`, `sha256=${upload.sha256}`].join("|");
    const signedParameters = { allowed_formats: allowedFormats, asset_folder: assetFolder, context, discard_original_filename: "true", overwrite: "false", public_id: publicId, timestamp, unique_filename: "false", use_filename: "false" };
    const proofUpload: FormUploadProofUpload = { assetFolder, fieldId: field.id, mimeType: upload.mimeType, publicId, resourceType, sha256: upload.sha256, size: upload.size, uploadId };
    proofUploads.push(proofUpload); instructions.push({ ...proofUpload, allowedFormats, apiKey: options.config.apiKey, context,
      signature: cloudinarySignature(signedParameters, options.config.apiSecret), timestamp,
      uploadUrl: `https://api.cloudinary.com/v1_1/${options.config.cloudName}/${resourceType}/authenticated/upload` });
  }
  return { expiresAt: expiresAt.toISOString(), formVersionId: options.formVersionId,
    manifestSha256: hashFormUploadManifest(proofUploads),
    proof: createFormUploadProof({ expiresAt, formDefinitionId: options.formDefinitionId, formVersionId: options.formVersionId, secret: options.config.apiSecret, sessionId, uploads: proofUploads }),
    sessionId, uploads: instructions };
}
