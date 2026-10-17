import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/cloudinary/config", () => ({
  getCloudinaryConfig: () => ({ apiKey: "key", apiSecret: "secret", cloudName: "test-cloud" }),
}));

import { buildSignedCloudinaryFormAssetUrl, loadVerifiedCloudinaryFormAsset } from "./cloudinary-assets";

const formDefinitionId = "22222222-2222-4222-8222-222222222222";
const formVersionId = "33333333-3333-4333-8333-333333333333";
const ownership = { expectedFormDefinitionId: formDefinitionId, expectedFormVersionId: formVersionId };
const asset = {
  bytes: 1024,
  cloudinaryAssetId: "a".repeat(32),
  cloudinaryFolder: "jnuits/jnuits-full-stack/private/forms/form/session",
  cloudinaryPublicId: "11111111-1111-4111-8111-111111111111.pdf",
  cloudinaryVersion: "1234567890",
  contentType: "application/pdf" as const,
  fieldId: "identity_document",
  resourceType: "raw" as const,
  sha256: "b".repeat(64),
  uploadId: "11111111-1111-4111-8111-111111111111",
};

function providerDetails(overrides: Record<string, unknown> = {}) {
  return {
    asset_folder: asset.cloudinaryFolder,
    asset_id: asset.cloudinaryAssetId,
    bytes: asset.bytes,
    context: { custom: {
      field_id: asset.fieldId,
      form_definition_id: formDefinitionId,
      form_version_id: formVersionId,
      sha256: asset.sha256,
      upload_id: asset.uploadId,
    } },
    format: "pdf",
    public_id: asset.cloudinaryPublicId,
    resource_type: "raw",
    type: "authenticated",
    version: Number(asset.cloudinaryVersion),
    ...overrides,
  };
}

describe("Cloudinary form asset verification", () => {
  beforeEach(() => vi.clearAllMocks());

  it("accepts exact authenticated provider metadata and form ownership", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify(providerDetails()), { status: 200 }));
    await expect(loadVerifiedCloudinaryFormAsset(asset, { ...ownership, fetchImpl })).resolves.toMatchObject({ type: "authenticated" });
    expect(fetchImpl).toHaveBeenCalledWith(expect.stringContaining(`/resources/${asset.cloudinaryAssetId}`),
      expect.objectContaining({ headers: { Authorization: expect.stringMatching(/^Basic /) } }));
  });
  it("accepts native raw PDF metadata without an image format field", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify(providerDetails({ format: undefined })), { status: 200 }));
    await expect(loadVerifiedCloudinaryFormAsset(asset, { ...ownership, fetchImpl })).resolves.toMatchObject({ resource_type: "raw", type: "authenticated" });
  });
  it("still requires an image format and the expected resource type", async () => {
    const image = { ...asset, contentType: "image/png" as const, resourceType: "image" as const };
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify(providerDetails({ format: undefined, resource_type: "image" })), { status: 200 }));
    await expect(loadVerifiedCloudinaryFormAsset(image, { ...ownership, fetchImpl })).rejects.toThrow("does not match");
  });

  it.each([
    ["public delivery", { type: "upload" }],
    ["wrong bytes", { bytes: 2048 }],
    ["wrong format", { format: "exe" }],
    ["wrong field", { context: { custom: { ...providerDetails().context.custom, field_id: "other_field" } } }],
    ["wrong form", { context: { custom: { ...providerDetails().context.custom, form_definition_id: "44444444-4444-4444-8444-444444444444" } } }],
    ["wrong version", { context: { custom: { ...providerDetails().context.custom, form_version_id: "55555555-5555-4555-8555-555555555555" } } }],
    ["wrong checksum", { context: { custom: { ...providerDetails().context.custom, sha256: "c".repeat(64) } } }],
  ])("rejects %s", async (_label, overrides) => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify(providerDetails(overrides)), { status: 200 }));
    await expect(loadVerifiedCloudinaryFormAsset(asset, { ...ownership, fetchImpl })).rejects.toThrow("does not match");
  });

  it("builds an authenticated signed delivery URL without exposing the secret", () => {
    const url = buildSignedCloudinaryFormAssetUrl(asset);
    expect(url).toMatch(/^https:\/\/res\.cloudinary\.com\/test-cloud\/raw\/authenticated\/s--[A-Za-z0-9_-]{8}--\/v1234567890\//);
    expect(url).not.toContain("secret");
  });
  it.each([
    [asset, "11111111-1111-4111-8111-111111111111.pdf"],
    [{ ...asset, resourceType: "image" as const, contentType: "image/jpeg" as const, cloudinaryPublicId: "portrait" }, "portrait.jpg"],
  ])("preserves the provider-supported version-inclusive delivery signature", (input, leaf) => {
    const signature = createHash("sha256").update(`v1234567890/${leaf}secret`).digest("base64url").slice(0, 8);
    expect(buildSignedCloudinaryFormAssetUrl(input)).toBe(`https://res.cloudinary.com/test-cloud/${input.resourceType}/authenticated/s--${signature}--/v1234567890/${leaf}`);
    expect(buildSignedCloudinaryFormAssetUrl({ ...input, cloudinaryVersion: "1234567891" })).not.toContain(`/s--${signature}--/`);
  });
});
