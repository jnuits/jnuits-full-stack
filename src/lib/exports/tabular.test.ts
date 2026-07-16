import { describe, expect, it } from "vitest";
import {
  createCsv,
  protectSpreadsheetCell,
  sha256,
} from "./tabular";
import { createWorksheetXml, createXlsxWorkbook } from "./xlsx";

describe("tabular exports", () => {
  it("neutralizes spreadsheet formulas while retaining normal text", () => {
    expect(protectSpreadsheetCell("=SUM(A1:A2)")).toBe("'=SUM(A1:A2)");
    expect(protectSpreadsheetCell("  @cmd")).toBe("'  @cmd");
    expect(protectSpreadsheetCell("Attendee name")).toBe("Attendee name");
  });

  it("emits UTF-8 CSV with quoted, formula-safe values", () => {
    const csv = createCsv({
      columns: [
        { key: "name", label: "Name" },
        { key: "note", label: "Note" },
      ],
      rows: [{ name: "Ada, Lovelace", note: "=2+2" }],
    });

    expect(csv).toContain('"Ada, Lovelace"');
    expect(csv).toContain('"\'=2+2"');
    expect(csv.startsWith("\uFEFF")).toBe(true);
  });

  it("creates a stable SHA-256 checksum for audit records", () => {
    expect(sha256("event-export")).toMatch(/^[a-f0-9]{64}$/);
  });

  it("creates a formula-safe XLSX workbook without a third-party package", () => {
    const table = {
      columns: [{ key: "value", label: "Value" }],
      rows: [{ value: "=1+1" }],
    };
    const worksheet = createWorksheetXml(table);
    const workbook = createXlsxWorkbook(table, "Event registrations");

    expect(worksheet).toContain("&apos;=1+1");
    expect(workbook.subarray(0, 2).toString("utf8")).toBe("PK");
    expect(workbook.length).toBeGreaterThan(500);
  });
});
