import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminApiPermission } from "@/lib/admin/api-auth";
import {
  BULK_OPERATION_TYPES,
  createBulkOperationTemplate,
} from "@/lib/admin/bulk-operation-templates";

const querySchema = z.object({
  format: z.enum(["csv", "xlsx"]),
  kind: z.enum(["blank", "sample"]),
  operationType: z.enum(BULK_OPERATION_TYPES),
});

export async function GET(request: NextRequest) {
  const parsed = querySchema.safeParse({
    format: request.nextUrl.searchParams.get("format"),
    kind: request.nextUrl.searchParams.get("kind"),
    operationType: request.nextUrl.searchParams.get("operationType"),
  });

  if (!parsed.success) {
    return NextResponse.json(
      { message: "Choose a supported bulk operation and template format." },
      { status: 400 }
    );
  }

  const permission = await requireAdminApiPermission("admin.bulk.manage", {
    forbiddenMessage: "You do not have permission to download bulk-operation templates.",
    unauthenticatedMessage: "Sign in before downloading a bulk-operation template.",
  });
  if (permission.response) return permission.response;

  const template = createBulkOperationTemplate(parsed.data);
  const body =
    typeof template.body === "string" ? template.body : new Uint8Array(template.body);

  return new NextResponse(body, {
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "Content-Disposition": `attachment; filename="${template.filename}"`,
      "Content-Type": template.contentType,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
