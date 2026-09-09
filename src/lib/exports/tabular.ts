import "server-only";

import { createHash } from "node:crypto";

export type ExportColumn = {
  key: string;
  label: string;
};

export type ExportTable = {
  columns: readonly ExportColumn[];
  rows: readonly Record<string, unknown>[];
};

function asText(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return String(value);
}

/** Prevent CSV/XLSX readers from evaluating an exported value as a formula. */
export function protectSpreadsheetCell(value: unknown) {
  const text = asText(value);

  return /^[\t\r\n ]*[=+\-@]/.test(text) ? `'${text}` : text;
}

export function escapeXml(value: unknown) {
  return protectSpreadsheetCell(value)
    .slice(0, 32_767)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function csvCell(value: unknown) {
  return `"${protectSpreadsheetCell(value).replace(/"/g, '""')}"`;
}

/** BOM-prefixed header line so Excel detects UTF-8. */
export function createCsvHeader(columns: readonly ExportColumn[]) {
  return `\uFEFF${columns.map((column) => csvCell(column.label)).join(",")}\r\n`;
}

/** Single CRLF-terminated CSV line for streaming exports. */
export function createCsvRow(columns: readonly ExportColumn[], row: Record<string, unknown>) {
  return `${columns.map((column) => csvCell(row[column.key])).join(",")}\r\n`;
}

export function createCsv(table: ExportTable) {
  return (
    createCsvHeader(table.columns) +
    table.rows.map((row) => createCsvRow(table.columns, row)).join("")
  );
}

export function sha256(value: Buffer | string) {
  return createHash("sha256").update(value).digest("hex");
}
