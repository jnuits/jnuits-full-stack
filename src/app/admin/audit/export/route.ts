import { NextResponse, type NextRequest } from "next/server";
import {
  auditEventsToCsv,
  loadAuditExplorerData,
  parseAuditFilters,
} from "@/lib/admin/audit-explorer";
import { requireAdminPermission } from "@/lib/auth/session";
import { apiError } from "@/lib/errors/api-error";
import { loadAdminActivity, activityItemsToCsv } from "@/lib/admin/activity/query";

// Auth gate runs outside the catch-all so unauthenticated visitors receive
// the normal admin redirect (not a JSON 500 from a swallowed NEXT_REDIRECT).
export async function GET(request: NextRequest) {
  await requireAdminPermission("admin.audit.read", {
    fallbackPath: "/admin/audit",
  });

  try {
    if (request.nextUrl.searchParams.get("view") === "activity") {
      const read=(key:string)=>request.nextUrl.searchParams.get(key)||"";
      const {items}=await loadAdminActivity({page:Number(read("page"))||1,pageSize:Number(read("pageSize"))||25,actor:read("actor"),action:read("action"),outcome:read("outcome"),from:read("from"),to:read("to")});
      return new NextResponse(activityItemsToCsv(items),{headers:{"Cache-Control":"private, no-store","Content-Type":"text/csv; charset=utf-8","Content-Disposition":"attachment; filename=\"jnuits-admin-activity.csv\""}});
    }

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
