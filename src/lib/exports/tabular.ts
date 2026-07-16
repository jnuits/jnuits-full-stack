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

export function createCsv(table: ExportTable) {
  const rows = [
    table.columns.map((column) => csvCell(column.label)).join(","),
    ...table.rows.map((row) =>
      table.columns.map((column) => csvCell(row[column.key])).join(",")
    ),
  ];

  return `\uFEFF${rows.join("\r\n")}\r\n`;
}

export function sha256(value: Buffer | string) {
  return createHash("sha256").update(value).digest("hex");
}
