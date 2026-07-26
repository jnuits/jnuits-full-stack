import { describe, expect, it } from "vitest";

import {
  createFormUploadProof,
  hashFormUploadManifest,
  validateProofBoundFormAssets,
  verifyFormUploadProof,
  type FormSubmissionAsset,
  type FormUploadProofUpload,
} from "./upload-proof";

const SECRET = "test-upload-proof-secret";
const OTHER_SECRET = "a-different-upload-proof-secret";
const FORM_DEFINITION_ID = "11111111-1111-4111-8111-111111111111";
const FORM_VERSION_ID = "22222222-2222-4222-8222-222222222222";
const SESSION_ID = "33333333-3333-4333-8333-333333333333";
const OTHER_UUID = "66666666-6666-4666-8666-666666666666";
const EXPIRES_AT = new Date("2026-07-18T05:10:00.000Z");
const NOW = new Date("2026-07-18T05:00:00.000Z");
const MISMATCH = "Submitted upload metadata does not match its signed upload.";

const pdfUpload: FormUploadProofUpload = {
  assetFolder: `jnuits/jnuits-full-stack/private/forms/${FORM_DEFINITION_ID}/${SESSION_ID}`,
  fieldId: "identity_document",
  mimeType: "application/pdf",
  publicId: "44444444-4444-4444-8444-444444444444.pdf",
  resourceType: "raw",
  sha256: "a".repeat(64),
  size: 1024,
  uploadId: "55555555-5555-4555-8555-555555555555",
};

const imageUpload: FormUploadProofUpload = {
  ...pdfUpload,
  fieldId: "student_id_card",
  mimeType: "image/png",
  publicId: "77777777-7777-4777-8777-777777777777",
  resourceType: "image",
  sha256: "b".repeat(64),
  size: 2048,
  uploadId: "88888888-8888-4888-8888-888888888888",
};

function mintProof(overrides: Partial<Parameters<typeof createFormUploadProof>[0]> = {}) {
  return createFormUploadProof({
    expiresAt: EXPIRES_AT,
    formDefinitionId: FORM_DEFINITION_ID,
    formVersionId: FORM_VERSION_ID,
    secret: SECRET,
    sessionId: SESSION_ID,
    uploads: [pdfUpload],
    ...overrides,
  });
}

function verify(overrides: Partial<Parameters<typeof verifyFormUploadProof>[0]> = {}) {
  return verifyFormUploadProof({
    expectedFormDefinitionId: FORM_DEFINITION_ID,
    expectedFormVersionId: FORM_VERSION_ID,
    now: NOW,
    proof: mintProof(),
    secret: SECRET,
    ...overrides,
  });
}

function assetFor(upload: FormUploadProofUpload, overrides: Partial<FormSubmissionAsset> = {}): FormSubmissionAsset {
  return {
    bytes: upload.size,
    cloudinaryAssetId: "a".repeat(32),
    cloudinaryFolder: upload.assetFolder,
    cloudinaryPublicId: upload.publicId,
    cloudinaryVersion: "1234567890",
    contentType: upload.mimeType,
    fieldId: upload.fieldId,
    resourceType: upload.resourceType,
    sha256: upload.sha256,
    uploadId: upload.uploadId,
    ...overrides,
  };
}

describe("form upload proof verification", () => {
  it("accepts only a proof signed with the server secret", () => {
    expect(verify()).not.toBeNull();
    expect(verify({ secret: OTHER_SECRET })).toBeNull();
    expect(verify({ secret: "" })).toBeNull();
  });

  it("rejects a payload edited after signing", () => {
    const [encoded, supplied] = mintProof().split(".");
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    payload.uploads[0].size = 9_999_999;
    const forged = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");

    expect(verify({ proof: `${forged}.${supplied}` })).toBeNull();
  });

  it("rejects malformed proof envelopes", () => {
    const value = mintProof();

    for (const proof of ["", ".", value.split(".")[0], `${value}.extra`, `${value.slice(0, -1)}x`]) {
      expect(verify({ proof })).toBeNull();
    }
  });

  it("rejects a proof minted for another form or version", () => {
    expect(verify({ expectedFormDefinitionId: OTHER_UUID })).toBeNull();
    expect(verify({ expectedFormVersionId: OTHER_UUID })).toBeNull();
    expect(
      verify({ proof: mintProof({ formDefinitionId: OTHER_UUID }) })
    ).toBeNull();
    expect(verify({ proof: mintProof({ formVersionId: OTHER_UUID }) })).toBeNull();
  });

  it("expires exactly at the boundary rather than after it", () => {
    expect(verify({ now: new Date(EXPIRES_AT.getTime() - 1_000) })).not.toBeNull();
    expect(verify({ now: EXPIRES_AT })).toBeNull();
    expect(verify({ now: new Date(EXPIRES_AT.getTime() + 60_000) })).toBeNull();
  });

  it("carries the issuing session so consumption can be bound to one server record", () => {
    expect(verify()?.sessionId).toBe(SESSION_ID);
    expect(verify({ proof: mintProof({ sessionId: OTHER_UUID }) })?.sessionId).toBe(OTHER_UUID);
  });
});

describe("form upload manifest hashing", () => {
  it("is stable across ordering but sensitive to the signed set", () => {
    const ordered = hashFormUploadManifest([pdfUpload, imageUpload]);

    expect(ordered).toMatch(/^[a-f0-9]{64}$/);
    expect(hashFormUploadManifest([imageUpload, pdfUpload])).toBe(ordered);
    expect(hashFormUploadManifest([pdfUpload])).not.toBe(ordered);
    expect(hashFormUploadManifest([{ ...pdfUpload, size: 2048 }, imageUpload])).not.toBe(ordered);
    expect(hashFormUploadManifest([{ ...pdfUpload, sha256: "c".repeat(64) }, imageUpload])).not.toBe(ordered);
  });
});

describe("form upload asset binding", () => {
  it("accepts assets that match their signed uploads exactly", () => {
    expect(
      validateProofBoundFormAssets({
        assets: [assetFor(pdfUpload), assetFor(imageUpload)],
        uploads: [pdfUpload, imageUpload],
      })
    ).toHaveLength(2);
  });

  it("rejects a replayed upload identifier", () => {
    expect(() =>
      validateProofBoundFormAssets({
        assets: [assetFor(pdfUpload), assetFor(pdfUpload)],
        uploads: [pdfUpload, imageUpload],
      })
    ).toThrow("A signed upload was submitted more than once.");
  });

  it("rejects an upload that was never signed for this form", () => {
    expect(() =>
      validateProofBoundFormAssets({
        assets: [assetFor(imageUpload)],
        uploads: [pdfUpload],
      })
    ).toThrow("A submitted upload was not signed for this form.");
  });

  it("rejects a missing or extra upload", () => {
    expect(() =>
      validateProofBoundFormAssets({ assets: [], uploads: [pdfUpload] })
    ).toThrow("A signed upload is missing or unexpected.");
    expect(() =>
      validateProofBoundFormAssets({
        assets: [assetFor(pdfUpload)],
        uploads: [pdfUpload, imageUpload],
      })
    ).toThrow("A signed upload is missing or unexpected.");
    expect(() =>
      validateProofBoundFormAssets({
        assets: [assetFor(pdfUpload), assetFor(imageUpload)],
        uploads: [pdfUpload],
      })
    ).toThrow("A signed upload is missing or unexpected.");
  });

  it.each([
    ["field", { fieldId: "another_field" }],
    ["MIME type", { contentType: "image/png" as const }],
    ["size", { bytes: 4096 }],
    ["checksum", { sha256: "c".repeat(64) }],
    ["provider folder", { cloudinaryFolder: "jnuits/public/somewhere-else" }],
    ["provider public id", { cloudinaryPublicId: "someone-elses-object.pdf" }],
    ["provider resource type", { resourceType: "image" as const }],
  ])("rejects a %s mismatch against the signed upload", (_label, override) => {
    expect(() =>
      validateProofBoundFormAssets({
        assets: [assetFor(pdfUpload, override)],
        uploads: [pdfUpload],
      })
    ).toThrow(MISMATCH);
  });

  it("rejects assets that fail the provider metadata schema outright", () => {
    for (const override of [
      { bytes: 10 * 1024 * 1024 + 1 },
      { bytes: 0 },
      { cloudinaryAssetId: "not-a-cloudinary-asset-id" },
      { cloudinaryVersion: "not-numeric" },
      { sha256: "short" },
      { uploadId: "not-a-uuid" },
    ]) {
      expect(() =>
        validateProofBoundFormAssets({
          assets: [assetFor(pdfUpload, override as Partial<FormSubmissionAsset>)],
          uploads: [pdfUpload],
        })
      ).toThrow();
    }
  });

  it("rejects a non-array or absent asset payload", () => {
    for (const assets of [null, undefined, {}, "[]"]) {
      expect(() => validateProofBoundFormAssets({ assets, uploads: [pdfUpload] })).toThrow(
        "A signed upload is missing or unexpected."
      );
    }
  });
});
