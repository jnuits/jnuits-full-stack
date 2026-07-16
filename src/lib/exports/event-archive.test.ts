import { afterEach, describe, expect, it } from "vitest";
import {
  archiveDriveFile,
  createEventArchiveMaterials,
  signEventArchiveManifest,
} from "./event-archive";

const originalSecret = process.env.RETENTION_MANIFEST_SIGNING_SECRET;

afterEach(() => {
  if (originalSecret === undefined) {
    delete process.env.RETENTION_MANIFEST_SIGNING_SECRET;
  } else {
    process.env.RETENTION_MANIFEST_SIGNING_SECRET = originalSecret;
  }
});

describe("event archive manifest", () => {
  it("builds archive files and a signed manifest without expiring media URLs", () => {
    process.env.RETENTION_MANIFEST_SIGNING_SECRET = "test-only-manifest-secret";
    const materials = createEventArchiveMaterials("event-1", [
      {
        cancelled_at: null,
        checked_in_at: null,
        created_at: "2023-01-01T00:00:00.000Z",
        promoted_at: null,
        registration_code: "CODE1234",
        registration_status: "confirmed",
        registrant_email: "attendee@example.test",
        registrant_name: "Attendee",
        registrant_phone: null,
        waitlisted_at: null,
      },
    ]);
    const signed = signEventArchiveManifest({
      archivedAt: "2026-07-16T00:00:00.000Z",
      eventId: "event-1",
      files: [archiveDriveFile("registrations.csv", "drive-file-1", materials.csv)],
      rowCount: materials.rowCount,
    });

    expect(materials.xlsx.subarray(0, 2).toString("utf8")).toBe("PK");
    expect(signed.manifest.assetReferences).toEqual([]);
    expect(signed.manifest.files[0]).toMatchObject({
      id: "drive-file-1",
      name: "registrations.csv",
    });
    expect(signed.signature).toMatch(/^[a-f0-9]{64}$/);
  });
});

