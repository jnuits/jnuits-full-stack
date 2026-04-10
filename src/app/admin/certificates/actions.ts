"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminUser } from "@/lib/auth/session";
import { setAdminFlash } from "@/lib/admin/flash";
import { createAdminClient } from "@/lib/supabase/admin";

// ── Helpers ───────────────────────────────────────────────────────────────────

function asString(v: FormDataEntryValue | null): string {
  return typeof v === "string" ? v.trim() : "";
}

function normId(raw: string): string {
  return raw.trim().toUpperCase();
}

function isoDate(raw: string): string | null {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

// ── Add / Update single certificate ─────────────────────────────────────────

export async function upsertCertificateAction(formData: FormData) {
  const auth = await requireAdminUser();
  if (!auth.user) redirect("/admin");

  const id = asString(formData.get("id")); // empty = create
  const certificateId = normId(asString(formData.get("certificate_id")));
  const firstName = asString(formData.get("first_name"));
  const lastName = asString(formData.get("last_name"));
  const details = asString(formData.get("details"));
  const examOrEvent = asString(formData.get("exam_or_event"));
  const examOrEventName = asString(formData.get("exam_or_event_name"));
  const issueDateRaw = asString(formData.get("issue_date"));
  const assetUrl = asString(formData.get("asset_url")) || null;

  if (!certificateId || !firstName || !lastName || !examOrEvent || !examOrEventName || !issueDateRaw) {
    await setAdminFlash({
      tone: "error",
      title: "Validation failed",
      message: "Certificate ID, first name, last name, type, event name, and issue date are all required.",
    });
    redirect("/admin/certificates");
  }

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
    first_name: firstName,
    last_name: lastName,
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
      await setAdminFlash({ tone: "error", title: "Update failed", message: error.message });
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
        message: error.message.includes("unique") ? `Certificate ID "${certificateId}" already exists.` : error.message,
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
  const auth = await requireAdminUser();
  if (!auth.user) redirect("/admin");

  const id = asString(formData.get("id"));
  if (!id) {
    await setAdminFlash({ tone: "error", title: "Delete failed", message: "No certificate ID provided." });
    redirect("/admin/certificates");
  }

  const admin = createAdminClient();
  const { data: cert } = await admin
    .from("certificates")
    .select("certificate_id")
    .eq("id", id)
    .maybeSingle();

  const { error } = await admin.from("certificates").delete().eq("id", id);

  if (error) {
    await setAdminFlash({ tone: "error", title: "Delete failed", message: error.message });
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
  const auth = await requireAdminUser();
  if (!auth.user) redirect("/admin");

  const id = asString(formData.get("id"));
  const examOrEvent = asString(formData.get("exam_or_event"));

  if (!id || !examOrEvent) {
    await setAdminFlash({ tone: "error", title: "Fix failed", message: "ID and type are required." });
    redirect("/admin/certificates");
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("certificates")
    .update({ exam_or_event: examOrEvent, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    await setAdminFlash({ tone: "error", title: "Fix failed", message: error.message });
  } else {
    await setAdminFlash({ tone: "success", title: "Type corrected", message: `Certificate type updated to "${examOrEvent}".` });
  }

  revalidatePath("/admin/certificates");
  redirect("/admin/certificates");
}

// ── Bulk CSV import (paste rows: certId,firstName,lastName,type,eventName,issueDate,assetUrl) ───

export async function bulkImportCertificatesAction(formData: FormData) {
  const auth = await requireAdminUser();
  if (!auth.user) redirect("/admin");

  const csvText = asString(formData.get("csv_data"));
  const sourceName = asString(formData.get("source_name")) || `manual-import-${Date.now()}`;
  const onConflict = asString(formData.get("on_conflict")) || "skip"; // "skip" | "update"

  if (!csvText) {
    await setAdminFlash({ tone: "error", title: "Import failed", message: "No CSV data provided." });
    redirect("/admin/certificates");
  }

  const lines = csvText.split("\n").map((l) => l.trim()).filter(Boolean);
  // Skip header row if it starts with non-numeric/cert characters
  const dataLines = lines[0]?.toLowerCase().includes("certid") ||
    lines[0]?.toLowerCase().includes("certificate_id") ||
    lines[0]?.toLowerCase().includes("first")
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
    // Expected: certId, firstName, lastName, examOrEvent, examOrEventName, issueDate, assetUrl?
    const [rawCertId, rawFirst, rawLast, rawType, rawEventName, rawDate, rawUrl] = cols;

    const certId = normId(rawCertId ?? "");
    const firstName = rawFirst ?? "";
    const lastName = rawLast ?? "";
    const examOrEvent = rawType ?? "";
    const examOrEventName = rawEventName ?? "";
    const issueDate = isoDate(rawDate ?? "");
    const assetUrl = rawUrl ?? null;

    if (!certId || !firstName || !lastName || !examOrEvent || !examOrEventName || !issueDate) {
      rejected++;
      errors.push(`Row ${lineIdx + 2}: missing required field(s) — "${line.slice(0, 60)}"`);
      continue;
    }

    const payload = {
      certificate_id: certId,
      first_name: firstName,
      last_name: lastName,
      details: "",
      exam_or_event: examOrEvent,
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
        if (error) { rejected++; errors.push(`Row ${lineIdx + 2}: update failed — ${error.message}`); }
        else updated++;
        continue;
      }
    }

    const { error } = await admin.from("certificates").insert(payload);
    if (error) {
      if (error.message.includes("unique")) {
        // Skip duplicate
        errors.push(`Row ${lineIdx + 2}: skipped (${certId} already exists)`);
      } else {
        rejected++;
        errors.push(`Row ${lineIdx + 2}: insert failed — ${error.message}`);
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
