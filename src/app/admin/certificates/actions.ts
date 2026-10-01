"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  getSafeAdminActionErrorMessage,
  isUniqueConstraintError,
} from "@/lib/admin/action-error";
import {
  CERTIFICATE_IMPORT_CHUNK_SIZE,
  CertificateImportInputError,
  getDefaultCertificateImportSourceName,
  parseCertificateImportCsv,
  readCertificateImportSource,
  type CertificateImportRecord,
} from "@/lib/certificates/admin-import";
import { normalizeCertificateIssueDate } from "@/lib/certificates/date";
import {
  formatCertificateImportIssue,
  type CertificateImportInspection,
} from "@/lib/certificates/import-catalog";
import { requireAdminPermission } from "@/lib/auth/session";
import { setAdminFlash } from "@/lib/admin/flash";
import { createAdminClient } from "@/lib/supabase/admin";

// ── Helpers ───────────────────────────────────────────────────────────────────

function asString(v: FormDataEntryValue | null): string {
  return typeof v === "string" ? v.trim() : "";
}

const certificateTypeSchema = z.enum(["Event", "Exam", "Course"]);

const upsertCertificateSchema = z.object({
  asset_url: z.string().trim().url().optional().or(z.literal("")),
  certificate_id: z.string().trim().min(1).max(80),
  details: z.string().trim().max(3000).optional().default(""),
  exam_or_event: certificateTypeSchema,
  exam_or_event_name: z.string().trim().min(1).max(180),
  full_name: z.string().trim().min(1).max(180),
  id: z.string().trim().max(80).optional().default(""),
  issue_date: z.string().trim().min(1).max(40),
});

const deleteCertificateSchema = z.object({
  id: z.string().trim().min(1).max(80),
});

const fixCertTypeSchema = z.object({
  exam_or_event: certificateTypeSchema,
  id: z.string().trim().min(1).max(80),
});

const bulkImportSchema = z.object({
  on_conflict: z.enum(["skip", "update"]).optional().default("skip"),
  source_name: z.string().trim().max(180).optional().default(""),
});

function pickFormFields(formData: FormData, fields: string[]) {
  return Object.fromEntries(
    fields.map((field) => [field, asString(formData.get(field))])
  );
}

function normId(raw: string): string {
  return raw.trim().toUpperCase();
}

function safeCertificateError(error: unknown, context: string, fallback: string) {
  return getSafeAdminActionErrorMessage(error, {
    context: `certificates.${context}`,
    fallback,
  });
}

type CertificateWritePayload = CertificateImportRecord & {
  source_migrated_at?: string;
  updated_at: string;
};

function chunkValues<T>(values: T[], size: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }

  return chunks;
}
// ── Add / Update single certificate ─────────────────────────────────────────

export async function upsertCertificateAction(formData: FormData) {
  const auth = await requireAdminPermission("admin.certificates.manage", {
    fallbackPath: "/admin/certificates",
  });
  if (!auth.user) redirect("/admin");

  const parsed = upsertCertificateSchema.safeParse(
    pickFormFields(formData, [
      "id",
      "certificate_id",
      "full_name",
      "details",
      "exam_or_event",
      "exam_or_event_name",
      "issue_date",
      "asset_url",
    ])
  );

  if (!parsed.success) {
    await setAdminFlash({
      tone: "error",
      title: "Validation failed",
      message:
        parsed.error.issues[0]?.message ||
        "Certificate ID, full name, type, event name, and issue date are all required.",
    });
    redirect("/admin/certificates");
  }

  const {
    details,
    exam_or_event: examOrEvent,
    exam_or_event_name: examOrEventName,
    full_name: fullName,
    id,
    issue_date: issueDateRaw,
  } = parsed.data;
  const certificateId = normId(parsed.data.certificate_id);
  const assetUrl = parsed.data.asset_url || null;

  const issueDate = normalizeCertificateIssueDate(issueDateRaw);
  if (!issueDate) {
    await setAdminFlash({
      tone: "error",
      title: "Invalid date",
      message: "Use a valid day-first date, for example 05-11-26 or 05/11/26.",
    });
    redirect("/admin/certificates");
  }

  const admin = createAdminClient();

  const payload = {
    certificate_id: certificateId,
    full_name: fullName,
    details,
    exam_or_event: examOrEvent,
    exam_or_event_name: examOrEventName,
    issue_date: issueDate,
    asset_url: assetUrl,
    updated_at: new Date().toISOString(),
  };

  if (id) {
    // Update
    const { error } = await admin.from("certificates").update(payload).eq("id", id);
    if (error) {
      await setAdminFlash({
        tone: "error",
        title: "Update failed",
        message: safeCertificateError(error, "upsert.update", "Certificate could not be updated."),
      });
    } else {
      await setAdminFlash({ tone: "success", title: "Certificate updated", message: `${certificateId} has been updated.` });
    }
  } else {
    // Insert
    const { error } = await admin.from("certificates").insert({
      ...payload,
      source_migrated_at: new Date().toISOString(),
    });
    if (error) {
      await setAdminFlash({
        tone: "error",
        title: "Insert failed",
        message: isUniqueConstraintError(error)
          ? `Certificate ID "${certificateId}" already exists.`
          : safeCertificateError(error, "upsert.insert", "Certificate could not be created."),
      });
    } else {
      await setAdminFlash({ tone: "success", title: "Certificate added", message: `${certificateId} was created successfully.` });
    }
  }

  revalidatePath("/admin/certificates");
  redirect("/admin/certificates");
}

// ── Delete certificate ────────────────────────────────────────────────────────

export async function deleteCertificateAction(formData: FormData) {
  const auth = await requireAdminPermission("admin.certificates.manage", {
    fallbackPath: "/admin/certificates",
  });
  if (!auth.user) redirect("/admin");

  const parsed = deleteCertificateSchema.safeParse(pickFormFields(formData, ["id"]));
  if (!parsed.success) {
    await setAdminFlash({ tone: "error", title: "Delete failed", message: "No certificate ID provided." });
    redirect("/admin/certificates");
  }

  const { id } = parsed.data;
  const admin = createAdminClient();
  const { data: cert } = await admin
    .from("certificates")
    .select("certificate_id")
    .eq("id", id)
    .maybeSingle();

  const { error } = await admin.from("certificates").delete().eq("id", id);

  if (error) {
    await setAdminFlash({
      tone: "error",
      title: "Delete failed",
      message: safeCertificateError(error, "delete", "Certificate could not be deleted."),
    });
  } else {
    await setAdminFlash({
      tone: "success",
      title: "Certificate deleted",
      message: cert ? `${cert.certificate_id} was permanently removed.` : "Certificate removed.",
    });
  }

  revalidatePath("/admin/certificates");
  redirect("/admin/certificates");
}

// ── Fix exam_or_event value on a cert ─────────────────────────────────────────

export async function fixCertTypeAction(formData: FormData) {
  const auth = await requireAdminPermission("admin.certificates.manage", {
    fallbackPath: "/admin/certificates",
  });
  if (!auth.user) redirect("/admin");

  const parsed = fixCertTypeSchema.safeParse(
    pickFormFields(formData, ["id", "exam_or_event"])
  );

  if (!parsed.success) {
    await setAdminFlash({ tone: "error", title: "Fix failed", message: "ID and type are required." });
    redirect("/admin/certificates");
  }

  const { id, exam_or_event: examOrEvent } = parsed.data;
  const admin = createAdminClient();
  const { error } = await admin
    .from("certificates")
    .update({ exam_or_event: examOrEvent, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    await setAdminFlash({
      tone: "error",
      title: "Fix failed",
      message: safeCertificateError(error, "fixType", "Certificate type could not be updated."),
    });
  } else {
    await setAdminFlash({ tone: "success", title: "Type corrected", message: `Certificate type updated to "${examOrEvent}".` });
  }

  revalidatePath("/admin/certificates");
  redirect("/admin/certificates");
}

// ── Bulk CSV import ───────────────────────────────────────────────────────────

export async function inspectCertificateImportAction(
  formData: FormData
): Promise<CertificateImportInspection> {
  const auth = await requireAdminPermission("admin.certificates.manage", {
    fallbackPath: "/admin/certificates",
  });
  if (!auth.user) redirect("/admin");

  try {
    const source = await readCertificateImportSource(formData);
    const csv = parseCertificateImportCsv(source.csvText);
    const issues = csv.rows.flatMap((row) => row.errors);
    return {
      issues,
      message: `${csv.validRows.length} valid rows, ${issues.length} validation issues, and ${csv.ignoredRowCount} template rows ignored. No records have been saved.`,
      ok: issues.length === 0,
    };
  } catch (error) {
    return {
      issues: error instanceof CertificateImportInputError ? [...error.issues] : [],
      message: error instanceof CertificateImportInputError
        ? error.message
        : "The CSV could not be checked. Try again or download the template.",
      ok: false,
    };
  }
}

export async function bulkImportCertificatesAction(formData: FormData) {
  const auth = await requireAdminPermission("admin.certificates.manage", {
    fallbackPath: "/admin/certificates",
  });
  if (!auth.user) redirect("/admin");

  const parsed = bulkImportSchema.safeParse(
    pickFormFields(formData, ["source_name", "on_conflict"])
  );

  if (!parsed.success) {
    await setAdminFlash({
      tone: "error",
      title: "Import failed",
      message: parsed.error.issues[0]?.message || "Check the import settings and try again.",
    });
    redirect("/admin/certificates");
  }

  let source: Awaited<ReturnType<typeof readCertificateImportSource>>;
  let csv: ReturnType<typeof parseCertificateImportCsv>;

  try {
    source = await readCertificateImportSource(formData);
    csv = parseCertificateImportCsv(source.csvText);
  } catch (error) {
    await setAdminFlash({
      tone: "error",
      title: "Import could not start",
      message:
        error instanceof CertificateImportInputError
          ? error.message
          : "The CSV could not be read. Download the template and try again.",
    });
    redirect("/admin/certificates");
  }

  const onConflict = parsed.data.on_conflict;
  const sourceName =
    parsed.data.source_name || getDefaultCertificateImportSourceName(source.fileName);
  const now = new Date().toISOString();
  const admin = createAdminClient();

  const { data: batch, error: batchError } = await admin
    .from("certificate_import_batches")
    .insert({
      source_name: sourceName,
      source_row_count: csv.dataRowCount,
      // The persisted batch lifecycle is pending -> completed | failed.
      // Imports are synchronous, so a separate processing state is not needed.
      status: "pending",
      started_at: now,
    })
    .select("id")
    .single();

  if (batchError || !batch) {
    await setAdminFlash({
      tone: "error",
      title: "Import failed",
      message: "The import batch could not be prepared. Please try again.",
    });
    redirect("/admin/certificates");
  }

  let inserted = 0;
  let updated = 0;
  let rejected = csv.rows.filter(
    (row) => row.certificate === null && !row.ignored
  ).length;
  let skipped = csv.ignoredRowCount;
  const errors = csv.rows.flatMap((row) =>
    row.errors.map(
      (issue) => "Row " + row.rowNumber + ": " + formatCertificateImportIssue(issue)
    )
  );

  if (csv.ignoredRowCount > 0) {
    errors.push(
      String(csv.ignoredRowCount) +
        " template example " +
        (csv.ignoredRowCount === 1 ? "row was" : "rows were") +
        " ignored."
    );
  }

  const latestRowByCertificateId = new Map<
    string,
    { certificate: CertificateImportRecord; rowNumber: number }
  >();

  for (const row of csv.validRows) {
    const certificate = row.certificate;
    const previous = latestRowByCertificateId.get(certificate.certificate_id);

    if (previous) {
      skipped += 1;
      errors.push(
        onConflict === "update"
          ? `Row ${previous.rowNumber}: replaced by the later duplicate certificate ID on row ${row.rowNumber}.`
          : `Row ${row.rowNumber}: duplicate certificate ID in this file was skipped.`
      );

      if (onConflict !== "update") continue;
    }

    latestRowByCertificateId.set(certificate.certificate_id, {
      certificate,
      rowNumber: row.rowNumber,
    });
  }

  const selectedRows = Array.from(latestRowByCertificateId.values());
  const existingCertificateIds = new Set<string>();

  for (const chunk of chunkValues(
    selectedRows.map((row) => row.certificate.certificate_id),
    CERTIFICATE_IMPORT_CHUNK_SIZE
  )) {
    const { data, error } = await admin
      .from("certificates")
      .select("certificate_id")
      .in("certificate_id", chunk);

    if (error) {
      await admin
        .from("certificate_import_batches")
        .update({
          finished_at: new Date().toISOString(),
          rejected_count: csv.dataRowCount,
          report: { errors: ["Existing certificate records could not be checked safely."] },
          status: "failed",
        })
        .eq("id", batch.id);

      await setAdminFlash({
        tone: "error",
        title: "Import could not continue",
        message: "Existing certificate records could not be checked. No rows were imported.",
      });
      redirect("/admin/certificates");
    }

    for (const record of data || []) {
      existingCertificateIds.add(record.certificate_id);
    }
  }

  const rowsToWrite = selectedRows.filter((row) => {
    if (onConflict === "update" || !existingCertificateIds.has(row.certificate.certificate_id)) {
      return true;
    }

    skipped += 1;
    errors.push(`Row ${row.rowNumber}: certificate ID already exists and was skipped.`);
    return false;
  });

  for (const chunk of chunkValues(rowsToWrite, CERTIFICATE_IMPORT_CHUNK_SIZE)) {
    const payloads: CertificateWritePayload[] = chunk.map(({ certificate }) => ({
      ...certificate,
      source_migrated_at: now,
      updated_at: now,
    }));
    const { error } = await admin.from("certificates").upsert(payloads, {
      ignoreDuplicates: onConflict === "skip",
      onConflict: "certificate_id",
    });

    if (error) {
      rejected += chunk.length;
      const firstRow = chunk[0]?.rowNumber ?? 0;
      const lastRow = chunk.at(-1)?.rowNumber ?? firstRow;
      errors.push(
        firstRow === lastRow
          ? `Row ${firstRow}: could not be saved. Try that row again.`
          : `Rows ${firstRow}-${lastRow}: could not be saved. Split the file and try again.`
      );
      continue;
    }

    for (const row of chunk) {
      if (existingCertificateIds.has(row.certificate.certificate_id)) {
        updated += 1;
      } else {
        inserted += 1;
      }
    }
  }

  await admin
    .from("certificate_import_batches")
    .update({
      finished_at: new Date().toISOString(),
      inserted_count: inserted,
      rejected_count: rejected,
      report: { errors: errors.slice(0, 50), skipped_count: skipped },
      status: "completed",
      updated_count: updated,
    })
    .eq("id", batch.id);

  revalidatePath("/admin/certificates");

  if (rejected === 0) {
    await setAdminFlash({
      tone: "success",
      title: "Import complete",
      message: `${inserted} added, ${updated} updated, and ${skipped} skipped from ${csv.dataRowCount} rows.`,
    });
  } else {
    await setAdminFlash({
      tone: "error",
      title: "Import completed with review needed",
      message: `${inserted} added, ${updated} updated, ${skipped} skipped, and ${rejected} rejected. Review the batch history for the first issues.`,
    });
  }

  redirect("/admin/certificates");
}
