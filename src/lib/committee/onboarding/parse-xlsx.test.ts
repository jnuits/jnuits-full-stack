import { describe, expect, it } from "vitest";
import { createXlsxWorkbook } from "@/lib/exports/xlsx";
import { IntakeParseError, MAX_INTAKE_BYTES } from "./intake-contracts";
import {
  createIntakeTableFromWorkbookSheets,
  parseXlsxIntake,
  type ParsedWorkbookSheet,
} from "./parse-xlsx";

const sheets: ParsedWorkbookSheet[] = [
  {
    sheet: "Members",
    data: [
      ["JnUITS ID", "Full Name"],
      ["0007", "Ayesha Akter"],
    ],
  },
  {
    sheet: "Committee 6",
    data: [
      ["JnUITS ID", "Position"],
      ["0042", "President"],
    ],
  },
];

describe("XLSX intake", () => {
  it("discovers sheets and parses the selected one", () => {
    const table = createIntakeTableFromWorkbookSheets(sheets, "Committee 6");

    expect(table.availableSheets).toEqual(["Members", "Committee 6"]);
    expect(table.selectedSheet).toBe("Committee 6");
    expect(table.rows[0]).toEqual({
      sourceRowNumber: 2,
      values: { jnuits_id: "0042", position: "President" },
    });
  });

  it("rejects a sheet name that is not in the workbook", () => {
    expect(() => createIntakeTableFromWorkbookSheets(sheets, "Missing")).toThrowError(
      expect.objectContaining<Partial<IntakeParseError>>({ code: "sheet_not_found" })
    );
  });

  it("reads a real workbook buffer and preserves text identifiers", async () => {
    const workbook = createXlsxWorkbook(
      {
        columns: [
          { key: "id", label: "JnUITS ID" },
          { key: "name", label: "Full Name" },
        ],
        rows: [{ id: "0009", name: "Nusrat Jahan" }],
      },
      "Roster"
    );

    const table = await parseXlsxIntake(workbook, { sheet: "Roster" });

    expect(table.availableSheets).toEqual(["Roster"]);
    expect(table.rows[0]?.values.jnuits_id).toBe("0009");
  });

  it("rejects an oversized workbook before decompression", async () => {
    await expect(
      parseXlsxIntake(Buffer.alloc(MAX_INTAKE_BYTES + 1), { sheet: "Roster" })
    ).rejects.toMatchObject({ code: "source_too_large" });
  });
});
