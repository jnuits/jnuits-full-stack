import "server-only";

import type { ExportColumn, ExportTable } from "@/lib/exports/tabular";
import { createCsv } from "@/lib/exports/tabular";
import {
  createXlsxWorkbook,
  createXlsxWorkbookFromSheets,
} from "@/lib/exports/xlsx";

export const BULK_OPERATION_TYPES = [
  "legacy_member_import",
  "member_invite",
  "alumni_invite",
  "lifecycle_update",
  "role_update",
  "alumni_conversion",
  "account_deletion_review",
] as const;

export type BulkOperationType = (typeof BULK_OPERATION_TYPES)[number];
export type BulkOperationTemplateFormat = "csv" | "xlsx";
export type BulkOperationTemplateKind = "blank" | "sample";

export const BULK_MEMBER_TYPES = ["current", "former", "alumni"] as const;
export const BULK_LIFECYCLE_STATUSES = [
  "current",
  "former",
  "alumni",
  "deleted",
] as const;
export const BULK_PORTAL_ACCESS_STATUSES = [
  "active",
  "frozen",
  "suspended",
  "deletion_requested",
  "deactivated",
] as const;
export const BULK_PORTAL_ROLES = [
  "member",
  "alumni",
  "executive",
  "alumni_ambassador",
] as const;
export const BULK_REVIEW_DECISIONS = ["approved", "rejected"] as const;

export type BulkOperationFieldDefinition = {
  acceptedFormat: string;
  acceptedValues?: readonly string[];
  example: string;
  key: string;
  label: string;
  limits: string;
  required: boolean;
};

export type BulkOperationDefinition = {
  description: string;
  fields: readonly BulkOperationFieldDefinition[];
  label: string;
  sampleRow: Readonly<Record<string, string>>;
};

export type BulkOperationRowIssue = {
  acceptedFormat: string;
  code: string;
  example: string;
  explanation: string;
  field: string;
  receivedValue: string;
  sourceRow: number;
};

function field(
  key: string,
  label: string,
  required: boolean,
  acceptedFormat: string,
  limits: string,
  example: string,
  acceptedValues?: readonly string[]
): BulkOperationFieldDefinition {
  return { acceptedFormat, acceptedValues, example, key, label, limits, required };
}

const createMemberFields = [
  field("full_name", "Full name", true, "Plain text", "Non-empty after trimming", "Sample Member"),
  field("email", "Email", true, "Valid email address", "Unique in the source and member database", "sample.member@example.com"),
  field(
    "jnuits_id",
    "JnUITS ID",
    false,
    "JnUITS membership ID, or blank to allocate from the selected year block",
    "Four-digit year block and serial 001 to 999",
    "JNUITS-2099001"
  ),
  field(
    "member_type",
    "Member type",
    false,
    "current, former, alumni, or blank (defaults to current)",
    "One listed value",
    "former",
    BULK_MEMBER_TYPES
  ),
  field(
    "department_code",
    "Department code",
    false,
    "Stored legacy department code",
    "Optional; use the stored database key, not a display short code",
    "computer-science-engineering"
  ),
  field("batch_no", "Batch", false, "Whole number from 1 to 99", "One or two digits", "08"),
  field("phone", "Phone", false, "International or local phone number", "Optional", "01700000000"),
  field("note", "Audit note", false, "Plain text", "Optional", "Fictional migration sample"),
] as const;

const existingIdField = field(
  "jnuits_id",
  "JnUITS ID",
  true,
  "Existing JnUITS membership ID",
  "Four-digit year block and serial 001 to 999",
  "JNUITS-2099001"
);
const noteField = field(
  "note",
  "Audit note",
  false,
  "Plain text",
  "Optional",
  "Fictional administrative sample"
);

const definitions = {
  account_deletion_review: {
    description: "Approve or reject an existing account-deletion request in bulk.",
    fields: [
      existingIdField,
      field(
        "decision",
        "Decision",
        true,
        "approved or rejected",
        "One listed value",
        "rejected",
        BULK_REVIEW_DECISIONS
      ),
      noteField,
    ],
    label: "Account deletion review",
    sampleRow: {
      decision: "rejected",
      jnuits_id: "JNUITS-2099001",
      note: "Fictional review sample",
    },
  },
  alumni_conversion: {
    description: "Convert an existing member profile and linked portal role to alumni.",
    fields: [existingIdField, noteField],
    label: "Alumni conversion",
    sampleRow: {
      jnuits_id: "JNUITS-2099001",
      note: "Fictional alumni conversion sample",
    },
  },
  alumni_invite: {
    description: "Create a historical alumni profile and issue its claim invitation.",
    fields: createMemberFields.map((item) => item.key === "member_type" ? {
      ...item,
      acceptedFormat: "Always alumni; this operation ignores other member-type values",
      acceptedValues: ["alumni"],
      example: "alumni",
    } : item),
    label: "Alumni invite",
    sampleRow: {
      batch_no: "08",
      department_code: "computer-science-engineering",
      email: "sample.alumni@example.com",
      full_name: "Sample Alumni",
      jnuits_id: "JNUITS-2099002",
      member_type: "alumni",
      note: "Fictional alumni invitation sample",
      phone: "01700000000",
    },
  },
  legacy_member_import: {
    description: "Create historical member rows using the legacy year-block allocator.",
    fields: createMemberFields,
    label: "Legacy member import",
    sampleRow: {
      batch_no: "08",
      department_code: "computer-science-engineering",
      email: "sample.legacy@example.com",
      full_name: "Sample Legacy Member",
      jnuits_id: "JNUITS-2099001",
      member_type: "former",
      note: "Fictional legacy import sample",
      phone: "01700000000",
    },
  },
  lifecycle_update: {
    description: "Update lifecycle and portal-access status for existing members.",
    fields: [
      existingIdField,
      field(
        "lifecycle_status",
        "Lifecycle status",
        true,
        "current, former, alumni, or deleted",
        "One listed value",
        "current",
        BULK_LIFECYCLE_STATUSES
      ),
      field(
        "portal_access_status",
        "Portal access status",
        true,
        "active, frozen, suspended, deletion_requested, or deactivated",
        "One listed value",
        "active",
        BULK_PORTAL_ACCESS_STATUSES
      ),
      noteField,
    ],
    label: "Lifecycle update",
    sampleRow: {
      jnuits_id: "JNUITS-2099001",
      lifecycle_status: "current",
      note: "Fictional lifecycle update sample",
      portal_access_status: "active",
    },
  },
  member_invite: {
    description: "Issue a claim invitation for an existing unclaimed member profile.",
    fields: [
      existingIdField,
      field("email", "Email", true, "Valid email address", "Required for invitation delivery", "sample.member@example.com"),
      noteField,
    ],
    label: "Member invite",
    sampleRow: {
      email: "sample.member@example.com",
      jnuits_id: "JNUITS-2099001",
      note: "Fictional member invitation sample",
    },
  },
  role_update: {
    description: "Replace the portal role for an existing linked member account.",
    fields: [
      existingIdField,
      field(
        "portal_role",
        "Portal role",
        true,
        "member, alumni, executive, or alumni_ambassador",
        "One listed value",
        "member",
        BULK_PORTAL_ROLES
      ),
      noteField,
    ],
    label: "Portal role update",
    sampleRow: {
      jnuits_id: "JNUITS-2099001",
      note: "Fictional role update sample",
      portal_role: "member",
    },
  },
} satisfies Record<BulkOperationType, BulkOperationDefinition>;

export function getBulkOperationDefinition(operationType: BulkOperationType) {
  return definitions[operationType];
}

function dataTable(definition: BulkOperationDefinition, kind: BulkOperationTemplateKind): ExportTable {
  return {
    // Legacy CSV previews consume exact machine keys, not display labels.
    columns: definition.fields.map(({ key }): ExportColumn => ({ key, label: key })),
    rows: kind === "sample" ? [definition.sampleRow] : [],
  };
}

function instructionTable(definition: BulkOperationDefinition): ExportTable {
  return {
    columns: [
      { key: "field", label: "Field" },
      { key: "required", label: "Required" },
      { key: "acceptedFormat", label: "Accepted format" },
      { key: "limits", label: "Limits" },
      { key: "example", label: "Example" },
    ],
    rows: definition.fields.map((item) => ({
      acceptedFormat: item.acceptedFormat,
      example: item.example,
      field: `${item.key} (${item.label})`,
      limits: item.limits,
      required: item.required ? "Required" : "Optional",
    })),
  };
}

function referenceTable(definition: BulkOperationDefinition): ExportTable {
  return {
    columns: [
      { key: "field", label: "Field" },
      { key: "acceptedValue", label: "Accepted value" },
    ],
    rows: definition.fields.flatMap((item) =>
      (item.acceptedValues ?? []).map((acceptedValue) => ({
        acceptedValue,
        field: item.label,
      }))
    ),
  };
}

export function createBulkOperationTemplate(input: {
  format: BulkOperationTemplateFormat;
  kind: BulkOperationTemplateKind;
  operationType: BulkOperationType;
}) {
  const definition = getBulkOperationDefinition(input.operationType);
  const table = dataTable(definition, input.kind);
  const slug = input.operationType.replaceAll("_", "-");
  const filename = `jnuits-${slug}-${input.kind}.${input.format}`;

  if (input.format === "xlsx") {
    const body =
      input.kind === "sample"
        ? createXlsxWorkbookFromSheets([
            { name: "Import data", table },
            { name: "Instructions", table: instructionTable(definition) },
            { name: "Reference codes", table: referenceTable(definition) },
          ])
        : createXlsxWorkbook(table, "Import data");

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

export function createBulkOperationIssue(input: {
  code: string;
  explanation: string;
  field: string;
  operationType: BulkOperationType;
  receivedValue: unknown;
  sourceRow: number;
}): BulkOperationRowIssue {
  const definition = getBulkOperationDefinition(input.operationType);
  const fieldDefinition = definition.fields.find(({ key }) => key === input.field);

  return {
    acceptedFormat:
      fieldDefinition?.acceptedFormat ??
      "Use only fields listed for the selected operation.",
    code: input.code,
    example: fieldDefinition?.example ?? "Download the blank template",
    explanation: input.explanation,
    field: input.field,
    receivedValue: String(input.receivedValue ?? "").trim().slice(0, 160),
    sourceRow: input.sourceRow,
  };
}

export function formatBulkOperationIssue(issue: BulkOperationRowIssue) {
  const fieldLabel = issue.field.replaceAll("_", " ");
  const received = issue.receivedValue ? ` Received: "${issue.receivedValue}".` : "";
  return `Source row ${issue.sourceRow} · ${fieldLabel}: ${issue.explanation}${received} Accepted: ${issue.acceptedFormat}. Example: ${issue.example}.`;
}
