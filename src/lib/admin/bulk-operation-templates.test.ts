import { inflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";

import {
  BULK_OPERATION_TYPES,
  createBulkOperationIssue,
  createBulkOperationTemplate,
  getBulkOperationDefinition,
} from "./bulk-operation-templates";

const visibleOperations = [
  "legacy_member_import",
  "member_invite",
  "alumni_invite",
  "lifecycle_update",
  "role_update",
  "alumni_conversion",
  "account_deletion_review",
] as const;

function unzipLocalFiles(archive: Buffer) {
  const files = new Map<string, string>();
  let offset = 0;

  while (archive.readUInt32LE(offset) === 0x04034b50) {
    const compressionMethod = archive.readUInt16LE(offset + 8);
    const compressedSize = archive.readUInt32LE(offset + 18);
    const filenameLength = archive.readUInt16LE(offset + 26);
    const extraLength = archive.readUInt16LE(offset + 28);
    const filenameStart = offset + 30;
    const filename = archive
      .subarray(filenameStart, filenameStart + filenameLength)
      .toString("utf8");
    const dataStart = filenameStart + filenameLength + extraLength;
    const compressed = archive.subarray(dataStart, dataStart + compressedSize);
    const data = compressionMethod === 8 ? inflateRawSync(compressed) : compressed;
    files.set(filename, data.toString("utf8"));
    offset = dataStart + compressedSize;
  }

  return files;
}

describe("legacy bulk-operation template catalog", () => {
  it("covers every operation that the browser workspace exposes", () => {
    expect(BULK_OPERATION_TYPES).toEqual(visibleOperations);

    for (const operationType of visibleOperations) {
      const definition = getBulkOperationDefinition(operationType);

      expect(definition.label).not.toBe("");
      expect(definition.fields.length).toBeGreaterThan(0);
      expect(definition.fields).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            acceptedFormat: expect.any(String),
            example: expect.any(String),
            key: expect.any(String),
            label: expect.any(String),
            limits: expect.any(String),
            required: expect.any(Boolean),
          }),
        ])
      );
      expect(Object.keys(definition.sampleRow).sort()).toEqual(
        definition.fields.map(({ key }) => key).sort()
      );
    }
  });

  it.each(visibleOperations)(
    "generates separate blank and fictional sample artifacts for %s",
    (operationType) => {
      const blankCsv = createBulkOperationTemplate({
        format: "csv",
        kind: "blank",
        operationType,
      });
      const sampleCsv = createBulkOperationTemplate({
        format: "csv",
        kind: "sample",
        operationType,
      });
      const blankXlsx = createBulkOperationTemplate({
        format: "xlsx",
        kind: "blank",
        operationType,
      });
      const sampleXlsx = createBulkOperationTemplate({
        format: "xlsx",
        kind: "sample",
        operationType,
      });

      expect(blankCsv.filename).toBe(`jnuits-${operationType.replaceAll("_", "-")}-blank.csv`);
      expect(String(blankCsv.body).split("\r\n").filter(Boolean)).toHaveLength(1);
      expect(sampleCsv.filename).toBe(`jnuits-${operationType.replaceAll("_", "-")}-sample.csv`);
      expect(String(sampleCsv.body).split("\r\n").filter(Boolean)).toHaveLength(2);
      expect(String(sampleCsv.body)).toMatch(/sample|JNUITS-2099/i);
      expect(String(sampleCsv.body)).not.toMatch(/@(gmail|yahoo|outlook)\./i);
      expect(Buffer.isBuffer(blankXlsx.body)).toBe(true);
      expect((blankXlsx.body as Buffer).subarray(0, 2).toString("utf8")).toBe("PK");

      const files = unzipLocalFiles(sampleXlsx.body as Buffer);
      const workbook = files.get("xl/workbook.xml") ?? "";
      const instructions = files.get("xl/worksheets/sheet2.xml") ?? "";

      expect(workbook).toContain('sheet name="Import data"');
      expect(workbook).toContain('sheet name="Instructions"');
      expect(workbook).toContain('sheet name="Reference codes"');
      for (const field of getBulkOperationDefinition(operationType).fields) {
        expect(instructions).toContain(field.label);
        expect(instructions).toContain(field.acceptedFormat);
        expect(instructions).toContain(field.example);
      }
    }
  );

  it("builds row issues from the same lifecycle field definition used by downloads", () => {
    const issue = createBulkOperationIssue({
      code: "invalid_lifecycle_status",
      explanation: "Lifecycle status is not recognized.",
      field: "lifecycle_status",
      operationType: "lifecycle_update",
      receivedValue: "mystery",
      sourceRow: 4,
    });

    expect(issue).toEqual({
      acceptedFormat: "current, former, alumni, or deleted",
      code: "invalid_lifecycle_status",
      example: "current",
      explanation: "Lifecycle status is not recognized.",
      field: "lifecycle_status",
      receivedValue: "mystery",
      sourceRow: 4,
    });
  });

  it("keeps unexpected legacy columns actionable instead of crashing preview", () => {
    expect(
      createBulkOperationIssue({
        code: "unsupported_column_value",
        explanation: "This value is not used by the selected operation.",
        field: "email",
        operationType: "lifecycle_update",
        receivedValue: "duplicate@example.com",
        sourceRow: 3,
      })
    ).toMatchObject({
      acceptedFormat: "Use only fields listed for the selected operation.",
      example: "Download the blank template",
      field: "email",
      sourceRow: 3,
    });
  });

  it("documents that alumni invitations always create alumni profiles", () => {
    const definition = getBulkOperationDefinition("alumni_invite");
    expect(definition.fields.find(({ key }) => key === "member_type")?.acceptedFormat).toMatch(/always alumni/i);
  });
});
