import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminApiPermission } from "@/lib/admin/api-auth";
import { logServerError } from "@/lib/errors/api-error";
import { parseFormApplicationBehavior } from "@/lib/forms/application-behavior";
import { parseFormDefinition } from "@/lib/forms/definition";
import {
  createFormDraftVersion,
  loadFormEditorContext,
  loadFormManagementContext,
  updateFormDraftVersion,
} from "@/lib/forms/management";
import { withApiGuard } from "@/lib/security/with-api-guard";

const formIdSchema = z.string().uuid();
const draftVersionRequestSchema = z
  .object({
    applicationBehavior: z.unknown().optional().default({}),
    definition: z.unknown(),
  })
  .strict();

const draftUpdateRequestSchema = z
  .object({
    applicationBehavior: z.unknown().optional().default({}),
    definition: z.unknown(),
    formVersionId: z.string().uuid(),
  })
  .strict();

function parseFormId(rawFormId: unknown) {
  return typeof rawFormId === "string" ? formIdSchema.safeParse(rawFormId) : null;
}

export const GET = withApiGuard(
  async (_request, context) => {
    const permission = await requireAdminApiPermission("cms.forms.manage");
    if (permission.response) {
      return permission.response;
    }

    const { formId: rawFormId } = await context.params;
    const formId = parseFormId(rawFormId);
    if (!formId?.success) {
      return NextResponse.json({ error: "Form not found." }, { status: 404 });
    }

    try {
      const form = await loadFormEditorContext(formId.data);
      if (!form) {
        return NextResponse.json({ error: "Form not found." }, { status: 404 });
      }

      return NextResponse.json(form);
    } catch (error) {
      logServerError("forms.admin.load_editor", error);
      return NextResponse.json({ error: "The form editor could not be loaded." }, { status: 500 });
    }
  },
  { requireAuth: true }
);

export const POST = withApiGuard(
  async (request, context) => {
    const permission = await requireAdminApiPermission("cms.forms.manage");
    if (permission.response) {
      return permission.response;
    }

    const { formId: rawFormId } = await context.params;
    const formId = parseFormId(rawFormId);
    if (!formId?.success) {
      return NextResponse.json({ error: "Form not found." }, { status: 404 });
    }

    const form = await loadFormManagementContext(formId.data);
    if (!form) {
      return NextResponse.json({ error: "Form not found." }, { status: 404 });
    }
    if (form.lifecycle === "archived") {
      return NextResponse.json({ error: "Archived forms cannot be edited." }, { status: 409 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid form request." }, { status: 400 });
    }

    const parsed = draftVersionRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Please check the form configuration." }, { status: 422 });
    }

    let definition;
    let applicationBehavior;
    try {
      definition = parseFormDefinition(parsed.data.definition);
      applicationBehavior = parseFormApplicationBehavior(
        form.kind,
        parsed.data.applicationBehavior,
        definition
      );
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error ? error.message : "Please check the form configuration.",
        },
        { status: 422 }
      );
    }

    try {
      const formVersionId = await createFormDraftVersion({
        actorUserId: permission.auth.user.id,
        applicationBehavior,
        definition,
        formDefinitionId: form.id,
      });

      return NextResponse.json({ formVersionId }, { status: 201 });
    } catch (error) {
      logServerError("forms.admin.create_draft_version", error);
      return NextResponse.json(
        { error: "The form draft version could not be created." },
        { status: 409 }
      );
    }
  },
  { requireAuth: true }
);
export const PATCH = withApiGuard(
  async (request, context) => {
    const permission = await requireAdminApiPermission("cms.forms.manage");
    if (permission.response) {
      return permission.response;
    }

    const { formId: rawFormId } = await context.params;
    const formId = parseFormId(rawFormId);
    if (!formId?.success) {
      return NextResponse.json({ error: "Form not found." }, { status: 404 });
    }

    const form = await loadFormManagementContext(formId.data);
    if (!form) {
      return NextResponse.json({ error: "Form not found." }, { status: 404 });
    }
    if (form.lifecycle === "archived") {
      return NextResponse.json({ error: "Archived forms cannot be edited." }, { status: 409 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid form request." }, { status: 400 });
    }

    const parsed = draftUpdateRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Please check the form configuration." }, { status: 422 });
    }

    let definition;
    let applicationBehavior;
    try {
      definition = parseFormDefinition(parsed.data.definition);
      applicationBehavior = parseFormApplicationBehavior(
        form.kind,
        parsed.data.applicationBehavior,
        definition
      );
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error ? error.message : "Please check the form configuration.",
        },
        { status: 422 }
      );
    }

    try {
      const formVersionId = await updateFormDraftVersion({
        actorUserId: permission.auth.user.id,
        applicationBehavior,
        definition,
        formDefinitionId: form.id,
        formVersionId: parsed.data.formVersionId,
      });

      return NextResponse.json({ formVersionId });
    } catch (error) {
      logServerError("forms.admin.update_draft_version", error);
      return NextResponse.json(
        { error: "The form draft could not be saved. Refresh and try again." },
        { status: 409 }
      );
    }
  },
  { requireAuth: true }
);