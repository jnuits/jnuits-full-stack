import { inflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";

import { createXlsxWorkbookFromSheets } from "@/lib/exports/xlsx";
import { inferColumnMapping, ONBOARDING_FIELD_CATALOG } from "./field-catalog";
import { createIntakeTableFromRows } from "./intake-contracts";
import { parseXlsxIntake } from "./parse-xlsx";
import {
  createOnboardingTemplate,
  getOnboardingTemplateColumns,
} from "./templates";

const departments = [
  { name: "Computer Science & Engineering", shortCode: "CSE" },
  { name: "Accounting & Information Systems", shortCode: "AIS" },
];

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

describe("committee onboarding templates", () => {
  it("keeps member-profile templates free of sample member data", () => {
    const template = createOnboardingTemplate({
      departments,
      format: "csv",
      kind: "blank",
      operationType: "member_profile_import",
    });
    const csv = String(template.body);

    expect(template.filename).toBe("jnuits-member-profile-import-blank.csv");
    expect(template.contentType).toContain("text/csv");
    expect(csv).toContain("Full name");
    expect(csv).toContain("JnUITS ID");
    expect(csv).toContain("Classification");
    expect(csv).toContain("Joining date");
    expect(csv.split("\r\n").filter(Boolean)).toHaveLength(1);
    expect(csv).not.toMatch(/@[a-z0-9.-]+\.[a-z]{2,}/i);
    expect(csv).not.toContain("JNUITS-202");
  });

  it("adds appointment columns only to committee-roster templates", () => {
    const memberLabels = getOnboardingTemplateColumns("member_profile_import").map(
      ({ label }) => label
    );
    const committeeLabels = getOnboardingTemplateColumns("committee_roster_import").map(
      ({ label }) => label
    );

    expect(memberLabels).not.toContain("Position");
    expect(committeeLabels).toEqual(
      expect.arrayContaining(["Position", "Starts on", "Order", "Public"])
    );
    expect(committeeLabels).not.toContain("Committee");
  });

  it("makes every generated heading recognizable by the shared mapper", () => {
    const columns = getOnboardingTemplateColumns("member_profile_import");
    const table = createIntakeTableFromRows([columns.map(({ label }) => label)]);
    const mapping = inferColumnMapping(table.headers);

    expect(Object.keys(mapping)).toEqual(columns.map(({ key }) => key));
  });

  it("creates a valid XLSX download envelope with no source rows", () => {
    const template = createOnboardingTemplate({
      departments,
      format: "xlsx",
      kind: "blank",
      operationType: "committee_roster_import",
    });

    expect(template.filename).toBe("jnuits-committee-roster-import-blank.xlsx");
    expect(template.contentType).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    expect(Buffer.isBuffer(template.body)).toBe(true);
    expect((template.body as Buffer).subarray(0, 2).toString("utf8")).toBe("PK");
  });

  it("creates a fictional CSV sample with an exact two-digit alumni batch", () => {
    const template = createOnboardingTemplate({
      departments,
      format: "csv",
      kind: "sample",
      operationType: "member_profile_import",
    });
    const csv = String(template.body);

    expect(template.filename).toBe("jnuits-member-profile-import-sample.csv");
    expect(csv).toContain('"08"');
    expect(csv).toContain("sample.member@example.com");
    expect(csv).toContain("JNUITS-2099001");
    expect(csv).not.toMatch(/@(gmail|yahoo|outlook)\./i);
    expect(csv).not.toMatch(/JNUITS-202[0-8]\d{3}/);
    expect(csv).not.toContain('"=');
  });

  it("creates a linked three-sheet XLSX sample from live guidance data", async () => {
    const template = createOnboardingTemplate({
      departments,
      format: "xlsx",
      kind: "sample",
      operationType: "member_profile_import",
    });
    const files = unzipLocalFiles(template.body as Buffer);
    const workbook = files.get("xl/workbook.xml") ?? "";
    const relationships = files.get("xl/_rels/workbook.xml.rels") ?? "";
    const instructions = files.get("xl/worksheets/sheet2.xml") ?? "";
    const departmentCodes = files.get("xl/worksheets/sheet3.xml") ?? "";
    const batchDefinition = ONBOARDING_FIELD_CATALOG.find(
      ({ field }) => field === "batchNo"
    );

    expect(template.filename).toBe("jnuits-member-profile-import-sample.xlsx");
    expect(workbook).toContain('sheet name="Member profiles" sheetId="1" r:id="rId1"');
    expect(workbook).toContain('sheet name="Instructions" sheetId="2" r:id="rId2"');
    expect(workbook).toContain('sheet name="Department codes" sheetId="3" r:id="rId3"');
    expect(relationships).toContain('Id="rId1"');
    expect(relationships).toContain('Target="worksheets/sheet1.xml"');
    expect(relationships).toContain('Id="rId2"');
    expect(relationships).toContain('Target="worksheets/sheet2.xml"');
    expect(relationships).toContain('Id="rId3"');
    expect(relationships).toContain('Target="worksheets/sheet3.xml"');
    expect(files.has("xl/worksheets/sheet1.xml")).toBe(true);
    expect(files.has("xl/worksheets/sheet2.xml")).toBe(true);
    expect(files.has("xl/worksheets/sheet3.xml")).toBe(true);
    expect(instructions).toContain(batchDefinition?.acceptedFormat);
    expect(instructions).toContain(batchDefinition?.example);
    expect(departmentCodes).toContain("CSE");
    expect(departmentCodes).toContain("Computer Science &amp; Engineering");
    expect(departmentCodes).not.toContain("computer-science-engineering");

    const parsed = await parseXlsxIntake(template.body as Buffer, {
      sheet: "Member profiles",
    });
    expect(parsed.availableSheets).toEqual([
      "Member profiles",
      "Instructions",
      "Department codes",
    ]);
    expect(parsed.rows[0]?.values.batch).toBe("08");
    expect(parsed.rows[0]?.values.department).toBe("CSE");
  });

  it("makes department reference downloads public-facing and formula-safe", () => {
    const template = createOnboardingTemplate({
      departments: [
        ...departments,
        { name: '=HYPERLINK("https://bad.test")', shortCode: "SAFE" },
      ],
      format: "xlsx",
      kind: "department-codes",
      operationType: "member_profile_import",
    });
    const files = unzipLocalFiles(template.body as Buffer);
    const worksheet = files.get("xl/worksheets/sheet1.xml") ?? "";

    expect(template.filename).toBe("jnuits-department-codes.xlsx");
    expect(worksheet).toContain("Department code");
    expect(worksheet).toContain("Department name");
    expect(worksheet).toContain("&apos;=HYPERLINK");
    expect(worksheet).not.toContain("sort_order");
    expect(worksheet).not.toContain("department_code");
  });

  it("creates a separate department-code CSV without internal catalog fields", () => {
    const template = createOnboardingTemplate({
      departments,
      format: "csv",
      kind: "department-codes",
      operationType: "member_profile_import",
    });
    const csv = String(template.body);

    expect(template.filename).toBe("jnuits-department-codes.csv");
    expect(csv).toContain('"CSE","Computer Science & Engineering"');
    expect(csv).not.toContain("computer-science-engineering");
    expect(csv).not.toContain("sort_order");
  });

  it("sanitizes and deduplicates worksheet names while keeping relationships valid", () => {
    const table = { columns: [{ key: "value", label: "Value" }], rows: [] };
    const workbook = createXlsxWorkbookFromSheets([
      { name: "Invalid/Name*", table },
      { name: "Invalid:Name?", table },
      { name: "[]", table },
      { name: "A very long worksheet name that exceeds thirty one characters", table },
    ]);
    const files = unzipLocalFiles(workbook);
    const workbookXml = files.get("xl/workbook.xml") ?? "";

    expect(workbookXml).toContain('sheet name="Invalid Name"');
    expect(workbookXml).toContain('sheet name="Invalid Name (2)"');
    expect(workbookXml).toContain('sheet name="Export"');
    expect(workbookXml).toContain('sheet name="A very long worksheet name that"');
    expect(files.has("xl/worksheets/sheet4.xml")).toBe(true);
  });
});
