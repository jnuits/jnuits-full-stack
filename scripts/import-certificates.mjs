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
    apply: false,
    file: "",
    report: "",
    sourceName: "legacy-certificates-import-ready",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === "--apply") options.apply = true;
    if (token === "--dry-run") options.apply = false;
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
    if (token === "--source-name" && argv[index + 1]) {
      options.sourceName = argv[index + 1];
      index += 1;
    }
    if (token.startsWith("--source-name=")) {
      options.sourceName = token.split("=")[1] || options.sourceName;
    }
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
  const rejectedRows = csv.rows.filter((row) => row.parseError);
  const reportPath = resolveReportPath("certificate-import-report", options.report);

  const report = {
    mode: options.apply ? "apply" : "dry-run",
    generatedAt: new Date().toISOString(),
    source: {
      name: options.sourceName,
      filePath: csv.filePath,
      checksum: csv.checksum,
      rowCount: csv.rows.length,
    },
    validation: {
      validRows: cleanRows.length,
      rejectedRows: rejectedRows.length,
      duplicateCertificateIds,
      rejectedSamples: rejectedRows.slice(0, 25).map((row) => ({
        rowNumber: row.rowNumber,
        parseError: row.parseError,
      })),
    },
    execution: {
      batchId: null,
      inserted: 0,
      updated: 0,
      rejected: rejectedRows.length,
    },
  };

  if (options.apply) {
    const supabase = buildSupabaseAdminClient();
    const normalizedRows = cleanRows.map((row) => row.normalized);
    const certificateIds = normalizedRows.map((row) => row.certificate_id);
    const existingIds = new Set();

    for (const idChunk of chunk(certificateIds, 200)) {
      const { data, error } = await supabase
        .from("certificates")
        .select("certificate_id")
        .in("certificate_id", idChunk);

      if (error) {
        throw error;
      }

      for (const row of data || []) {
        existingIds.add(row.certificate_id);
      }
    }

    const { data: batchRow, error: batchError } = await supabase
      .from("certificate_import_batches")
      .insert({
        source_name: options.sourceName,
        source_checksum: csv.checksum,
        source_row_count: csv.rows.length,
        status: "pending",
      })
      .select("id")
      .single();

    if (batchError || !batchRow) {
      throw batchError || new Error("Unable to create certificate import batch.");
    }

    report.execution.batchId = batchRow.id;

    for (const stagingChunk of chunk(csv.rows, 250)) {
      const stagingRows = stagingChunk.map((row) => ({
        import_batch_id: batchRow.id,
        row_number: row.rowNumber,
        certificate_id_raw: row.raw.certificateID || row.raw.certificate_id || null,
        full_name_raw: row.raw.fullName || row.raw.full_name || row.raw.name || null,
        first_name_raw: row.raw.firstName || row.raw.first_name || null,
        last_name_raw: row.raw.lastName || row.raw.last_name || null,
        details_raw: row.raw.details || null,
        exam_or_event_raw: row.raw.exam_or_event || row.raw.examOrEvent || null,
        exam_or_event_name_raw:
          row.raw.exam_or_event_name || row.raw.examOrEventName || null,
        issue_date_raw: row.raw.issueDate || row.raw.issue_date || null,
        asset_url_raw: row.raw.assetUrl || row.raw.asset_url || null,
        source_document_id_raw:
          row.raw.documentId || row.raw.source_document_id || null,
        source_record_id_raw: row.raw.recordId || row.raw.source_record_id || null,
        parse_error: row.parseError,
      }));

      const { error } = await supabase
        .from("certificates_import_staging")
        .insert(stagingRows);

      if (error) {
        throw error;
      }
    }

    for (const upsertChunk of chunk(normalizedRows, 250)) {
      const { error } = await supabase.from("certificates").upsert(upsertChunk, {
        onConflict: "certificate_id",
      });

      if (error) {
        throw error;
      }
    }

    report.execution.inserted = normalizedRows.filter(
      (row) => !existingIds.has(row.certificate_id)
    ).length;
    report.execution.updated = normalizedRows.filter((row) =>
      existingIds.has(row.certificate_id)
    ).length;

    const { error: finalizeError } = await supabase
      .from("certificate_import_batches")
      .update({
        status: "completed",
        inserted_count: report.execution.inserted,
        updated_count: report.execution.updated,
        rejected_count: report.execution.rejected,
        finished_at: new Date().toISOString(),
        report,
      })
      .eq("id", batchRow.id);

    if (finalizeError) {
      throw finalizeError;
    }

    await supabase.from("audit_events").insert({
      action: "certificates.imported",
      entity_type: "certificate_import_batch",
      entity_id: batchRow.id,
      metadata: {
        sourceName: options.sourceName,
        checksum: csv.checksum,
        inserted: report.execution.inserted,
        updated: report.execution.updated,
        rejected: report.execution.rejected,
      },
    });
  }

  writeJsonReport(reportPath, report);

  console.log("");
  console.log("Certificate import report generated.");
  console.log(`Mode: ${report.mode}`);
  console.log(`CSV: ${csv.filePath}`);
  console.log(`Report: ${reportPath}`);
  console.log(`Valid rows: ${report.validation.validRows}`);
  console.log(`Rejected rows: ${report.validation.rejectedRows}`);
  console.log(`Duplicate certificate IDs: ${report.validation.duplicateCertificateIds.length}`);
  console.log(`Inserted: ${report.execution.inserted}`);
  console.log(`Updated: ${report.execution.updated}`);
}

main().catch((error) => {
  console.error("Certificate import failed.");
  console.error(String(error));
  process.exitCode = 1;
});
