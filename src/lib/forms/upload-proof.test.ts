import { describe, expect, it } from "vitest";

import {
  createFormUploadProof,
  validateProofBoundFormAssets,
  verifyFormUploadProof,
} from "./upload-proof";

const secret = "test-upload-proof-secret";
const now = new Date("2026-07-18T05:00:00.000Z");
const formDefinitionId = "11111111-1111-4111-8111-111111111111";
const upload = {
  assetFolder:
    "jnuits/jnuits-full-stack/private/forms/11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222",
  fieldId: "identity_document",
  mimeType: "application/pdf" as const,
  publicId: "33333333-3333-4333-8333-333333333333.pdf",
  resourceType: "raw" as const,
  sha256: "a".repeat(64),
  size: 1024,
  uploadId: "44444444-4444-4444-8444-444444444444",
};

describe("form upload proof", () => {
  it("binds a short-lived proof to its exact form upload", () => {
    const proof = createFormUploadProof({
      expiresAt: new Date("2026-07-18T05:10:00.000Z"),
      formDefinitionId,
      secret,
      uploads: [upload],
    });

    expect(
      verifyFormUploadProof({
        expectedFormDefinitionId: formDefinitionId,
        now,
        proof,
        secret,
      })
    ).toEqual({
      formDefinitionId,
      uploads: [upload],
    });
  });

  it("rejects a changed upload after signing", () => {
    const proof = createFormUploadProof({
      expiresAt: new Date("2026-07-18T05:10:00.000Z"),
      formDefinitionId,
      secret,
      uploads: [upload],
    });

    expect(
      verifyFormUploadProof({
        expectedFormDefinitionId: formDefinitionId,
        now,
        proof: `${proof.slice(0, -1)}x`,
        secret,
      })
    ).toBeNull();
  });

  it("accepts only asset metadata matching a signed upload", () => {
    expect(
      validateProofBoundFormAssets({
        assets: [
          {
            bytes: upload.size,
            cloudinaryAssetId: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            cloudinaryFolder: upload.assetFolder,
            cloudinaryPublicId: upload.publicId,
            cloudinaryVersion: "1234567890",
            contentType: upload.mimeType,
            fieldId: upload.fieldId,
            resourceType: upload.resourceType,
            sha256: upload.sha256,
            uploadId: upload.uploadId,
          },
        ],
        uploads: [upload],
      })
    ).toHaveLength(1);

    expect(() =>
      validateProofBoundFormAssets({
        assets: [],
        uploads: [upload],
      })
    ).toThrow("missing");
  });
});
