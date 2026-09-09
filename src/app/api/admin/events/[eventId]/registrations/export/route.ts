import { type NextRequest, NextResponse } from "next/server";
import { requireAdminApiPermission } from "@/lib/admin/api-auth";
import { hasPermission } from "@/lib/auth/session";
import { resolveEventForAdminMutation } from "@/lib/content/events";
import {
  eventRegistrationsToExportTable,
  type EventRegistrationExportRow,
} from "@/lib/exports/event-registrations";
import { createCsv, sha256 } from "@/lib/exports/tabular";
import { createXlsxWorkbook } from "@/lib/exports/xlsx";
import {
  buildEventRegistrationSearchPattern,
  parseEventRegistrationFilters,
  type EventRegistrationStatus,
} from "@/lib/events/operations-filters";
import { uploadGoogleSheetSnapshot } from "@/lib/integrations/google-drive";
import { withApiGuard } from "@/lib/security/with-api-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { asFlexibleClient } from "@/lib/supabase/flexible";

export const runtime = "nodejs";
const EXPORT_PAGE_SIZE = 500;
// Buffered formats (xlsx/google-sheet) hold the full dataset in memory.
const MAX_EXPORT_ROWS = 10_000;
// CSV is also buffered so pagination and evidence failures happen before a
// successful download response. Keep a hard cap to bound function memory.
const MAX_CSV_EXPORT_ROWS = 50_000;
const EXPORT_ROW_SELECT =
  "registrant_name, registrant_email, registrant_phone, registration_code, registration_status, created_at, waitlisted_at, promoted_at, checked_in_at, cancelled_at, form_submissions(form_version_id)";
type EventTarget = { id: string; legacyContentPostId: null | string };
type ExportRegistrationRow = EventRegistrationExportRow & {
  form_submissions?: Array<{ form_version_id?: string }> | { form_version_id?: string } | null;
};

function getEventIdentifier(request: Request) {
  const segments = new URL(request.url).pathname.split("/");
  return segments[segments.indexOf("events") + 1] || "";
}
function applyEventScope<T extends { eq: (column: string, value: string) => T; or: (filter: string) => T }>(query: T, event: EventTarget) {
  return event.legacyContentPostId
    ? query.or(`event_id.eq.${event.id},event_post_id.eq.${event.legacyContentPostId}`)
    : query.eq("event_id", event.id);
}
function applyStatus<T extends { eq: (column: string, value: string) => T; is: (column: string, value: null) => T; not: (column: string, operator: string, value: null) => T }>(query: T, status: EventRegistrationStatus) {
  if (status === "confirmed") return query.eq("registration_status", "confirmed").is("cancelled_at", null);
  if (status === "waitlisted") return query.eq("registration_status", "waitlisted").is("cancelled_at", null);
  if (status === "checked-in") return query.not("checked_in_at", "is", null).is("cancelled_at", null);
  if (status === "cancelled") return query.not("cancelled_at", "is", null);
  return query;
}

type RegistrationFilters = ReturnType<typeof parseEventRegistrationFilters>;

function applyRegistrationFilters<
  T extends {
    eq: (column: string, value: string) => T;
    is: (column: string, value: null) => T;
    not: (column: string, operator: string, value: null) => T;
    or: (filter: string) => T;
  },
>(query: T, event: EventTarget, filters: RegistrationFilters): T {
  const scopedQuery = applyStatus(applyEventScope(query, event), filters.status);
  if (filters.query) {
    const pattern = buildEventRegistrationSearchPattern(filters.query);
    return scopedQuery.or(
      `registrant_name.ilike.${pattern},registrant_email.ilike.${pattern},registration_code.ilike.${pattern}`,
    );
  }
  return scopedQuery;
}

async function loadExportRows(
  admin: ReturnType<typeof asFlexibleClient>,
  event: EventTarget,
  filters: RegistrationFilters,
  totalRows: number,
) {
  const rows: ExportRegistrationRow[] = [];
  for (let from = 0; from < totalRows; from += EXPORT_PAGE_SIZE) {
    const to = Math.min(from + EXPORT_PAGE_SIZE - 1, totalRows - 1);
    const { data, error } = await applyRegistrationFilters(
      admin
        .from("event_registrations")
        .select(EXPORT_ROW_SELECT)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true }),
      event,
      filters,
    ).range(from, to);
    if (error) throw new Error("Event registrations could not be exported.");
    const page = (data || []) as unknown as ExportRegistrationRow[];
    rows.push(...page);
    if (page.length < to - from + 1) return rows;
  }
  return rows;
}

async function countExportRows(
  admin: ReturnType<typeof asFlexibleClient>,
  event: EventTarget,
  filters: RegistrationFilters
) {
  const { count, error } = await applyRegistrationFilters(
    admin.from("event_registrations").select("id", { count: "exact", head: true }),
    event,
    filters,
  );
  if (error) return null;
  return count ?? 0;
}

function formVersionIds(rows: ExportRegistrationRow[]) {
  return Array.from(new Set(rows.flatMap((row) => {
    const relation = row.form_submissions;
    const submissions = Array.isArray(relation) ? relation : relation ? [relation] : [];
    return submissions
      .map((item) => item.form_version_id)
      .filter((id): id is string => Boolean(id));
  }))).sort();
}

async function handleGet(request: NextRequest) {
  const permission = await requireAdminApiPermission("cms.events.manage", {
    forbiddenMessage: "Only event managers can export event registrations.",
    unauthenticatedMessage: "Sign in before exporting event registrations.",
  });
  if (permission.response) return permission.response;
  if (!(await hasPermission("admin.reports.read"))) {
    return NextResponse.json({ error: "You need reporting access to export attendee data." }, { status: 403 });
  }
  const event = await resolveEventForAdminMutation(getEventIdentifier(request));
  if (!event) return NextResponse.json({ error: "Event not found." }, { status: 404 });

  const url = new URL(request.url);
  const format = url.searchParams.get("format")?.toLowerCase();
  if (format !== "csv" && format !== "xlsx" && format !== "google-sheet") {
    return NextResponse.json({ error: "Choose CSV, XLSX, or Google Sheet export format." }, { status: 422 });
  }
  const filters = parseEventRegistrationFilters(url);

  try {
    const admin = asFlexibleClient(createAdminClient());
    const exportName = `event-${event.id}-registrations`;
    const totalRows = await countExportRows(admin, event, filters);
    if (totalRows === null) {
      return NextResponse.json({ error: "Event registrations could not be exported." }, { status: 500 });
    }
    const maxRows = format === "csv" ? MAX_CSV_EXPORT_ROWS : MAX_EXPORT_ROWS;
    if (totalRows > maxRows) {
      return NextResponse.json(
        { error: `This export exceeds the ${maxRows.toLocaleString("en-US")}-row safety limit.` },
        { status: 422 },
      );
    }

    const rows = await loadExportRows(admin, event, filters, totalRows);
    const versions = formVersionIds(rows);
    const table = eventRegistrationsToExportTable(rows);
    const csv = createCsv(table);
    const googleSheet = format === "google-sheet"
      ? await uploadGoogleSheetSnapshot({ csv, filename: `${exportName}-${new Date().toISOString().slice(0, 10)}` })
      : null;
    const body = format === "xlsx" ? createXlsxWorkbook(table, "Event registrations") : null;
    const checksum = sha256(body || csv);
    const exportedAt = new Date().toISOString();
    const evidence = {
      exported_at: exportedAt,
      form_version_ids: versions,
      query: filters.query || null,
      schema_version: 1,
      status: filters.status,
    };
    const job = await admin.from("event_export_jobs").insert({
      checksum_sha256: checksum,
      destination: googleSheet ? "google_drive" : "download",
      event_id: event.id,
      export_kind: "event_registrations",
      filter_metadata: evidence,
      format: format === "google-sheet" ? "google_sheet" : format,
      google_drive_file_id: googleSheet?.id || null,
      requested_by_user_id: permission.auth.user.id,
      row_count: rows.length,
      status: "completed",
    });
    if (job.error) return NextResponse.json({ error: "The export job record could not be saved." }, { status: 500 });
    const audit = await admin.from("audit_events").insert({
      action: "event.registrations_exported",
      actor_user_id: permission.auth.user.id,
      entity_id: event.id,
      entity_type: "event",
      metadata: { ...evidence, destination: googleSheet ? "google_sheet" : "download", format, google_drive_file_id: googleSheet?.id || null, row_count: rows.length, sha256: checksum },
    });
    if (audit.error) return NextResponse.json({ error: "The export audit record could not be saved." }, { status: 500 });
    if (googleSheet) return NextResponse.json({ id: googleSheet.id, success: true, webViewLink: googleSheet.webViewLink }, { headers: { "Cache-Control": "private, no-store" } });
    if (format === "csv") return new NextResponse(csv, { headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="${exportName}.csv"`,
      "Content-Type": "text/csv; charset=utf-8",
      "X-Export-Checksum": checksum,
      "X-Export-Row-Count": String(rows.length),
    }});
    const contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    return new NextResponse(body, { headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="${exportName}.xlsx"`,
      "Content-Type": contentType,
      "X-Export-Checksum": checksum,
      "X-Export-Row-Count": String(rows.length),
    }});
  } catch {
    return NextResponse.json({ error: "Event registrations could not be exported." }, { status: 500 });
  }
}

export const GET = withApiGuard(handleGet, { requireAuth: true });
