import { parse } from "csv-parse/sync";
import {
  assertIntakeSourceSize,
  createIntakeTableFromRows,
  IntakeParseError,
  type IntakeTable,
} from "./intake-contracts";

type DelimitedIntakeOptions = {
  delimiter?: "," | "\t";
};

export function parseDelimitedIntake(
  source: string | Buffer,
  options: DelimitedIntakeOptions = {}
): IntakeTable {
  const bytes = Buffer.isBuffer(source) ? source : Buffer.from(source, "utf8");
  assertIntakeSourceSize(bytes.byteLength);

  let records: string[][];
  try {
    records = parse(bytes, {
      bom: true,
      cast: false,
      delimiter: options.delimiter ?? ",",
      encoding: "utf8",
      relax_column_count: false,
      skip_empty_lines: true,
    }) as string[][];
  } catch (error) {
    throw new IntakeParseError(
      "invalid_delimited_source",
      error instanceof Error ? error.message : "The delimited source could not be parsed."
    );
  }

  return createIntakeTableFromRows(records);
}
