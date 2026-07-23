import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminApiPermission } from "@/lib/admin/api-auth";
import { logServerError } from "@/lib/errors/api-error";
import { canAccessFormStudioKind } from "@/lib/forms/form-studio-access";
import {
  getFormPublicationError,
  loadFormManagementContext,
  publishFormVersion,
} from "@/lib/forms/management";
import { withApiGuard } from "@/lib/security/with-api-guard";

const formIdSchema = z.string().uuid();
const publishRequestSchema = z.object({ formVersionId: z.string().uuid() }).strict();

export const POST = withApiGuard(
  async (request, context) => {
    const permission = await requireAdminApiPermission("cms.forms.publish");
    if (permission.response) return permission.response;

    const { formId: rawFormId } = await context.params;
    const formId = typeof rawFormId === "string" ? formIdSchema.safeParse(rawFormId) : null;
    if (!formId?.success) return NextResponse.json({ error: "Form not found." }, { status: 404 });

    const body = await request.json().catch(() => null);
    const parsed = publishRequestSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Choose a valid draft version." }, { status: 422 });

    try {
      const form = await loadFormManagementContext(formId.data);
      if (!form) return NextResponse.json({ error: "Form not found." }, { status: 404 });
      if (!canAccessFormStudioKind(permission.auth.roles, form.kind)) {
        return NextResponse.json(
          { error: "You do not have permission to publish this form type." },
          { status: 403 }
        );
      }

      const compatibilityError = await getFormPublicationError(formId.data);
      if (compatibilityError) return NextResponse.json({ error: compatibilityError }, { status: 409 });

      const result = await publishFormVersion({
        actorUserId: permission.auth.user.id,
        formDefinitionId: formId.data,
        formVersionId: parsed.data.formVersionId,
      });
      return NextResponse.json({ ...result, success: true });
    } catch (error) {
      logServerError("forms.admin.publish", error);
      return NextResponse.json({ error: "The selected draft could not be published." }, { status: 409 });
    }
  },
  { requireAuth: true }
);
