import { describe, expect, it } from "vitest";
import {
  IntakeParseError,
  MAX_INTAKE_BYTES,
  MAX_INTAKE_DATA_ROWS,
} from "./intake-contracts";
import { parseDelimitedIntake } from "./parse-delimited";

describe("parseDelimitedIntake", () => {
  it("preserves text identifiers and quoted multiline CSV values", () => {
    const table = parseDelimitedIntake(
      '\uFEFFJnUITS ID,Full Name,Email,Notes\r\n"00127","সাবিনা রহমান","sabina@example.com","First line\nsecond, line"'
    );

    expect(table.headers.map((header) => header.label)).toEqual([
      "JnUITS ID",
      "Full Name",
      "Email",
      "Notes",
    ]);
    expect(table.rows).toEqual([
      {
        sourceRowNumber: 2,
        values: {
          email: "sabina@example.com",
          full_name: "সাবিনা রহমান",
          jnuits_id: "00127",
          notes: "First line\nsecond, line",
        },
      },
    ]);
  });

  it("parses pasted TSV through the same table contract", () => {
    const table = parseDelimitedIntake(
      "নাম\tসদস্য আইডি\tশ্রেণি\nমোঃ করিম\t00042\tবর্তমান",
      { delimiter: "\t" }
    );

    expect(table.headers.map((header) => header.key)).toEqual([
      "নাম",
      "সদস্য_আইডি",
      "শ্রেণি",
    ]);
    expect(table.rows[0]).toEqual({
      sourceRowNumber: 2,
      values: {
        নাম: "মোঃ করিম",
        সদস্য_আইডি: "00042",
        শ্রেণি: "বর্তমান",
      },
    });
  });

  it.each(
    [
      ["Full Name,,Email\nA,,a@example.com", "blank_header"],
      ["Email,email\nfirst@example.com,second@example.com", "duplicate_header"],
    ] as const
  )("rejects ambiguous headers", (source, expectedCode) => {
    expect(() => parseDelimitedIntake(source)).toThrowError(
      expect.objectContaining<Partial<IntakeParseError>>({ code: expectedCode })
    );
  });

  it("rejects inputs larger than two MiB before parsing", () => {
    const source = `Name\n${"a".repeat(MAX_INTAKE_BYTES)}`;

    expect(() => parseDelimitedIntake(source)).toThrowError(
      expect.objectContaining<Partial<IntakeParseError>>({ code: "source_too_large" })
    );
  });

  it("accepts exactly 1,000 data rows and rejects the next row", () => {
    const accepted = ["ID", ...Array.from({ length: MAX_INTAKE_DATA_ROWS }, (_, index) => `${index}`)].join(
      "\n"
    );
    const rejected = `${accepted}\n1000`;

    expect(parseDelimitedIntake(accepted).rows).toHaveLength(MAX_INTAKE_DATA_ROWS);
    expect(() => parseDelimitedIntake(rejected)).toThrowError(
      expect.objectContaining<Partial<IntakeParseError>>({ code: "too_many_rows" })
    );
  });
});
