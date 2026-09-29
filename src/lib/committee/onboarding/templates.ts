import "server-only";

import type { ExportColumn, ExportTable } from "@/lib/exports/tabular";
import { createCsv } from "@/lib/exports/tabular";
import {
  createXlsxWorkbook,
  createXlsxWorkbookFromSheets,
} from "@/lib/exports/xlsx";
import type { ActiveDepartmentCatalogEntry } from "@/lib/membership/department-catalog";
import type {
  CommitteeOnboardingCanonicalField,
  CommitteeOnboardingOperationType,
} from "./contracts";
import { ONBOARDING_FIELD_CATALOG } from "./field-catalog";

export type OnboardingTemplateFormat = "csv" | "xlsx";
export type OnboardingTemplateKind = "blank" | "department-codes" | "sample";

const MEMBER_FIELDS: readonly CommitteeOnboardingCanonicalField[] = [
  "fullName",
  "jnuitsId",
  "email",
  "classification",
  "departmentCode",
  "batchNo",
  "joinedOn",
  "phone",
  "studentId",
  "facebookUrl",
  "linkedinUrl",
  "websiteUrl",
  "avatarMediaId",
] as const;

const COMMITTEE_FIELDS: readonly CommitteeOnboardingCanonicalField[] = [
  "position",
  "startsOn",
  "endsOn",
  "sortOrder",
  "isPublic",
  "assignmentStatus",
] as const;

const memberFieldSet = new Set<CommitteeOnboardingCanonicalField>(MEMBER_FIELDS);
const committeeFieldSet = new Set<CommitteeOnboardingCanonicalField>(COMMITTEE_FIELDS);

function templateFieldDefinitions(operationType: CommitteeOnboardingOperationType) {
  return ONBOARDING_FIELD_CATALOG.filter(
    ({ field }) =>
      memberFieldSet.has(field) ||
      (operationType === "committee_roster_import" && committeeFieldSet.has(field))
  );
}

export function getOnboardingTemplateColumns(
  operationType: CommitteeOnboardingOperationType
): readonly ExportColumn[] {
  return templateFieldDefinitions(operationType).map(({ field, label }) => ({
    key: field,
    label,
  }));
}

function departmentTable(
  departments: readonly ActiveDepartmentCatalogEntry[]
): ExportTable {
  return {
    columns: [
      { key: "shortCode", label: "Department code" },
      { key: "name", label: "Department name" },
    ],
    rows: departments.map(({ name, shortCode }) => ({ name, shortCode })),
  };
}

function instructionTable(operationType: CommitteeOnboardingOperationType): ExportTable {
  return {
    columns: [
      { key: "field", label: "Field" },
      { key: "required", label: "Required" },
      { key: "acceptedFormat", label: "Accepted format" },
      { key: "limits", label: "Limits" },
      { key: "example", label: "Example" },
    ],
    rows: templateFieldDefinitions(operationType).map((definition) => ({
      acceptedFormat: definition.acceptedFormat,
      example: definition.example,
      field: definition.label,
      limits: definition.limits ?? "",
      required:
        definition.requirements[operationType] === "required" ? "Required" : "Optional",
    })),
  };
}

function sampleRow(
  operationType: CommitteeOnboardingOperationType,
  departments: readonly ActiveDepartmentCatalogEntry[]
) {
  const department =
    departments.find(({ shortCode }) => shortCode.toLocaleUpperCase("en-US") === "CSE") ??
    departments[0];
  if (!department) {
    throw new Error("An active department is required to generate an onboarding sample.");
  }

  return {
    assignmentStatus: "active",
    avatarMediaId: "",
    batchNo: "08",
    classification: "alumni",
    departmentCode: department.shortCode,
    email: "sample.member@example.com",
    endsOn: "2099-12-31",
    facebookUrl: "https://www.facebook.com/sample.member",
    fullName: "Sample Member",
    isPublic: "true",
    jnuitsId: "JNUITS-2099001",
    joinedOn: "2099-01-15",
    linkedinUrl: "https://www.linkedin.com/in/sample-member",
    phone: "+8801000000000",
    position: operationType === "committee_roster_import" ? "president" : "",
    sortOrder: "10",
    startsOn: "2099-01-01",
    studentId: "SAMPLE-2099-001",
    websiteUrl: "https://example.com/sample-member",
  };
}

export function createOnboardingTemplate(input: {
  departments: readonly ActiveDepartmentCatalogEntry[];
  format: OnboardingTemplateFormat;
  kind: OnboardingTemplateKind;
  operationType: CommitteeOnboardingOperationType;
}) {
  const operationSlug =
    input.operationType === "committee_roster_import"
      ? "committee-roster"
      : "member-profile";
  const mainSheetName =
    input.operationType === "committee_roster_import"
      ? "Committee roster"
      : "Member profiles";
  const mainTable: ExportTable = {
    columns: getOnboardingTemplateColumns(input.operationType),
    rows:
      input.kind === "sample"
        ? [sampleRow(input.operationType, input.departments)]
        : [],
  };
  const table =
    input.kind === "department-codes"
      ? departmentTable(input.departments)
      : mainTable;
  const filenameBase =
    input.kind === "department-codes"
      ? "jnuits-department-codes"
      : `jnuits-${operationSlug}-import-${input.kind}`;

  if (input.format === "xlsx") {
    const body =
      input.kind === "sample"
        ? createXlsxWorkbookFromSheets([
            { name: mainSheetName, table: mainTable },
            { name: "Instructions", table: instructionTable(input.operationType) },
            { name: "Department codes", table: departmentTable(input.departments) },
          ])
        : createXlsxWorkbook(
            table,
            input.kind === "department-codes" ? "Department codes" : mainSheetName
          );

    return {
      body,
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      filename: `${filenameBase}.xlsx`,
    };
  }

  return {
    body: createCsv(table),
    contentType: "text/csv; charset=utf-8",
    filename: `${filenameBase}.csv`,
  };
}
