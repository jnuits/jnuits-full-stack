import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminApiPermission } from "@/lib/admin/api-auth";
import { logServerError } from "@/lib/errors/api-error";
import {
  FORM_LIFECYCLE_TARGETS,
  transitionFormLifecycle,
} from "@/lib/forms/lifecycle";
import { withApiGuard } from "@/lib/security/with-api-guard";

const formIdSchema = z.string().uuid();
const lifecycleRequestSchema = z
  .object({ target: z.enum(FORM_LIFECYCLE_TARGETS) })
  .strict();

export const POST = withApiGuard(
  async (request, context) => {
    const permission = await requireAdminApiPermission("cms.forms.publish");
    if (permission.response) return permission.response;

    const { formId: rawFormId } = await context.params;
    const formId =
      typeof rawFormId === "string" ? formIdSchema.safeParse(rawFormId) : null;
    if (!formId?.success) {
      return NextResponse.json({ error: "Form not found." }, { status: 404 });
    }

    const body = await request.json().catch(() => null);
    const parsed = lifecycleRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Choose a valid form lifecycle action." },
        { status: 422 }
      );
    }

    try {
      const result = await transitionFormLifecycle({
        actorUserId: permission.auth.user.id,
        formDefinitionId: formId.data,
        target: parsed.data.target,
      });

      return NextResponse.json({ ...result, success: true });
    } catch (error) {
      logServerError("forms.admin.lifecycle", error);
      return NextResponse.json(
        { error: "The form lifecycle could not be updated." },
        { status: 409 }
      );
    }
  },
  { requireAuth: true }
);
