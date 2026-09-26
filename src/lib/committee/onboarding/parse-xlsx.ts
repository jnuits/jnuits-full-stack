import "server-only";

import readWorkbook from "read-excel-file/node";
import {
  assertIntakeSourceSize,
  createIntakeTableFromRows,
  IntakeParseError,
  type IntakeScalar,
  type IntakeTable,
} from "./intake-contracts";

export type ParsedWorkbookSheet = {
  data: IntakeScalar[][];
  sheet: string;
};

export function createIntakeTableFromWorkbookSheets(
  sheets: readonly ParsedWorkbookSheet[],
  selectedSheet?: string
): IntakeTable {
  if (sheets.length === 0) {
    throw new IntakeParseError("empty_source", "The workbook does not contain any sheets.");
  }

  const availableSheets = sheets.map(({ sheet }) => sheet);
  const selected = selectedSheet ?? availableSheets[0];
  const worksheet = sheets.find(({ sheet }) => sheet === selected);

  if (!worksheet) {
    throw new IntakeParseError("sheet_not_found", `The sheet "${selected}" was not found.`, {
      availableSheets,
      selectedSheet: selected,
    });
  }

  return createIntakeTableFromRows(worksheet.data, {
    availableSheets,
    selectedSheet: worksheet.sheet,
  });
}

export async function parseXlsxIntake(
  source: Buffer,
  options: { sheet?: string } = {}
): Promise<IntakeTable> {
  assertIntakeSourceSize(source.byteLength);

  try {
    const sheets = (await readWorkbook(source)) as ParsedWorkbookSheet[];
    return createIntakeTableFromWorkbookSheets(sheets, options.sheet);
  } catch (error) {
    if (error instanceof IntakeParseError) throw error;
    throw new IntakeParseError(
      "invalid_xlsx",
      error instanceof Error ? error.message : "The workbook could not be parsed."
    );
  }
}
