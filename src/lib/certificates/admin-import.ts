import "server-only";

import { parse } from "csv-parse/sync";

import { normalizeCertificateIssueDate } from "@/lib/certificates/date";
import {
  CERTIFICATE_IMPORT_FIELDS,
  createCertificateImportIssue,
  type CertificateImportIssue,
} from "@/lib/certificates/import-catalog";
import type { ExportTable } from "@/lib/exports/tabular";
import { createCsv } from "@/lib/exports/tabular";
import {
  createXlsxWorkbook,
  createXlsxWorkbookFromSheets,
} from "@/lib/exports/xlsx";

export { CERTIFICATE_IMPORT_FIELDS } from "@/lib/certificates/import-catalog";

export const CERTIFICATE_IMPORT_CHUNK_SIZE = 200;
export const MAX_CERTIFICATE_IMPORT_BYTES = 2 * 1024 * 1024;
export const MAX_CERTIFICATE_IMPORT_ROWS = 5_000;

const ALLOWED_CSV_MIME_TYPES = new Set([
  "",
  "application/csv",
  "application/vnd.ms-excel",
  "text/csv",
  "text/plain",
]);

const TEMPLATE_EXAMPLE_CERTIFICATE_ID_PREFIXES = [
  "EXAMPLE-CERT-",
  "SAMPLE-CERT-",
  "REPLACE-CERT-",
];

const HEADER_ALIASES = {
  assetUrl: ["asset url", "asseturl", "certificate url", "download url", "pdf url"],
  certificateId: [
    "certificate id",
    "certificate no",
    "certificate number",
    "certificateid",
    "certid",
  ],
  details: ["description", "details", "note", "notes", "remarks"],
  eventName: [
    "event / exam / course name",
    "event exam course name",
    "event name",
    "event or exam name",
    "eventname",
    "exam or event name",
    "examoreventname",
    "subject",
  ],
  firstName: ["first name", "firstname"],
  fullName: [
    "full name",
    "fullname",
    "name",
    "participant name",
    "recipient name",
    "student name",
  ],
  issueDate: ["date", "issue date", "issued date", "issued on", "issuedate"],
  lastName: ["last name", "lastname"],
  type: [
    "certificate type",
    "event / exam / course type",
    "exam or event",
    "examorevent",
    "type",
  ],
} as const;

export type CertificateImportType = "Course" | "Event" | "Exam";

export type CertificateImportRecord = {
  asset_url: null | string;
  certificate_id: string;
  details: string;
  exam_or_event: CertificateImportType;
  exam_or_event_name: string;
  full_name: string;
  issue_date: string;
};

export type CertificateImportRow = {
  certificate: CertificateImportRecord | null;
  errors: CertificateImportIssue[];
  ignored: boolean;
  rowNumber: number;
};

export type CertificateImportParseResult = {
  dataRowCount: number;
  ignoredRowCount: number;
  rows: CertificateImportRow[];
  validRows: Array<CertificateImportRow & { certificate: CertificateImportRecord }>;
};

export type CertificateImportSource = {
  csvText: string;
  fileName: null | string;
};

export class CertificateImportInputError extends Error {
  readonly issues: readonly CertificateImportIssue[];

  constructor(message: string, issues: readonly CertificateImportIssue[] = []) {
    super(message);
    this.name = "CertificateImportInputError";
    this.issues = issues;
  }
}

export type CertificateImportTemplateFormat = "csv" | "xlsx";
export type CertificateImportTemplateKind = "blank" | "sample";

function certificateImportTable(kind: CertificateImportTemplateKind): ExportTable {
  return {
    columns: CERTIFICATE_IMPORT_FIELDS.map(({ key, label }) => ({ key, label })),
    rows:
      kind === "sample"
        ? [
            {
              assetUrl: "https://example.com/sample-certificate.pdf",
              certificateId: "EXAMPLE-CERT-2099-001",
              details: "Fictional certificate sample",
              eventName: "Sample Technology Workshop",
              fullName: "Sample Recipient",
              issueDate: "2099-01-15",
              type: "Event",
            },
          ]
        : [],
  };
}

function certificateInstructionTable(): ExportTable {
  return {
    columns: [
      { key: "field", label: "Field" },
      { key: "required", label: "Required" },
      { key: "acceptedFormat", label: "Accepted format" },
      { key: "limits", label: "Limits" },
      { key: "example", label: "Example" },
    ],
    rows: CERTIFICATE_IMPORT_FIELDS.map((definition) => ({
      acceptedFormat: definition.acceptedFormat,
      example: definition.example,
      field: definition.label,
      limits: definition.limits,
      required: definition.required ? "Required" : "Optional",
    })),
  };
}

function certificateReferenceTable(): ExportTable {
  return {
    columns: [
      { key: "field", label: "Field" },
      { key: "acceptedValue", label: "Accepted value" },
    ],
    rows: CERTIFICATE_IMPORT_FIELDS.flatMap((definition) =>
      (definition.acceptedValues ?? []).map((acceptedValue) => ({
        acceptedValue,
        field: definition.label,
      }))
    ),
  };
}

export function createCertificateImportTemplate(input: {
  format: CertificateImportTemplateFormat;
  kind: CertificateImportTemplateKind;
}) {
  const table = certificateImportTable(input.kind);
  const filename = `jnuits-certificate-import-${input.kind}.${input.format}`;

  if (input.format === "xlsx") {
    const body =
      input.kind === "sample"
        ? createXlsxWorkbookFromSheets([
            { name: "Certificates", table },
            { name: "Instructions", table: certificateInstructionTable() },
            { name: "Reference codes", table: certificateReferenceTable() },
          ])
        : createXlsxWorkbook(table, "Certificates");

    return {
      body,
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      filename,
    };
  }

  return {
    body: createCsv(table),
    contentType: "text/csv; charset=utf-8",
    filename,
  };
}

function byteLength(value: string) {
  return new TextEncoder().encode(value).byteLength;
}

function cleanCsvValue(value: string) {
  const cleaned = value
    .replace(/[\u00a0\u2007\u202f]/g, " ")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (
    cleaned.length >= 2 &&
    ((cleaned.startsWith('"') && cleaned.endsWith('"')) ||
      (cleaned.startsWith("'") && cleaned.endsWith("'")) ||
      (cleaned.startsWith("\u201c") && cleaned.endsWith("\u201d")) ||
      (cleaned.startsWith("\u2018") && cleaned.endsWith("\u2019")))
  ) {
    return cleaned.slice(1, -1).trim();
  }

  return cleaned;
}

function canonicalType(value: string): CertificateImportType | null {
  const normalized = normalizeHeader(value);

  if (["event", "eventcertificate", "hackathon", "seminar", "workshop"].includes(normalized)) {
    return "Event";
  }
  if (["exam", "examcertificate", "examination"].includes(normalized)) return "Exam";
  if (["bootcamp", "course", "coursecertificate", "training"].includes(normalized)) {
    return "Course";
  }
  return null;
}

function findHeaderIndex(headers: Map<string, number>, aliases: readonly string[]) {
  for (const alias of aliases) {
    const index = headers.get(normalizeHeader(alias));
    if (index !== undefined) return index;
  }

  return null;
}

function getCell(values: string[], index: number | null) {
  return index === null ? "" : cleanCsvValue(values[index] || "");
}

function hasTemplateExampleId(certificateId: string) {
  return TEMPLATE_EXAMPLE_CERTIFICATE_ID_PREFIXES.some((prefix) =>
    certificateId.startsWith(prefix)
  );
}

function isDateLike(value: string) {
  return normalizeCertificateIssueDate(cleanCsvValue(value)) !== null;
}

function normalizeFullName(...parts: string[]) {
  return parts
    .map((part) => cleanCsvValue(part))
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeHeader(value: string) {
  return cleanCsvValue(value).toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function normalizeHttpUrl(value: string) {
  const trimmed = cleanCsvValue(value);
  if (!trimmed) return { error: null, value: null };

  if (trimmed.length > 2_000) {
    return { error: "asset URL is too long", value: null };
  }

  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return { error: "asset URL must use http or https", value: null };
    }

    return { error: null, value: url.toString() };
  } catch {
    return { error: "asset URL is not valid", value: null };
  }
}

function parseHeaderRecord(values: string[], headers: Map<string, number>) {
  const fullName = getCell(values, findHeaderIndex(headers, HEADER_ALIASES.fullName));
  const firstName = getCell(values, findHeaderIndex(headers, HEADER_ALIASES.firstName));
  const lastName = getCell(values, findHeaderIndex(headers, HEADER_ALIASES.lastName));

  return {
    assetUrl: getCell(values, findHeaderIndex(headers, HEADER_ALIASES.assetUrl)),
    certificateId: getCell(values, findHeaderIndex(headers, HEADER_ALIASES.certificateId)),
    details: getCell(values, findHeaderIndex(headers, HEADER_ALIASES.details)),
    eventName: getCell(values, findHeaderIndex(headers, HEADER_ALIASES.eventName)),
    fullName: fullName || normalizeFullName(firstName, lastName),
    issueDate: getCell(values, findHeaderIndex(headers, HEADER_ALIASES.issueDate)),
    type: getCell(values, findHeaderIndex(headers, HEADER_ALIASES.type)),
  };
}

function parsePositionalRecord(values: string[]) {
  const looksModern =
    values.length <= 7 &&
    (canonicalType(values[2] || "") !== null || isDateLike(values[4] || ""));

  if (looksModern) {
    return {
      assetUrl: values[5] || "",
      certificateId: values[0] || "",
      details: values[6] || "",
      eventName: values[3] || "",
      fullName: values[1] || "",
      issueDate: values[4] || "",
      type: values[2] || "",
    };
  }

  return {
    assetUrl: values[6] || "",
    certificateId: values[0] || "",
    details: values[7] || "",
    eventName: values[4] || "",
    fullName: normalizeFullName(values[1] || "", values[2] || ""),
    issueDate: values[5] || "",
    type: values[3] || "",
  };
}

function validateRecord(
  raw: ReturnType<typeof parseHeaderRecord>,
  rowNumber: number
): CertificateImportRow {
  const certificateId = cleanCsvValue(raw.certificateId).toUpperCase();

  if (hasTemplateExampleId(certificateId)) {
    return {
      certificate: null,
      errors: [],
      ignored: true,
      rowNumber,
    };
  }

  const errors: CertificateImportIssue[] = [];
  const fullName = normalizeFullName(raw.fullName);
  const type = canonicalType(raw.type);
  const eventName = cleanCsvValue(raw.eventName);
  const issueDate = normalizeCertificateIssueDate(cleanCsvValue(raw.issueDate));
  const details = cleanCsvValue(raw.details);
  const asset = normalizeHttpUrl(raw.assetUrl);

  function addIssue(
    field: Parameters<typeof createCertificateImportIssue>[0]["field"],
    code: string,
    explanation: string,
    receivedValue: unknown
  ) {
    errors.push(
      createCertificateImportIssue({
        code,
        explanation,
        field,
        receivedValue,
        sourceRow: rowNumber,
      })
    );
  }

  if (!certificateId) {
    addIssue("certificateId", "certificate_id_required", "Certificate ID is required.", raw.certificateId);
  }
  if (certificateId.length > 80) {
    addIssue("certificateId", "certificate_id_too_long", "Certificate ID is too long.", raw.certificateId);
  }
  if (!fullName) {
    addIssue("fullName", "full_name_required", "Full name is required.", raw.fullName);
  }
  if (fullName.length > 180) {
    addIssue("fullName", "full_name_too_long", "Full name is too long.", raw.fullName);
  }
  if (!type) {
    addIssue("type", "type_invalid", "Type must be Event, Exam, or Course.", raw.type);
  }
  if (!eventName) {
    addIssue("eventName", "event_name_required", "Event, exam, or course name is required.", raw.eventName);
  }
  if (eventName.length > 180) {
    addIssue("eventName", "event_name_too_long", "Event, exam, or course name is too long.", raw.eventName);
  }
  if (!issueDate) {
    addIssue("issueDate", "issue_date_invalid", "Issue date must be a valid date.", raw.issueDate);
  }
  if (details.length > 3_000) {
    addIssue("details", "details_too_long", "Details are too long.", raw.details);
  }
  if (asset.error) {
    addIssue(
      "assetUrl",
      asset.error === "asset URL is too long" ? "asset_url_too_long" : "asset_url_invalid",
      `${asset.error.charAt(0).toUpperCase()}${asset.error.slice(1)}.`,
      raw.assetUrl
    );
  }

  return {
    certificate:
      errors.length === 0 && type && issueDate
        ? {
            asset_url: asset.value,
            certificate_id: certificateId,
            details,
            exam_or_event: type,
            exam_or_event_name: eventName,
            full_name: fullName,
            issue_date: issueDate,
          }
        : null,
    errors,
    ignored: false,
    rowNumber,
  };
}

function validateHeader(headers: Map<string, number>) {
  const missing: string[] = [];
  const hasFullName =
    findHeaderIndex(headers, HEADER_ALIASES.fullName) !== null ||
    (findHeaderIndex(headers, HEADER_ALIASES.firstName) !== null &&
      findHeaderIndex(headers, HEADER_ALIASES.lastName) !== null);

  if (findHeaderIndex(headers, HEADER_ALIASES.certificateId) === null) {
    missing.push("certId");
  }
  if (!hasFullName) missing.push("fullName");
  if (findHeaderIndex(headers, HEADER_ALIASES.type) === null) missing.push("type");
  if (findHeaderIndex(headers, HEADER_ALIASES.eventName) === null) {
    missing.push("eventName");
  }
  if (findHeaderIndex(headers, HEADER_ALIASES.issueDate) === null) {
    missing.push("issueDate");
  }

  if (missing.length > 0) {
    throw new CertificateImportInputError(
      `The CSV header is missing: ${missing.join(", ")}. Download the template and keep its column names.`
    );
  }
}

export function getDefaultCertificateImportSourceName(fileName: string | null) {
  const cleaned = (fileName || "")
    .replace(/\.csv$/i, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 140);

  return cleaned || `manual-import-${new Date().toISOString().slice(0, 10)}`;
}

export function parseCertificateImportCsv(rawCsv: string): CertificateImportParseResult {
  if (!rawCsv.trim()) {
    throw new CertificateImportInputError("Choose a CSV file or paste CSV rows to import.");
  }

  if (rawCsv.includes("\0")) {
    throw new CertificateImportInputError("The CSV file contains an unsupported control character.");
  }

  if (byteLength(rawCsv) > MAX_CERTIFICATE_IMPORT_BYTES) {
    throw new CertificateImportInputError(
      "The CSV is larger than 2 MB. Split it into smaller imports."
    );
  }

  let records: string[][];

  try {
    records = parse(rawCsv, {
      bom: true,
      max_record_size: 200_000,
      relax_column_count: true,
      skip_empty_lines: true,
      trim: true,
    }) as string[][];
  } catch {
    throw new CertificateImportInputError(
      "The CSV could not be read. Check for unmatched quotes, then try again."
    );
  }

  if (records.length === 0) {
    throw new CertificateImportInputError("The CSV does not contain any rows.");
  }

  const firstRow = records[0] || [];
  const headers = new Map<string, number>();
  firstRow.forEach((value, index) => {
    const key = normalizeHeader(value || "");
    if (key && !headers.has(key)) headers.set(key, index);
  });

  const headerPresent = Array.from(headers.keys()).some((header) =>
    Object.values(HEADER_ALIASES).some((aliases) =>
      aliases.some((alias) => normalizeHeader(alias) === header)
    )
  );

  if (headerPresent) {
    validateHeader(headers);
  }

  const dataRows = headerPresent ? records.slice(1) : records;

  if (dataRows.length === 0) {
    throw new CertificateImportInputError("The CSV has a header but no certificate rows.");
  }

  if (dataRows.length > MAX_CERTIFICATE_IMPORT_ROWS) {
    throw new CertificateImportInputError(
      `The CSV has more than ${MAX_CERTIFICATE_IMPORT_ROWS.toLocaleString("en-US")} rows. Split it into smaller imports.`
    );
  }

  const rows = dataRows.map((values, index) => {
    const raw = headerPresent
      ? parseHeaderRecord(values, headers)
      : parsePositionalRecord(values);

    return validateRecord(raw, index + (headerPresent ? 2 : 1));
  });

  const validRows = rows.filter(
    (row): row is CertificateImportRow & { certificate: CertificateImportRecord } =>
      row.certificate !== null
  );
  const ignoredRowCount = rows.filter((row) => row.ignored).length;

  if (validRows.length === 0) {
    if (ignoredRowCount === rows.length) {
      throw new CertificateImportInputError(
        "The CSV only contains template example rows. Replace or add at least one real certificate before importing."
      );
    }

    const issues = rows.flatMap((row) => row.errors);
    // Flash messages are cookie-backed. Keep the summary short while retaining
    // every issue separately for the validation report.
    const firstIssueByRow = new Map<number, CertificateImportIssue>();
    for (const issue of issues) {
      if (!firstIssueByRow.has(issue.sourceRow)) firstIssueByRow.set(issue.sourceRow, issue);
    }
    const diagnostics = Array.from(firstIssueByRow.values())
      .slice(0, 2)
      .map((issue) => `Row ${issue.sourceRow}: ${issue.explanation} Accepted: ${issue.acceptedFormat}.`)
      .join(" ");
    throw new CertificateImportInputError(
      `No valid certificate rows were found. ${issues.length} validation issues. ` +
        (diagnostics || "Check the required fields and try again.") +
        " Use Check data to review the full report.",
      issues
    );
  }

  return {
    dataRowCount: dataRows.length,
    ignoredRowCount,
    rows,
    validRows,
  };
}

export async function readCertificateImportSource(
  formData: FormData
): Promise<CertificateImportSource> {
  const uploaded = formData.get("csv_file");

  if (typeof uploaded !== "string" && uploaded && uploaded.name) {
    const type = uploaded.type.trim().toLowerCase();

    if (!uploaded.name.toLowerCase().endsWith(".csv")) {
      throw new CertificateImportInputError("Choose a file with a .csv extension.");
    }

    if (!ALLOWED_CSV_MIME_TYPES.has(type)) {
      throw new CertificateImportInputError("Choose a standard CSV file.");
    }

    if (uploaded.size === 0) {
      throw new CertificateImportInputError("The selected CSV file is empty.");
    }

    if (uploaded.size > MAX_CERTIFICATE_IMPORT_BYTES) {
      throw new CertificateImportInputError(
        "The selected CSV is larger than 2 MB. Split it into smaller imports."
      );
    }

    return {
      csvText: await uploaded.text(),
      fileName: uploaded.name,
    };
  }

  const pasted = formData.get("csv_data");
  return {
    csvText: typeof pasted === "string" ? pasted : "",
    fileName: null,
  };
}
