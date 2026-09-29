import { describe, expect, it } from "vitest";

import { createOnboardingErrorReport } from "./error-report";

describe("createOnboardingErrorReport", () => {
  it("flattens structured issues into a UTF-8, spreadsheet-safe CSV", () => {
    const report = createOnboardingErrorReport([
      {
        errors: [
          {
            acceptedFormat: "Use exactly two digits from 01 to 99.",
            code: "batch_format_invalid",
            example: "08",
            explanation: "Batch must contain exactly two decimal digits.",
            field: "batchNo",
            receivedValue: "=HYPERLINK(\"https://bad.test\")",
            sourceRow: 7,
          },
          {
            acceptedFormat: "YYYY-MM-DD",
            code: "joining_date_format_invalid",
            example: "2024-01-15",
            explanation: "Joining date must use the ISO date-only format.",
            field: "joinedOn",
            receivedValue: "2024/01/15",
            sourceRow: 7,
          },
        ],
      },
    ]);

    expect(report.startsWith("\uFEFF")).toBe(true);
    expect(report).toContain('"Source row","Field","Code","Received value"');
    expect(report).toContain('"7","batchNo","batch_format_invalid"');
    expect(report).toContain("'=HYPERLINK(");
    expect(report).toContain('"7","joinedOn","joining_date_format_invalid"');
    expect(report).toContain('"YYYY-MM-DD","2024-01-15"');
  });
});
