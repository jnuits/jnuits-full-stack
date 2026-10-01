import { describe, expect, it } from "vitest";

import {
  formatBatchCode,
  formatBatchOrdinal,
  parseBatchCode,
  parseJoiningDate,
  resolveDepartmentInput,
  type DepartmentCatalogEntry,
} from "./intake-fields";

const departments: readonly DepartmentCatalogEntry[] = [
  {
    aliases: ["Computer Science and Engineering"],
    internalCode: "computer-science-engineering",
    name: "Computer Science & Engineering",
    shortCode: "CSE",
  },
  {
    aliases: ["Accounting Information Systems"],
    internalCode: "accounting-information-systems",
    name: "Accounting & Information Systems",
    shortCode: "AIS",
  },
];

describe("membership intake fields", () => {
  it.each([
    "CSE",
    " cse ",
    "Computer Science & Engineering",
    "  COMPUTER   SCIENCE & ENGINEERING  ",
    "computer-science-engineering",
    "Computer Science and Engineering",
  ])("resolves %j to the canonical department key", (input) => {
    expect(resolveDepartmentInput(input, departments)).toEqual({
      ok: true,
      value: {
        departmentCode: "computer-science-engineering",
        name: "Computer Science & Engineering",
        shortCode: "CSE",
      },
    });
  });

  it("rejects an unrecognized department with a corrective issue", () => {
    const result = resolveDepartmentInput("Computer", departments);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issue).toMatchObject({
      acceptedFormat: expect.stringContaining("Department codes"),
      code: "department_not_recognized",
      example: "CSE",
      field: "departmentCode",
      receivedValue: "Computer",
    });
  });

  it("fails closed when one alias identifies more than one department", () => {
    const result = resolveDepartmentInput("Science", [
      { ...departments[0], aliases: ["Science"] },
      { ...departments[1], aliases: ["Science"] },
    ]);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issue.code).toBe("department_ambiguous");
    expect(result.issue.receivedValue).toBe("Science");
  });

  it.each([
    ["01", 1],
    ["07", 7],
    ["08", 8],
    ["12", 12],
    ["99", 99],
  ] as const)("parses canonical batch %s without losing its display code", (input, batchNo) => {
    expect(parseBatchCode(input)).toEqual({ batchNo, code: input, ok: true });
  });

  it.each(["7", "7th", "12 th", "Batch 12", "100", "-1", "1.0", ""])(
    "rejects non-canonical batch input %j",
    (input) => {
      const result = parseBatchCode(input);

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.issue).toMatchObject({
        acceptedFormat: expect.stringContaining("01 to 99"),
        code: "batch_format_invalid",
        example: "08",
        field: "batchNo",
        receivedValue: input,
      });
    },
  );

  it.each(["00"])("rejects out-of-range two-digit batch %s", (input) => {
    const result = parseBatchCode(input);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issue.code).toBe("batch_out_of_range");
  });

  it("formats stored batches with a leading zero", () => {
    expect(formatBatchCode(7)).toBe("07");
    expect(formatBatchCode(12)).toBe("12");
  });

  it.each([
    [1, "1st Batch"],
    [2, "2nd Batch"],
    [3, "3rd Batch"],
    [4, "4th Batch"],
    [11, "11th Batch"],
    [12, "12th Batch"],
    [13, "13th Batch"],
    [21, "21st Batch"],
    [22, "22nd Batch"],
    [23, "23rd Batch"],
  ] as const)("formats batch %i as %s", (batchNo, expected) => {
    expect(formatBatchOrdinal(batchNo)).toBe(expected);
  });

  it("rejects stored batch values outside the database contract", () => {
    expect(() => formatBatchCode(0)).toThrow(RangeError);
    expect(() => formatBatchOrdinal(100)).toThrow(RangeError);
    expect(() => formatBatchCode(7.5)).toThrow(RangeError);
  });

  it.each(["2024-01-15", "2024-02-29", "2025-12-31"])(
    "preserves valid date-only joining value %s",
    (input) => {
      expect(parseJoiningDate(input)).toEqual({ ok: true, value: input });
    },
  );

  it.each(["2023-02-29", "2024-02-30", "2024-13-01", "2024-00-10", "0000-01-15"])(
    "rejects impossible joining date %s",
    (input) => {
      const result = parseJoiningDate(input);

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.issue.code).toBe("joining_date_invalid");
    },
  );

  it.each(["2024/01/15", "15-01-2024", "2024-1-15", "2024-01-15T00:00:00Z", ""])(
    "rejects non-ISO joining date %j",
    (input) => {
      const result = parseJoiningDate(input);

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.issue).toMatchObject({
        acceptedFormat: "YYYY-MM-DD",
        code: "joining_date_format_invalid",
        example: "2024-01-15",
        field: "joinedOn",
        receivedValue: input,
      });
    },
  );
});
