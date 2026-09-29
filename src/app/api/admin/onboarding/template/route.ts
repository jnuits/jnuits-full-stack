import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminApiPermission } from "@/lib/admin/api-auth";
import type { AdminPermission } from "@/lib/admin/access";
import { createOnboardingTemplate } from "@/lib/committee/onboarding/templates";
import { getActiveDepartmentCatalog } from "@/lib/membership/department-catalog";

const querySchema = z.object({
  format: z.enum(["csv", "xlsx"]),
  kind: z.enum(["blank", "sample", "department-codes"]).default("blank"),
  operationType: z.enum(["committee_roster_import", "member_profile_import"]),
});

const permissionByOperation = {
  committee_roster_import: "admin.committee.manage",
  member_profile_import: "admin.membership.manage",
} satisfies Record<z.infer<typeof querySchema>["operationType"], AdminPermission>;

export async function GET(request: NextRequest) {
  const parsed = querySchema.safeParse({
    format: request.nextUrl.searchParams.get("format"),
    kind: request.nextUrl.searchParams.get("kind") ?? undefined,
    operationType: request.nextUrl.searchParams.get("operationType"),
  });

  if (!parsed.success) {
    return NextResponse.json(
      { message: "Choose a supported onboarding operation and template format." },
      { status: 400 }
    );
  }

  const permission = await requireAdminApiPermission(
    permissionByOperation[parsed.data.operationType],
    {
      forbiddenMessage: "You do not have permission to download this onboarding template.",
      unauthenticatedMessage: "Sign in before downloading an onboarding template.",
    }
  );

  if (permission.response) return permission.response;

  const departments =
    parsed.data.kind === "blank" ? [] : await getActiveDepartmentCatalog();
  const template = createOnboardingTemplate({
    departments,
    format: parsed.data.format,
    kind: parsed.data.kind,
    operationType: parsed.data.operationType,
  });
  const body =
    typeof template.body === "string"
      ? template.body
      : new Uint8Array(template.body);

  return new NextResponse(body, {
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "Content-Disposition": `attachment; filename="${template.filename}"`,
      "Content-Type": template.contentType,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
