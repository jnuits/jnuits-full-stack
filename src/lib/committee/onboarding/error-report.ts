import "server-only";

import { createCsv } from "@/lib/exports/tabular";
import type { OnboardingRowIssue } from "./contracts";

const ERROR_REPORT_COLUMNS = [
  { key: "sourceRow", label: "Source row" },
  { key: "field", label: "Field" },
  { key: "code", label: "Code" },
  { key: "receivedValue", label: "Received value" },
  { key: "explanation", label: "Explanation" },
  { key: "acceptedFormat", label: "Accepted format" },
  { key: "example", label: "Example" },
] as const;

export function createOnboardingErrorReport(
  rows: readonly { errors: readonly OnboardingRowIssue[] }[]
) {
  return createCsv({
    columns: ERROR_REPORT_COLUMNS,
    rows: rows.flatMap(({ errors }) =>
      errors.map((issue) => ({
        acceptedFormat: issue.acceptedFormat,
        code: issue.code,
        example: issue.example,
        explanation: issue.explanation,
        field: issue.field ?? "row",
        receivedValue: issue.receivedValue,
        sourceRow: issue.sourceRow,
      }))
    ),
  });
}
