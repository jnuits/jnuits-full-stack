import { afterEach, describe, expect, it } from "vitest";
import {
  createFormArchiveMaterials,
  signRetentionArchiveManifest,
} from "./archive";

const originalSecret = process.env.RETENTION_MANIFEST_SIGNING_SECRET;

afterEach(() => {
  if (originalSecret === undefined) {
    delete process.env.RETENTION_MANIFEST_SIGNING_SECRET;
  } else {
    process.env.RETENTION_MANIFEST_SIGNING_SECRET = originalSecret;
  }
});

describe("retention archive materials", () => {
  it("builds private form archive files and retains immutable asset references", () => {
    process.env.RETENTION_MANIFEST_SIGNING_SECRET = "test-only-retention-secret";
    const materials = createFormArchiveMaterials("form-1", [
      {
        answers: { full_name: "=formula", note: "Private note" },
        assets: [
          {
            bytes: 42,
            cloudinary_asset_id: "asset-1",
            cloudinary_folder: "forms/uuid",
            cloudinary_public_id: "uuid",
            cloudinary_version: "1730000000",
            content_type: "application/pdf",
            field_id: "attachment",
            sha256: "a".repeat(64),
          },
        ],
        confirmation_status: "confirmed",
        created_at: "2023-01-01T00:00:00.000Z",
        form_version_id: "version-1",
        id: "submission-1",
        review_status: "approved",
        submitter_email: "person@example.test",
      },
    ]);
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
    expect(signed.manifest.assetReferences).toEqual([
      expect.objectContaining({ assetId: "asset-1", sha256: "a".repeat(64) }),
    ]);
    expect(JSON.stringify(signed)).not.toContain("http");
    expect(signed.signature).toMatch(/^[a-f0-9]{64}$/);
  });

  it("refuses to sign when archive signing is not configured", () => {
    delete process.env.RETENTION_MANIFEST_SIGNING_SECRET;

    expect(() =>
      signRetentionArchiveManifest({
        archivedAt: "2026-07-22T00:00:00.000Z",
        assetReferences: [],
        files: [],
        resourceId: "form-1",
        rowCount: 0,
        scope: "form",
      })
    ).toThrow("Retention manifest signing is not configured.");
  });
});
