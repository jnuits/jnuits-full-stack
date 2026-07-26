import { afterEach, describe, expect, it } from "vitest";
import {
  createFormArchiveMaterials,
  serializeRetentionArchiveManifest,
  signRetentionArchiveManifest,
  verifyRetentionArchiveManifest,
} from "./archive";

const originalSecret = process.env.RETENTION_MANIFEST_SIGNING_SECRET;
afterEach(() => {
  if (originalSecret === undefined) delete process.env.RETENTION_MANIFEST_SIGNING_SECRET;
  else process.env.RETENTION_MANIFEST_SIGNING_SECRET = originalSecret;
});

const BOUNDARY = "2023-07-22T00:00:00.000Z";
const ARCHIVED_AT = "2026-07-22T00:00:00.000Z";

function validSignedManifest() {
  return signRetentionArchiveManifest({
    archivedAt: ARCHIVED_AT,
    assetReferences: [],
    boundary: BOUNDARY,
    files: [{ bytes: 42, id: "drive-csv", name: "submissions.csv", sha256: "b".repeat(64) }],
    resourceId: "form-1",
    rowCount: 1,
    scope: "form",
  });
}

function reverseObjectKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => reverseObjectKeys(item));
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .reverse()
      .map(([key, item]) => [key, reverseObjectKeys(item)])
  );
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
      archivedAt: ARCHIVED_AT,
      assetReferences: materials.assetReferences,
      boundary: BOUNDARY,
      files: [{ bytes: 42, id: "drive-csv", name: "submissions.csv", sha256: "b".repeat(64) }],
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

  it("records the retention boundary inside the signed payload", () => {
    process.env.RETENTION_MANIFEST_SIGNING_SECRET = "test-only-retention-secret";
    const signed = validSignedManifest();
    expect(signed.manifest).toMatchObject({ boundary: BOUNDARY, schemaVersion: 2 });
    expect(verifyRetentionArchiveManifest(signed)).toBe(true);
  });

  it("survives jsonb-style object-key reordering", () => {
    process.env.RETENTION_MANIFEST_SIGNING_SECRET = "test-only-retention-secret";
    const signed = validSignedManifest();
    const reordered = reverseObjectKeys(signed) as ReturnType<typeof validSignedManifest>;

    expect(verifyRetentionArchiveManifest(reordered)).toBe(true);
    expect(serializeRetentionArchiveManifest(reordered)).toBe(
      serializeRetentionArchiveManifest(signed)
    );
  });

  it("detects a tampered boundary, because purge trusts it", () => {
    process.env.RETENTION_MANIFEST_SIGNING_SECRET = "test-only-retention-secret";
    const signed = validSignedManifest();
    const widened = structuredClone(signed);
    widened.manifest.boundary = "2026-07-22T00:00:00.000Z";
    expect(verifyRetentionArchiveManifest(widened)).toBe(false);
  });

  it("refuses to sign a missing, malformed, or future boundary", () => {
    process.env.RETENTION_MANIFEST_SIGNING_SECRET = "test-only-retention-secret";
    const base = {
      archivedAt: ARCHIVED_AT,
      assetReferences: [],
      files: [{ bytes: 42, id: "drive-csv", name: "submissions.csv", sha256: "b".repeat(64) }],
      resourceId: "form-1",
      rowCount: 1,
      scope: "form" as const,
    };
    expect(() => signRetentionArchiveManifest({ ...base, boundary: "" })).toThrow("boundary is incomplete");
    expect(() => signRetentionArchiveManifest({ ...base, boundary: "not-a-date" })).toThrow("boundary is incomplete");
    expect(() => signRetentionArchiveManifest({ ...base, boundary: "2026-07-23T00:00:00.000Z" }))
      .toThrow("cannot be later than the archive time");
  });

  it("rejects tampered, incomplete, and unsigned manifests", () => {
    process.env.RETENTION_MANIFEST_SIGNING_SECRET = "test-only-retention-secret";
    const signed = validSignedManifest();
    const tampered = structuredClone(signed);
    tampered.manifest.rowCount = 2;
    expect(verifyRetentionArchiveManifest(tampered)).toBe(false);
    expect(() => signRetentionArchiveManifest({ archivedAt: ARCHIVED_AT, assetReferences: [], boundary: BOUNDARY, files: [], resourceId: "form-1", rowCount: 0, scope: "form" })).toThrow("incomplete or unverified");
    delete process.env.RETENTION_MANIFEST_SIGNING_SECRET;
    expect(verifyRetentionArchiveManifest(signed)).toBe(false);
  });
});
