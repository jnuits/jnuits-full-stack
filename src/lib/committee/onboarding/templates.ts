import "server-only";

import type { ExportColumn, ExportTable } from "@/lib/exports/tabular";
import { createCsv } from "@/lib/exports/tabular";
import { createXlsxWorkbook } from "@/lib/exports/xlsx";
import type { CommitteeOnboardingOperationType } from "./contracts";

export type OnboardingTemplateFormat = "csv" | "xlsx";

const MEMBER_COLUMNS: readonly ExportColumn[] = [
  { key: "fullName", label: "Full name" },
  { key: "jnuitsId", label: "JnUITS ID" },
  { key: "email", label: "Email" },
  { key: "classification", label: "Classification" },
  { key: "departmentCode", label: "Department code" },
  { key: "batchNo", label: "Batch" },
  { key: "phone", label: "Phone" },
  { key: "studentId", label: "Student ID" },
  { key: "facebookUrl", label: "Facebook URL" },
  { key: "linkedinUrl", label: "LinkedIn URL" },
  { key: "websiteUrl", label: "Website URL" },
  { key: "avatarMediaId", label: "Approved photo ID" },
] as const;

const COMMITTEE_COLUMNS: readonly ExportColumn[] = [
  { key: "position", label: "Position" },
  { key: "startsOn", label: "Starts on" },
  { key: "endsOn", label: "Ends on" },
  { key: "sortOrder", label: "Order" },
  { key: "isPublic", label: "Public" },
  { key: "assignmentStatus", label: "Appointment status" },
] as const;

export function getOnboardingTemplateColumns(
  operationType: CommitteeOnboardingOperationType
): readonly ExportColumn[] {
  return operationType === "committee_roster_import"
    ? [...MEMBER_COLUMNS, ...COMMITTEE_COLUMNS]
    : MEMBER_COLUMNS;
}

export function createOnboardingTemplate(
  operationType: CommitteeOnboardingOperationType,
  format: OnboardingTemplateFormat
) {
  const kind =
    operationType === "committee_roster_import"
      ? "committee-roster"
      : "member-profile";
  const table: ExportTable = {
    columns: getOnboardingTemplateColumns(operationType),
    rows: [],
  };

  if (format === "xlsx") {
    return {
      body: createXlsxWorkbook(
        table,
        operationType === "committee_roster_import" ? "Committee roster" : "Member profiles"
      ),
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      filename: `jnuits-${kind}-import-template.xlsx`,
    };
  }

  return {
    body: createCsv(table),
    contentType: "text/csv; charset=utf-8",
    filename: `jnuits-${kind}-import-template.csv`,
  };
}
