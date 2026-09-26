export const MAX_INTAKE_BYTES = 2 * 1024 * 1024;
export const MAX_INTAKE_DATA_ROWS = 1_000;

export type IntakeParseErrorCode =
  | "blank_header"
  | "duplicate_header"
  | "empty_source"
  | "invalid_delimited_source"
  | "invalid_xlsx"
  | "row_width_mismatch"
  | "sheet_not_found"
  | "source_too_large"
  | "too_many_rows";

export class IntakeParseError extends Error {
  readonly code: IntakeParseErrorCode;
  readonly details: Record<string, unknown>;

  constructor(
    code: IntakeParseErrorCode,
    message: string,
    details: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = "IntakeParseError";
    this.code = code;
    this.details = details;
  }
}

export type IntakeHeader = {
  columnIndex: number;
  key: string;
  label: string;
};

export type IntakeRow = {
  sourceRowNumber: number;
  values: Record<string, string>;
};

export type IntakeTable = {
  availableSheets: string[];
  headers: IntakeHeader[];
  rows: IntakeRow[];
  selectedSheet: string | null;
};

export type IntakeScalar = string | number | boolean | Date | null | undefined;

export function intakeScalarToText(value: IntakeScalar): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

export function assertIntakeSourceSize(size: number) {
  if (size > MAX_INTAKE_BYTES) {
    throw new IntakeParseError(
      "source_too_large",
      `The source is larger than ${MAX_INTAKE_BYTES} bytes.`,
      { actualBytes: size, maximumBytes: MAX_INTAKE_BYTES }
    );
  }
}

function headerKey(label: string) {
  return label
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, "_")
    .replace(/^_+|_+$/g, "");
}

export function createIntakeTableFromRows(
  rawRows: readonly (readonly IntakeScalar[])[],
  sheet: { availableSheets?: readonly string[]; selectedSheet?: string | null } = {}
): IntakeTable {
  if (rawRows.length === 0) {
    throw new IntakeParseError("empty_source", "The source does not contain a header row.");
  }

  const rawHeaders = rawRows[0];
  if (rawHeaders.length === 0) {
    throw new IntakeParseError("empty_source", "The source does not contain any columns.");
  }

  const seenKeys = new Map<string, number>();
  const headers = rawHeaders.map((value, columnIndex): IntakeHeader => {
    const label = intakeScalarToText(value).replace(/^\uFEFF/, "").trim();
    const key = headerKey(label);

    if (!key) {
      throw new IntakeParseError("blank_header", "Every intake column needs a heading.", {
        column: columnIndex + 1,
      });
    }

    const firstColumn = seenKeys.get(key);
    if (firstColumn !== undefined) {
      throw new IntakeParseError("duplicate_header", `The heading "${label}" is duplicated.`, {
        column: columnIndex + 1,
        firstColumn: firstColumn + 1,
        key,
      });
    }

    seenKeys.set(key, columnIndex);
    return { columnIndex, key, label };
  });

  const dataRows = rawRows.slice(1);
  if (dataRows.length > MAX_INTAKE_DATA_ROWS) {
    throw new IntakeParseError(
      "too_many_rows",
      `The source contains more than ${MAX_INTAKE_DATA_ROWS} data rows.`,
      { actualRows: dataRows.length, maximumRows: MAX_INTAKE_DATA_ROWS }
    );
  }

  const rows = dataRows.map((rawRow, dataIndex): IntakeRow => {
    if (rawRow.length !== headers.length) {
      throw new IntakeParseError(
        "row_width_mismatch",
        `Source row ${dataIndex + 2} has ${rawRow.length} cells; expected ${headers.length}.`,
        {
          actualColumns: rawRow.length,
          expectedColumns: headers.length,
          sourceRowNumber: dataIndex + 2,
        }
      );
    }

    return {
      sourceRowNumber: dataIndex + 2,
      values: Object.fromEntries(
        headers.map((header) => [header.key, intakeScalarToText(rawRow[header.columnIndex])])
      ),
    };
  });

  return {
    availableSheets: [...(sheet.availableSheets ?? [])],
    headers,
    rows,
    selectedSheet: sheet.selectedSheet ?? null,
  };
}
