import { describe, expect, it } from "vitest";
import { committeeDraftMetadataSchema, parseCommitteeDraftMetadata } from "./contracts";

const digest = "a".repeat(64);

describe("committee onboarding draft metadata", () => {
  it("accepts an XLSX committee draft with Bengali mappings", () => {
    const metadata = parseCommitteeDraftMetadata({
      columnMapping: { "ইমেইল": "email", "নাম": "fullName" },
      operationType: "committee_roster_import",
      originalFilename: "committee-6.xlsx",
      schemaVersion: 1,
      sheetName: "Committee 6",
      sourceKind: "xlsx",
      sourceSha256: digest,
      targetTermId: "a53b45fc-c338-42a5-adec-db5350f580a3",
      targetTermUpdatedAt: "2026-09-26T05:49:27.000Z",
    });

    expect(metadata.sourceKind).toBe("xlsx");
    expect(metadata.columnMapping["নাম"]).toBe("fullName");
  });

  it("rejects a file or pasted source without a SHA-256 digest", () => {
    for (const sourceKind of ["csv", "xlsx", "pasted_tsv", "google_sheet"] as const) {
      expect(
        committeeDraftMetadataSchema.safeParse({
          columnMapping: {},
          operationType: "member_profile_import",
          schemaVersion: 1,
          sourceKind,
          targetTermId: null,
        }).success,
      ).toBe(false);
    }
  });

  it("accepts only sanitized provenance for Google Sheet snapshots", () => {
    const metadata = parseCommitteeDraftMetadata({
      columnMapping: {},
      googleSheet: {
        documentId: "test-sheet-document-123",
        fetchedAt: "2026-09-30T04:00:00.000Z",
        sheetId: "42",
      },
      operationType: "member_profile_import",
      schemaVersion: 1,
      sourceKind: "google_sheet",
      sourceSha256: digest,
      targetTermId: null,
    });

    expect(metadata.googleSheet).toEqual({
      documentId: "test-sheet-document-123",
      fetchedAt: "2026-09-30T04:00:00.000Z",
      sheetId: "42",
    });
    expect(JSON.stringify(metadata)).not.toContain("docs.google.com");
  });

  it("requires Google provenance only for Google Sheet sources", () => {
    const base = {
      columnMapping: {},
      operationType: "member_profile_import",
      schemaVersion: 1,
      sourceSha256: digest,
      targetTermId: null,
    };

    expect(
      committeeDraftMetadataSchema.safeParse({
        ...base,
        sourceKind: "google_sheet",
      }).success
    ).toBe(false);
    expect(
      committeeDraftMetadataSchema.safeParse({
        ...base,
        googleSheet: {
          documentId: "test-sheet-document-123",
          fetchedAt: "2026-09-30T04:00:00.000Z",
          sheetId: "42",
        },
        sourceKind: "csv",
      }).success
    ).toBe(false);
  });

  it("requires a target term only for committee roster imports", () => {
    expect(
      committeeDraftMetadataSchema.safeParse({
        columnMapping: {},
        operationType: "committee_roster_import",
        schemaVersion: 1,
        sourceKind: "manual",
        targetTermId: null,
      }).success,
    ).toBe(false);
    expect(
      committeeDraftMetadataSchema.safeParse({
        columnMapping: {},
        operationType: "member_profile_import",
        schemaVersion: 1,
        sourceKind: "manual",
        targetTermId: "a53b45fc-c338-42a5-adec-db5350f580a3",
      }).success,
    ).toBe(false);
  });

  it("requires the target term concurrency token only for committee roster imports", () => {
    expect(
      committeeDraftMetadataSchema.safeParse({
        columnMapping: {},
        operationType: "committee_roster_import",
        schemaVersion: 1,
        sourceKind: "manual",
        targetTermId: "a53b45fc-c338-42a5-adec-db5350f580a3",
      }).success
    ).toBe(false);
    expect(
      committeeDraftMetadataSchema.safeParse({
        columnMapping: {},
        operationType: "member_profile_import",
        schemaVersion: 1,
        sourceKind: "manual",
        targetTermId: null,
        targetTermUpdatedAt: "2026-09-26T05:49:27.000Z",
      }).success
    ).toBe(false);
  });

  it("rejects unsupported operation and source kinds", () => {
    expect(
      committeeDraftMetadataSchema.safeParse({
        columnMapping: {},
        operationType: "content_publish",
        schemaVersion: 1,
        sourceKind: "google_sheet_sync",
        targetTermId: null,
      }).success,
    ).toBe(false);
  });
});
