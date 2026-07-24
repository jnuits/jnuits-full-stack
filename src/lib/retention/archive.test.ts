import { afterEach, describe, expect, it } from "vitest";
import {
  createFormArchiveMaterials,
  signRetentionArchiveManifest,
  verifyRetentionArchiveManifest,
} from "./archive";

const originalSecret = process.env.RETENTION_MANIFEST_SIGNING_SECRET;
afterEach(() => {
  if (originalSecret === undefined) delete process.env.RETENTION_MANIFEST_SIGNING_SECRET;
  else process.env.RETENTION_MANIFEST_SIGNING_SECRET = originalSecret;
});

function validSignedManifest() {
  return signRetentionArchiveManifest({
    archivedAt: "2026-07-22T00:00:00.000Z",
    assetReferences: [],
    files: [{ bytes: 42, id: "drive-csv", name: "submissions.csv", sha256: "b".repeat(64) }],
    resourceId: "form-1",
    rowCount: 1,
    scope: "form",
  });
}

describe("retention archive materials", () => {
  it("builds CSV/JSON/XLSX and retains immutable asset references without URLs", () => {
    process.env.RETENTION_MANIFEST_SIGNING_SECRET = "test-only-retention-secret";
    const materials = createFormArchiveMaterials("form-1", [{
      answers: { full_name: "=formula", note: "Private note" },
      assets: [{ bytes: 42, cloudinary_asset_id: "asset-1", cloudinary_folder: "forms/uuid", cloudinary_public_id: "uuid", cloudinary_version: "1730000000", content_type: "application/pdf", field_id: "attachment", sha256: "a".repeat(64) }],
      confirmation_status: "confirmed",
      created_at: "2023-01-01T00:00:00.000Z",
      form_version_id: "version-1",
      id: "submission-1",
      review_status: "approved",
      submitter_email: "person@example.test",
    }]);
    const signed = signRetentionArchiveManifest({
      archivedAt: "2026-07-22T00:00:00.000Z",
      assetReferences: materials.assetReferences,
      files: [{ bytes: materials.csv.length, id: "drive-csv", name: "submissions.csv", sha256: "b".repeat(64) }],
      resourceId: "form-1",
      rowCount: materials.rowCount,
      scope: "form",
    });
    expect(materials.csv.toString("utf8")).toContain("'=formula");
    expect(materials.xlsx.subarray(0, 2).toString("utf8")).toBe("PK");
    expect(JSON.parse(materials.json.toString("utf8"))).toMatchObject({ formDefinitionId: "form-1", schemaVersion: 1 });
    expect(signed.manifest.assetReferences).toEqual([expect.objectContaining({ assetId: "asset-1", sha256: "a".repeat(64) })]);
    expect(JSON.stringify(signed)).not.toContain("http");
    expect(verifyRetentionArchiveManifest(signed)).toBe(true);
  });

  it("rejects tampered, incomplete, and unsigned manifests", () => {
    process.env.RETENTION_MANIFEST_SIGNING_SECRET = "test-only-retention-secret";
    const signed = validSignedManifest();
    const tampered = structuredClone(signed);
    tampered.manifest.rowCount = 2;
    expect(verifyRetentionArchiveManifest(tampered)).toBe(false);
    expect(() => signRetentionArchiveManifest({ archivedAt: "2026-07-22T00:00:00.000Z", assetReferences: [], files: [], resourceId: "form-1", rowCount: 0, scope: "form" })).toThrow("incomplete or unverified");
    delete process.env.RETENTION_MANIFEST_SIGNING_SECRET;
    expect(verifyRetentionArchiveManifest(signed)).toBe(false);
  });
});
