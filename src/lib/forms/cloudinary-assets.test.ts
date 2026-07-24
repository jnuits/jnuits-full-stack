import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/cloudinary/config", () => ({
  getCloudinaryConfig: () => ({ apiKey: "key", apiSecret: "secret", cloudName: "test-cloud" }),
}));

import { buildSignedCloudinaryFormAssetUrl, loadVerifiedCloudinaryFormAsset } from "./cloudinary-assets";

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
      form_definition_id: "22222222-2222-4222-8222-222222222222",
      form_version_id: "33333333-3333-4333-8333-333333333333",
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

  it("accepts exact authenticated provider metadata", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify(providerDetails()), { status: 200 }));
    await expect(loadVerifiedCloudinaryFormAsset(asset, { fetchImpl })).resolves.toMatchObject({ type: "authenticated" });
    expect(fetchImpl).toHaveBeenCalledWith(expect.stringContaining(`/resources/${asset.cloudinaryAssetId}`),
      expect.objectContaining({ headers: { Authorization: expect.stringMatching(/^Basic /) } }));
  });

  it.each([
    ["public delivery", { type: "upload" }],
    ["wrong bytes", { bytes: 2048 }],
    ["wrong format", { format: "exe" }],
    ["wrong ownership", { context: { custom: { ...providerDetails().context.custom, field_id: "other_field" } } }],
    ["wrong checksum", { context: { custom: { ...providerDetails().context.custom, sha256: "c".repeat(64) } } }],
  ])("rejects %s", async (_label, overrides) => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify(providerDetails(overrides)), { status: 200 }));
    await expect(loadVerifiedCloudinaryFormAsset(asset, { fetchImpl })).rejects.toThrow("does not match");
  });

  it("builds an authenticated signed delivery URL without exposing the secret", () => {
    const url = buildSignedCloudinaryFormAssetUrl(asset);
    expect(url).toMatch(/^https:\/\/res\.cloudinary\.com\/test-cloud\/raw\/authenticated\/s--[A-Za-z0-9_-]{8}--\/v1234567890\//);
    expect(url).not.toContain("secret");
  });
});
