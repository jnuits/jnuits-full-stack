import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminApiPermission } from "@/lib/admin/api-auth";
import { logServerError } from "@/lib/errors/api-error";
import { publishFormVersion } from "@/lib/forms/management";
import { withApiGuard } from "@/lib/security/with-api-guard";

const formIdSchema = z.string().uuid();
const publishRequestSchema = z.object({ formVersionId: z.string().uuid() }).strict();

export const POST = withApiGuard(
  async (request, context) => {
    const permission = await requireAdminApiPermission("cms.forms.publish");
    if (permission.response) {
      return permission.response;
    }

    const { formId: rawFormId } = await context.params;
    const formId = typeof rawFormId === "string" ? formIdSchema.safeParse(rawFormId) : null;
    if (!formId?.success) {
      return NextResponse.json({ error: "Form not found." }, { status: 404 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid publish request." }, { status: 400 });
    }

    const parsed = publishRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Choose a valid draft version." }, { status: 422 });
    }

    try {
      const result = await publishFormVersion({
        actorUserId: permission.auth.user.id,
        formDefinitionId: formId.data,
        formVersionId: parsed.data.formVersionId,
      });

      return NextResponse.json({ ...result, success: true });
    } catch (error) {
      logServerError("forms.admin.publish", error);
      return NextResponse.json(
        { error: "The selected draft could not be published." },
        { status: 409 }
      );
    }
  },
  { requireAuth: true }
);
