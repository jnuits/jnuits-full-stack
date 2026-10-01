import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminApiPermission } from "@/lib/admin/api-auth";
import { createCertificateImportTemplate } from "@/lib/certificates/admin-import";

const querySchema = z.object({
  format: z.enum(["csv", "xlsx"]),
  kind: z.enum(["blank", "sample"]),
});

export async function GET(request: NextRequest) {
  const parsed = querySchema.safeParse({
    format: request.nextUrl.searchParams.get("format"),
    kind: request.nextUrl.searchParams.get("kind"),
  });

  if (!parsed.success) {
    return NextResponse.json(
      { message: "Choose a supported certificate template format." },
      { status: 400 }
    );
  }

  const permission = await requireAdminApiPermission("admin.certificates.manage", {
    forbiddenMessage: "You do not have permission to download certificate templates.",
    unauthenticatedMessage: "Sign in before downloading a certificate template.",
  });
  if (permission.response) return permission.response;

  const template = createCertificateImportTemplate(parsed.data);
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
