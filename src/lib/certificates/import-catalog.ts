export const CERTIFICATE_IMPORT_FIELD_KEYS = [
  "certificateId",
  "fullName",
  "type",
  "eventName",
  "issueDate",
  "assetUrl",
  "details",
] as const;

export type CertificateImportFieldKey =
  (typeof CERTIFICATE_IMPORT_FIELD_KEYS)[number];

export type CertificateImportFieldDefinition = {
  acceptedFormat: string;
  acceptedValues?: readonly string[];
  example: string;
  key: CertificateImportFieldKey;
  label: string;
  limits: string;
  required: boolean;
};

export type CertificateImportIssue = {
  acceptedFormat: string;
  code: string;
  example: string;
  explanation: string;
  field: CertificateImportFieldKey;
  receivedValue: string;
  sourceRow: number;
};

export type CertificateImportInspection = {
  issues: CertificateImportIssue[];
  message: string;
  ok: boolean;
};

export const CERTIFICATE_IMPORT_FIELDS: readonly CertificateImportFieldDefinition[] = [
  {
    acceptedFormat: "Unique certificate identifier",
    example: "EXAMPLE-CERT-2099-001",
    key: "certificateId",
    label: "Certificate ID",
    limits: "1 to 80 characters",
    required: true,
  },
  {
    acceptedFormat: "Recipient's full name",
    example: "Sample Recipient",
    key: "fullName",
    label: "Full name",
    limits: "1 to 180 characters",
    required: true,
  },
  {
    acceptedFormat: "Event, Exam, or Course",
    acceptedValues: ["Event", "Exam", "Course"],
    example: "Event",
    key: "type",
    label: "Type",
    limits: "One listed value",
    required: true,
  },
  {
    acceptedFormat: "Event, exam, or course title",
    example: "Sample Technology Workshop",
    key: "eventName",
    label: "Event name",
    limits: "1 to 180 characters",
    required: true,
  },
  {
    acceptedFormat: "YYYY-MM-DD, day-first date, or Excel date",
    example: "2099-01-15",
    key: "issueDate",
    label: "Issue date",
    limits: "A real calendar date",
    required: true,
  },
  {
    acceptedFormat: "Absolute http:// or https:// URL",
    example: "https://example.com/sample-certificate.pdf",
    key: "assetUrl",
    label: "Asset URL",
    limits: "Optional; maximum 2,000 characters",
    required: false,
  },
  {
    acceptedFormat: "Plain text",
    example: "Fictional certificate sample",
    key: "details",
    label: "Details",
    limits: "Optional; maximum 3,000 characters",
    required: false,
  },
] as const;

const fieldByKey = new Map(
  CERTIFICATE_IMPORT_FIELDS.map((definition) => [definition.key, definition])
);

export function createCertificateImportIssue(input: {
  code: string;
  explanation: string;
  field: CertificateImportFieldKey;
  receivedValue: unknown;
  sourceRow: number;
}): CertificateImportIssue {
  const definition = fieldByKey.get(input.field);
  if (!definition) {
    throw new RangeError(`Unknown certificate import field: ${input.field}`);
  }

  return {
    acceptedFormat: definition.acceptedFormat,
    code: input.code,
    example: definition.example,
    explanation: input.explanation,
    field: input.field,
    receivedValue: String(input.receivedValue ?? "").trim().slice(0, 160),
    sourceRow: input.sourceRow,
  };
}

export function formatCertificateImportIssue(issue: CertificateImportIssue) {
  const definition = fieldByKey.get(issue.field);
  const received = issue.receivedValue ? ` Received: "${issue.receivedValue}".` : "";
  return `${definition?.label ?? issue.field}: ${issue.explanation}${received} Accepted: ${issue.acceptedFormat}. Example: ${issue.example}.`;
}

/** Client-safe CSV report; submitted values must never become spreadsheet formulas. */
export function createCertificateIssueReport(issues: readonly CertificateImportIssue[]) {
  function cell(value: unknown) {
    const text = String(value ?? "");
    const safe = /^[\t\r\n ]*[=+\-@]/.test(text) ? `'${text}` : text;
    return `"${safe.replaceAll('"', '""')}"`;
  }
  const rows: unknown[][] = [
    ["Source row", "Field", "Received value", "Issue", "Accepted format", "Example"],
    ...issues.map((issue) => [
      issue.sourceRow, fieldByKey.get(issue.field)?.label ?? issue.field,
      issue.receivedValue, issue.explanation, issue.acceptedFormat, issue.example,
    ]),
  ];
  return `\uFEFF${rows.map((row) => row.map(cell).join(",")).join("\r\n")}\r\n`;
}
