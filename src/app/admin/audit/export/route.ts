import { NextResponse, type NextRequest } from "next/server";
import {
  auditEventsToCsv,
  loadAuditExplorerData,
  parseAuditFilters,
} from "@/lib/admin/audit-explorer";
import { requireAdminPermission } from "@/lib/auth/session";
import { apiError } from "@/lib/errors/api-error";

export async function GET(request: NextRequest) {
  try {
    await requireAdminPermission("admin.audit.read", {
      fallbackPath: "/admin/audit",
    });

    const filters = parseAuditFilters(
      Object.fromEntries(request.nextUrl.searchParams.entries())
    );
    const { events } = await loadAuditExplorerData(
      { ...filters, page: 1, pageSize: 1000 },
      { exportMode: true }
    );
    const csv = auditEventsToCsv(events);
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

    return new NextResponse(csv, {
      headers: {
        "Content-Disposition": `attachment; filename="jnuits-audit-events-${timestamp}.csv"`,
        "Content-Type": "text/csv; charset=utf-8",
      },
    });
  } catch (error) {
    return apiError(error, {
      context: "admin.audit.export",
      fallback: "Audit export could not be generated.",
      status: 500,
    });
  }
}