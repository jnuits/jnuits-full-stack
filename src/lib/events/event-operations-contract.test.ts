import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const listRoute = fs.readFileSync(path.join(root, "src/app/api/admin/events/[eventId]/registrations/route.ts"), "utf8");
const exportRoute = fs.readFileSync(path.join(root, "src/app/api/admin/events/[eventId]/registrations/export/route.ts"), "utf8");
const checkinRoute = fs.readFileSync(path.join(root, "src/app/api/admin/events/[eventId]/checkin/route.ts"), "utf8");
const promoteRoute = fs.readFileSync(path.join(root, "src/app/api/admin/events/[eventId]/registrations/[registrationId]/promote/route.ts"), "utf8");
const resendRoute = fs.readFileSync(path.join(root, "src/app/api/admin/events/[eventId]/registrations/[registrationId]/resend/route.ts"), "utf8");

describe("event operations workspace contract", () => {
  it("keeps attendee reads bounded and server-filtered", () => {
    expect(listRoute).toContain("MAX_PAGE_SIZE = 100");
    expect(listRoute).toContain("query.range(from, to)");
    expect(listRoute).toContain("registrant_name.ilike");
    expect(listRoute).toContain("countRows(admin, event");
  });

  it("server-authorizes every sensitive operation", () => {
    for (const route of [listRoute, exportRoute, checkinRoute, promoteRoute, resendRoute]) {
      expect(route).toContain('requireAdminApiPermission("cms.events.manage"');
      expect(route).toContain("requireAuth: true");
    }
    expect(exportRoute).toContain('hasPermission("admin.reports.read")');
  });

  it("records complete bounded export evidence", () => {
    expect(exportRoute).toContain("MAX_EXPORT_ROWS = 10_000");
    expect(exportRoute).toContain("MAX_CSV_EXPORT_ROWS = 50_000");
    expect(exportRoute).toContain("form_version_ids");
    expect(exportRoute).toContain("filter_metadata: evidence");
    expect(exportRoute).toContain("requested_by_user_id");
    expect(exportRoute).toContain("row_count");
    expect(exportRoute).toContain("checksum_sha256");
    expect(exportRoute).toContain("exported_at");
  });

  it("hashes the actual artifact delivered for each buffered export format", () => {
    expect(exportRoute).toContain(
      'const body = format === "xlsx" ? createXlsxWorkbook(table, "Event registrations") : null',
    );
    expect(exportRoute).toContain("const checksum = sha256(body || csv)");
  });

  it("combines export scope, status, and search filters", () => {
    expect(exportRoute).toContain("applyStatus(applyEventScope(query, event), filters.status)");
    expect(exportRoute).not.toContain("and(${eventFilter(event)},${searchFilter})");
  });

  it("paginates exports deterministically without rejecting an exact-cap result", () => {
    expect(exportRoute).toContain('.order("id", { ascending: true })');
    expect(exportRoute).toContain("from < totalRows");
    expect(exportRoute).toContain(
      "const rows = await loadExportRows(admin, event, filters, totalRows)",
    );
    expect(exportRoute).not.toContain("new ReadableStream");
    expect(exportRoute).not.toContain("from < MAX_EXPORT_ROWS");
    expect(exportRoute).not.toContain("from < maxRows");
  });
});
