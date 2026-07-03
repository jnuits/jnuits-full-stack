"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  getSafeAdminActionErrorMessage,
  isUniqueConstraintError,
} from "@/lib/admin/action-error";
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
  csv_data: z.string().trim().min(1, "No CSV data provided.").max(5_000_000),
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

function isoDate(raw: string): string | null {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

function safeCertificateError(error: unknown, context: string, fallback: string) {
  return getSafeAdminActionErrorMessage(error, {
    context: `certificates.${context}`,
    fallback,
  });
}

function normalizeFullName(...parts: Array<string | null | undefined>) {
  return parts
    .map((part) => (part || "").trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}


type CertificateWritePayload = {
  asset_url: string | null;
  certificate_id: string;
  details: string;
  exam_or_event: z.infer<typeof certificateTypeSchema>;
  exam_or_event_name: string;
  full_name: string;
  issue_date: string;
  source_migrated_at?: string;
  updated_at: string;
};


function isCertificateType(value: string | undefined) {
  return certificateTypeSchema.safeParse(value).success;
}

type ParsedCertificateCsvLine = {
  assetUrl: string | null;
  certId: string;
  examOrEvent: string;
  examOrEventName: string;
  fullName: string;
  issueDate: string | null;
};

function parseCertificateCsvLine(cols: string[]): ParsedCertificateCsvLine {
  const rawCertId = cols[0] ?? "";
  const looksLikeNewFormat = isCertificateType(cols[2]) && Boolean(isoDate(cols[4] ?? ""));

  if (looksLikeNewFormat) {
    return {
      assetUrl: cols[5] || null,
      certId: normId(rawCertId),
      examOrEvent: cols[2] ?? "",
      examOrEventName: cols[3] ?? "",
      fullName: normalizeFullName(cols[1]),
      issueDate: isoDate(cols[4] ?? ""),
    };
  }

  return {
    assetUrl: cols[6] || null,
    certId: normId(rawCertId),
    examOrEvent: cols[3] ?? "",
    examOrEventName: cols[4] ?? "",
    fullName: normalizeFullName(cols[1], cols[2]),
    issueDate: isoDate(cols[5] ?? ""),
  };
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

  const issueDate = isoDate(issueDateRaw);
  if (!issueDate) {
    await setAdminFlash({
      tone: "error",
      title: "Invalid date",
      message: "The issue date could not be parsed. Use YYYY-MM-DD format.",
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

// ── Bulk CSV import (new rows: certId,fullName,type,eventName,issueDate,assetUrl) ───

export async function bulkImportCertificatesAction(formData: FormData) {
  const auth = await requireAdminPermission("admin.certificates.manage", {
    fallbackPath: "/admin/certificates",
  });
  if (!auth.user) redirect("/admin");

  const parsed = bulkImportSchema.safeParse(
    pickFormFields(formData, ["csv_data", "source_name", "on_conflict"])
  );

  if (!parsed.success) {
    await setAdminFlash({
      tone: "error",
      title: "Import failed",
      message: parsed.error.issues[0]?.message || "No CSV data provided.",
    });
    redirect("/admin/certificates");
  }

  const csvText = parsed.data.csv_data;
  const sourceName = parsed.data.source_name || `manual-import-${Date.now()}`;
  const onConflict = parsed.data.on_conflict; // "skip" | "update"

  const lines = csvText.split("\n").map((l) => l.trim()).filter(Boolean);
  const headerLine = lines[0]?.toLowerCase() ?? "";
  const dataLines = headerLine.includes("certid") ||
    headerLine.includes("certificate_id") ||
    headerLine.includes("fullname") ||
    headerLine.includes("full_name") ||
    headerLine.includes("first")
    ? lines.slice(1)
    : lines;

  const admin = createAdminClient();

  // Create a batch record
  const now = new Date().toISOString();
  const { data: batch, error: batchError } = await admin
    .from("certificate_import_batches")
    .insert({
      source_name: sourceName,
      source_row_count: dataLines.length,
      status: "processing",
      started_at: now,
    })
    .select("id")
    .single();

  if (batchError || !batch) {
    await setAdminFlash({ tone: "error", title: "Import failed", message: "Could not create import batch." });
    redirect("/admin/certificates");
  }

  let inserted = 0;
  let updated = 0;
  let rejected = 0;
  const errors: string[] = [];

  for (const [lineIdx, line] of dataLines.entries()) {
    const cols = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
    // New: certId, fullName, type, eventName, issueDate, assetUrl?
    // Legacy fallback: certId, firstName, lastName, type, eventName, issueDate, assetUrl?
    const {
      assetUrl,
      certId,
      examOrEvent,
      examOrEventName,
      fullName,
      issueDate,
    } = parseCertificateCsvLine(cols);

    if (!certId || !fullName || !examOrEvent || !examOrEventName || !issueDate) {
      rejected++;
      errors.push(`Row ${lineIdx + 2}: missing required field(s) — "${line.slice(0, 60)}"`);
      continue;
    }

    const parsedType = certificateTypeSchema.safeParse(examOrEvent);
    if (!parsedType.success) {
      rejected++;
      errors.push(`Row ${lineIdx + 2}: type must be Event, Exam, or Course.`);
      continue;
    }

    const payload: CertificateWritePayload = {
      certificate_id: certId,
      full_name: fullName,
      details: "",
      exam_or_event: parsedType.data,
      exam_or_event_name: examOrEventName,
      issue_date: issueDate,
      asset_url: assetUrl || null,
      source_migrated_at: now,
      updated_at: now,
    };

    if (onConflict === "update") {
      const { data: existing } = await admin
        .from("certificates")
        .select("id")
        .eq("certificate_id", certId)
        .maybeSingle();

      if (existing) {
        const { error } = await admin.from("certificates").update(payload).eq("id", existing.id);
        if (error) {
          rejected++;
          errors.push(
            `Row ${lineIdx + 2}: update failed - ${safeCertificateError(
              error,
              "bulkImport.update",
              "certificate could not be updated"
            )}`
          );
        }
        else updated++;
        continue;
      }
    }

    const { error } = await admin.from("certificates").insert(payload);
    if (error) {
      if (isUniqueConstraintError(error)) {
        // Skip duplicate
        errors.push(`Row ${lineIdx + 2}: skipped (${certId} already exists)`);
      } else {
        rejected++;
        errors.push(
          `Row ${lineIdx + 2}: insert failed - ${safeCertificateError(
            error,
            "bulkImport.insert",
            "certificate could not be inserted"
          )}`
        );
      }
    } else {
      inserted++;
    }
  }

  // Finalise batch
  await admin.from("certificate_import_batches").update({
    status: "completed",
    inserted_count: inserted,
    updated_count: updated,
    rejected_count: rejected,
    finished_at: new Date().toISOString(),
    report: { errors: errors.slice(0, 50) },
  }).eq("id", batch.id);

  revalidatePath("/admin/certificates");

  if (rejected === 0) {
    await setAdminFlash({
      tone: "success",
      title: "Import complete",
      message: `${inserted} inserted, ${updated} updated from ${dataLines.length} rows.`,
    });
  } else {
    await setAdminFlash({
      tone: "error",
      title: `Import complete with ${rejected} error(s)`,
      message: `${inserted} inserted, ${updated} updated, ${rejected} rejected. First error: ${errors[0] ?? "unknown"}.`,
    });
  }

  redirect("/admin/certificates");
}
