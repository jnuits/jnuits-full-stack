import { afterEach, describe, expect, it } from "vitest";
import { signRetentionArchiveManifest } from "./archive";
import { parseVerifiedRetentionArchiveRecord, RetentionArchiveVerificationError } from "./approval";

const originalSecret = process.env.RETENTION_MANIFEST_SIGNING_SECRET;
afterEach(() => {
  if (originalSecret === undefined) delete process.env.RETENTION_MANIFEST_SIGNING_SECRET;
  else process.env.RETENTION_MANIFEST_SIGNING_SECRET = originalSecret;
});

function signedManifest() {
  process.env.RETENTION_MANIFEST_SIGNING_SECRET = "test-only-retention-secret";
  return signRetentionArchiveManifest({
    archivedAt: "2026-07-24T12:00:00.000Z",
    assetReferences: [],
    files: [{ bytes: 100, id: "drive-file", name: "archive.csv", sha256: "a".repeat(64) }],
    resourceId: "form-1",
    rowCount: 1,
    scope: "form",
  });
}

describe("retention purge approval archive gate", () => {
  it("accepts only an archived job with checksum and valid signature", () => {
    const archive = signedManifest();
    expect(parseVerifiedRetentionArchiveRecord({
      archive_manifest: archive,
      manifest_checksum_sha256: "b".repeat(64),
      status: "archived",
    })).toEqual(archive);
  });

  it.each([
    ["candidate", "b".repeat(64), "Archive must complete"],
    ["archived", null, "checksum verification is missing"],
  ])("rejects status %s", (status, checksum, message) => {
    expect(() => parseVerifiedRetentionArchiveRecord({
      archive_manifest: signedManifest(),
      manifest_checksum_sha256: checksum,
      status,
    })).toThrow(message);
  });

  it("rejects a tampered archive signature", () => {
    const archive = signedManifest();
    archive.manifest.rowCount = 9;
    expect(() => parseVerifiedRetentionArchiveRecord({
      archive_manifest: archive,
      manifest_checksum_sha256: "b".repeat(64),
      status: "archived",
    })).toThrow(RetentionArchiveVerificationError);
  });
});
