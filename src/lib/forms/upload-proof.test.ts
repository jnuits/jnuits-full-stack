import { describe, expect, it } from "vitest";
import { createFormUploadProof, hashFormUploadManifest, validateProofBoundFormAssets, verifyFormUploadProof } from "./upload-proof";
const secret = "test-upload-proof-secret"; const now = new Date("2026-07-18T05:00:00.000Z");
const formDefinitionId = "11111111-1111-4111-8111-111111111111";
const formVersionId = "22222222-2222-4222-8222-222222222222";
const sessionId = "33333333-3333-4333-8333-333333333333";
const upload = { assetFolder: `jnuits/jnuits-full-stack/private/forms/${formDefinitionId}/${sessionId}`,
  fieldId: "identity_document", mimeType: "application/pdf" as const,
  publicId: "44444444-4444-4444-8444-444444444444.pdf", resourceType: "raw" as const,
  sha256: "a".repeat(64), size: 1024, uploadId: "55555555-5555-4555-8555-555555555555" };
function proof() { return createFormUploadProof({ expiresAt: new Date("2026-07-18T05:10:00.000Z"), formDefinitionId, formVersionId, secret, sessionId, uploads: [upload] }); }
describe("form upload proof", () => {
  it("binds a short-lived proof to its exact form version and server session", () => {
    expect(verifyFormUploadProof({ expectedFormDefinitionId: formDefinitionId, expectedFormVersionId: formVersionId, now, proof: proof(), secret }))
      .toEqual({ formDefinitionId, formVersionId, sessionId, uploads: [upload] });
  });
  it("rejects cross-version reuse and expiry", () => {
    expect(verifyFormUploadProof({ expectedFormDefinitionId: formDefinitionId, expectedFormVersionId: "66666666-6666-4666-8666-666666666666", now, proof: proof(), secret })).toBeNull();
    expect(verifyFormUploadProof({ expectedFormDefinitionId: formDefinitionId, expectedFormVersionId: formVersionId,
      now: new Date("2026-07-18T05:10:00.000Z"), proof: proof(), secret })).toBeNull();
  });
  it("rejects a changed upload after signing", () => {
    const value = proof(); expect(verifyFormUploadProof({ expectedFormDefinitionId: formDefinitionId, expectedFormVersionId: formVersionId, now, proof: `${value.slice(0, -1)}x`, secret })).toBeNull();
  });
  it("creates a stable manifest hash and accepts only exact asset metadata", () => {
    expect(hashFormUploadManifest([upload])).toMatch(/^[a-f0-9]{64}$/);
    expect(validateProofBoundFormAssets({ assets: [{ bytes: upload.size, cloudinaryAssetId: "a".repeat(32), cloudinaryFolder: upload.assetFolder,
      cloudinaryPublicId: upload.publicId, cloudinaryVersion: "1234567890", contentType: upload.mimeType, fieldId: upload.fieldId,
      resourceType: upload.resourceType, sha256: upload.sha256, uploadId: upload.uploadId }], uploads: [upload] })).toHaveLength(1);
    expect(() => validateProofBoundFormAssets({ assets: [], uploads: [upload] })).toThrow("missing");
  });
});
