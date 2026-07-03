#!/usr/bin/env node

import process from "node:process";
import {
  buildSupabaseAdminClient,
  chunk,
  dedupeNormalizedRows,
  loadCertificateCsv,
  resolveReportPath,
  writeJsonReport,
} from "./lib/certificates.mjs";

function parseArgs(argv) {
  const options = {
    file: "",
    report: "",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === "--file" && argv[index + 1]) {
      options.file = argv[index + 1];
      index += 1;
    }
    if (token.startsWith("--file=")) options.file = token.split("=")[1] || "";
    if (token === "--report" && argv[index + 1]) {
      options.report = argv[index + 1];
      index += 1;
    }
    if (token.startsWith("--report=")) options.report = token.split("=")[1] || "";
  }

  if (!options.file) {
    throw new Error("--file is required.");
  }

  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const csv = loadCertificateCsv(options.file);
  const { cleanRows, duplicateCertificateIds } = dedupeNormalizedRows(csv.rows);
  const normalizedRows = cleanRows
    .map((row) => row.normalized)
    .filter(Boolean);
  const supabase = buildSupabaseAdminClient();
  const certificateIds = normalizedRows.map((row) => row.certificate_id);
  const dbRows = [];

  for (const idChunk of chunk(certificateIds, 200)) {
    const { data, error } = await supabase
      .from("certificates")
      .select(
        "certificate_id, full_name, details, exam_or_event, exam_or_event_name, issue_date, asset_url"
      )
      .in("certificate_id", idChunk);

    if (error) {
      throw error;
    }

    dbRows.push(...(data || []));
  }

  const dbById = new Map(dbRows.map((row) => [row.certificate_id, row]));
  const missing = [];
  const mismatches = [];

  for (const row of normalizedRows) {
    const dbRow = dbById.get(row.certificate_id);

    if (!dbRow) {
      missing.push(row.certificate_id);
      continue;
    }

    const fieldsToCheck = [
      "full_name",
      "details",
      "exam_or_event",
      "exam_or_event_name",
      "issue_date",
      "asset_url",
    ];

    for (const field of fieldsToCheck) {
      const expected = row[field] || null;
      const actual = dbRow[field] || null;

      if (expected !== actual) {
        mismatches.push({
          certificateId: row.certificate_id,
          field,
          expected,
          actual,
        });
      }
    }
  }

  const reportPath = resolveReportPath("certificate-parity-report", options.report);
  const report = {
    generatedAt: new Date().toISOString(),
    source: {
      filePath: csv.filePath,
      checksum: csv.checksum,
      requestedRows: csv.rows.length,
      normalizedRows: normalizedRows.length,
    },
    parity: {
      databaseRowsMatched: dbRows.length,
      missingCount: missing.length,
      mismatchCount: mismatches.length,
      duplicateCertificateIds,
      missingSample: missing.slice(0, 50),
      mismatchSample: mismatches.slice(0, 50),
    },
  };

  writeJsonReport(reportPath, report);

  console.log("");
  console.log("Certificate verification report generated.");
  console.log(`CSV: ${csv.filePath}`);
  console.log(`Report: ${reportPath}`);
  console.log(`Normalized rows: ${normalizedRows.length}`);
  console.log(`Database matches: ${dbRows.length}`);
  console.log(`Missing IDs: ${missing.length}`);
  console.log(`Field mismatches: ${mismatches.length}`);
}

main().catch((error) => {
  console.error("Certificate verification failed.");
  console.error(String(error));
  process.exitCode = 1;
});
