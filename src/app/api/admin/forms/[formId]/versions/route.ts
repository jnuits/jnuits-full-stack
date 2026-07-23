import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminApiPermission } from "@/lib/admin/api-auth";
import { logServerError } from "@/lib/errors/api-error";
import { parseFormApplicationBehavior } from "@/lib/forms/application-behavior";
import { parseFormDefinition } from "@/lib/forms/definition";
import { canAccessFormStudioKind } from "@/lib/forms/form-studio-access";
import {
  createFormDraftVersion,
  loadFormEditorContext,
  loadFormManagementContext,
  updateFormDraftVersion,
} from "@/lib/forms/management";
import { withApiGuard } from "@/lib/security/with-api-guard";

const formIdSchema = z.string().uuid();
const draftVersionRequestSchema = z.object({
  applicationBehavior: z.unknown().optional().default({}),
  definition: z.unknown(),
}).strict();
const draftUpdateRequestSchema = z.object({
  applicationBehavior: z.unknown().optional().default({}),
  definition: z.unknown(),
  formVersionId: z.string().uuid(),
}).strict();

function parseFormId(rawFormId: unknown) {
  return typeof rawFormId === "string" ? formIdSchema.safeParse(rawFormId) : null;
}

function forbiddenKindResponse() {
  return NextResponse.json(
    { error: "You do not have permission to manage this form type." },
    { status: 403 }
  );
}

export const GET = withApiGuard(
  async (_request, context) => {
    const permission = await requireAdminApiPermission("cms.forms.manage");
    if (permission.response) return permission.response;

    const { formId: rawFormId } = await context.params;
    const formId = parseFormId(rawFormId);
    if (!formId?.success) return NextResponse.json({ error: "Form not found." }, { status: 404 });

    try {
      const form = await loadFormEditorContext(formId.data);
      if (!form) return NextResponse.json({ error: "Form not found." }, { status: 404 });
      if (!canAccessFormStudioKind(permission.auth.roles, form.kind)) {
        return forbiddenKindResponse();
      }
      return NextResponse.json(form);
    } catch (error) {
      logServerError("forms.admin.load_editor", error);
      return NextResponse.json({ error: "The form editor could not be loaded." }, { status: 500 });
    }
  },
  { requireAuth: true }
);

async function loadEditableForm(formId: string, roles: readonly string[]) {
  const form = await loadFormManagementContext(formId);
  if (!form) return { response: NextResponse.json({ error: "Form not found." }, { status: 404 }) };
  if (!canAccessFormStudioKind(roles, form.kind)) return { response: forbiddenKindResponse() };
  if (form.lifecycle === "archived") {
    return { response: NextResponse.json({ error: "Archived forms cannot be edited." }, { status: 409 }) };
  }
  return { form };
}

export const POST = withApiGuard(
  async (request, context) => {
    const permission = await requireAdminApiPermission("cms.forms.manage");
    if (permission.response) return permission.response;
    const { formId: rawFormId } = await context.params;
    const formId = parseFormId(rawFormId);
    if (!formId?.success) return NextResponse.json({ error: "Form not found." }, { status: 404 });

    const access = await loadEditableForm(formId.data, permission.auth.roles);
    if (access.response) return access.response;
    const form = access.form;

    const body = await request.json().catch(() => null);
    const parsed = draftVersionRequestSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Please check the form configuration." }, { status: 422 });

    let definition;
    let applicationBehavior;
    try {
      definition = parseFormDefinition(parsed.data.definition);
      applicationBehavior = parseFormApplicationBehavior(form.kind, parsed.data.applicationBehavior, definition);
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Please check the form configuration." },
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
      return NextResponse.json({ error: "The form draft version could not be created." }, { status: 409 });
    }
  },
  { requireAuth: true }
);

export const PATCH = withApiGuard(
  async (request, context) => {
    const permission = await requireAdminApiPermission("cms.forms.manage");
    if (permission.response) return permission.response;
    const { formId: rawFormId } = await context.params;
    const formId = parseFormId(rawFormId);
    if (!formId?.success) return NextResponse.json({ error: "Form not found." }, { status: 404 });

    const access = await loadEditableForm(formId.data, permission.auth.roles);
    if (access.response) return access.response;
    const form = access.form;

    const body = await request.json().catch(() => null);
    const parsed = draftUpdateRequestSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Please check the form configuration." }, { status: 422 });

    let definition;
    let applicationBehavior;
    try {
      definition = parseFormDefinition(parsed.data.definition);
      applicationBehavior = parseFormApplicationBehavior(form.kind, parsed.data.applicationBehavior, definition);
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Please check the form configuration." },
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
      return NextResponse.json({ error: "The form draft could not be saved. Refresh and try again." }, { status: 409 });
    }
  },
  { requireAuth: true }
);
