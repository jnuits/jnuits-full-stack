import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminApiPermission } from "@/lib/admin/api-auth";
import {
  formSubmissionsToExportTable,
  type FormSubmissionExportRow,
} from "@/lib/exports/form-submissions";
import { createCsv, sha256 } from "@/lib/exports/tabular";
import { createXlsxWorkbook } from "@/lib/exports/xlsx";
import { uploadGoogleSheetSnapshot } from "@/lib/integrations/google-drive";
import { withApiGuard } from "@/lib/security/with-api-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { asFlexibleClient } from "@/lib/supabase/flexible";

export const runtime = "nodejs";

const EXPORT_PAGE_SIZE = 500;
const MAX_EXPORT_ROWS = 10_000;
const formIdSchema = z.string().uuid();
const formatSchema = z.enum(["csv", "google-sheet", "xlsx"]);

type FormDefinitionRow = {
  id: string;
  title: string;
};

type SubmissionRow = Omit<FormSubmissionExportRow, "assets"> & {
  form_submission_assets: FormSubmissionExportRow["assets"] | null;
};

function toExportRow(row: SubmissionRow): FormSubmissionExportRow {
  return {
    ...row,
    assets: Array.isArray(row.form_submission_assets) ? row.form_submission_assets : [],
  };
}

async function loadApprovedSubmissions(
  admin: ReturnType<typeof asFlexibleClient>,
  formDefinitionId: string
) {
  const rows: FormSubmissionExportRow[] = [];

  for (let from = 0; from < MAX_EXPORT_ROWS; from += EXPORT_PAGE_SIZE) {
    const { data, error } = await admin
      .from("form_submissions")
      .select(
        "id, form_version_id, submitter_email, answers, confirmation_status, review_status, created_at, form_submission_assets(field_id, cloudinary_asset_id, cloudinary_public_id, cloudinary_version, cloudinary_folder)"
      )
      .eq("form_definition_id", formDefinitionId)
      .eq("review_status", "approved")
      .order("created_at", { ascending: true })
      .range(from, from + EXPORT_PAGE_SIZE - 1);

    if (error) {
      throw new Error("Approved form submissions could not be exported.");
    }

    const page = (data || []) as unknown as SubmissionRow[];
    rows.push(...page.map(toExportRow));

    if (page.length < EXPORT_PAGE_SIZE) {
      return rows;
    }
  }

  throw new Error("This export exceeds the 10,000-row safety limit.");
}

async function handleGet(request: NextRequest, context: { params: Promise<{ formId?: string }> }) {
  const permission = await requireAdminApiPermission("admin.forms.export", {
    forbiddenMessage: "Only authorized administrators can export form submissions.",
    unauthenticatedMessage: "Sign in before exporting form submissions.",
  });

  if (permission.response) {
    return permission.response;
  }

  const { formId: rawFormId } = await context.params;
  const formId = typeof rawFormId === "string" ? formIdSchema.safeParse(rawFormId) : null;
  if (!formId?.success) {
    return NextResponse.json({ error: "Form not found." }, { status: 404 });
  }

  const format = formatSchema.safeParse(new URL(request.url).searchParams.get("format") || "csv");
  if (!format.success) {
    return NextResponse.json({ error: "Choose CSV, XLSX, or Google Sheet export." }, { status: 422 });
  }

  try {
    const admin = asFlexibleClient(createAdminClient());
    const { data: formData, error: formError } = await admin
      .from("form_definitions")
      .select("id, title")
      .eq("id", formId.data)
      .maybeSingle();
    const form = formData as FormDefinitionRow | null;

    if (formError || !form) {
      return NextResponse.json({ error: "Form not found." }, { status: 404 });
    }

    const rows = await loadApprovedSubmissions(admin, form.id);
    const table = formSubmissionsToExportTable(rows);
    const csv = createCsv(table);
    const exportName = `form-${form.id}-approved-submissions`;
    const body =
      format.data === "csv"
        ? Buffer.from(csv, "utf8")
        : format.data === "xlsx"
          ? createXlsxWorkbook(table, "Approved submissions")
          : null;
    const checksum = sha256(body || csv);
    // Content-addressed, so a double-clicked action or a retry resolves to the
    // same Drive file, while newly approved rows still produce a new snapshot.
    const googleSheet =
      format.data === "google-sheet"
        ? await uploadGoogleSheetSnapshot({
            csv,
            filename: `${exportName}-${new Date().toISOString().slice(0, 10)}`,
            idempotencyKey: `form-export:${form.id}:google-sheet:${checksum}`,
          })
        : null;
    const { error: jobError } = await admin.from("form_export_jobs").insert({
      checksum_sha256: checksum,
      completed_at: new Date().toISOString(),
      destination: googleSheet ? "google_drive" : "download",
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      filter_metadata: { review_status: "approved", schema_version: 1 },
      form_definition_id: form.id,
      format: format.data === "google-sheet" ? "google_sheet" : format.data,
      google_drive_file_id: googleSheet?.id || null,
      requested_by_user_id: permission.auth.user.id,
      row_count: rows.length,
      status: "completed",
    });

    if (jobError) {
      return NextResponse.json(
        { error: "The export audit record could not be saved." },
        { status: 500 }
      );
    }

    const { error: auditError } = await admin.from("audit_events").insert({
      action: "form.submissions_exported",
      actor_user_id: permission.auth.user.id,
      entity_id: form.id,
      entity_type: "form_definition",
      metadata: {
        checksum_sha256: checksum,
        destination: googleSheet ? "google_sheet" : "download",
        format: format.data,
        google_drive_file_id: googleSheet?.id || null,
        reused_snapshot: googleSheet?.reused || false,
        review_status: "approved",
        row_count: rows.length,
      },
    });

    if (auditError) {
      return NextResponse.json({ error: "The export audit record could not be saved." }, { status: 500 });
    }

    if (googleSheet) {
      return NextResponse.json(
        { id: googleSheet.id, success: true, webViewLink: googleSheet.webViewLink },
        { headers: { "Cache-Control": "private, no-store" } }
      );
    }

    const contentType =
      format.data === "csv"
        ? "text/csv; charset=utf-8"
        : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    const filename = `${exportName}.${format.data}`;

    return new NextResponse(body!, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Type": contentType,
        "X-Export-Checksum": checksum,
        "X-Export-Row-Count": String(rows.length),
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Approved form submissions could not be exported." },
      { status: 500 }
    );
  }
}

export const GET = withApiGuard(handleGet, { requireAuth: true });
