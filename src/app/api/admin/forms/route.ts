import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminApiPermission } from "@/lib/admin/api-auth";
import { logServerError } from "@/lib/errors/api-error";
import { parseFormApplicationBehavior } from "@/lib/forms/application-behavior";
import { FormKindSchema, parseFormDefinition } from "@/lib/forms/definition";
import {
  canAccessFormStudioKind,
  formStudioKindFilter,
} from "@/lib/forms/form-studio-access";
import { createFormDraft, listForms } from "@/lib/forms/management";
import { withApiGuard } from "@/lib/security/with-api-guard";

const createFormRequestSchema = z
  .object({
    applicationBehavior: z.unknown().optional().default({}),
    definition: z.unknown(),
    description: z.string().trim().max(2_000).optional().default(""),
    kind: FormKindSchema,
    linkedEventId: z.string().uuid().nullable().optional().default(null),
    slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(120),
    title: z.string().trim().min(1).max(160),
  })
  .strict();

function forbiddenKindResponse() {
  return NextResponse.json(
    { error: "You do not have permission to manage this form type." },
    { status: 403 }
  );
}

export const POST = withApiGuard(
  async (request) => {
    const permission = await requireAdminApiPermission("cms.forms.manage");
    if (permission.response) return permission.response;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid form request." }, { status: 400 });
    }

    const parsed = createFormRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Please check the form configuration." }, { status: 422 });
    }
    if (!canAccessFormStudioKind(permission.auth.roles, parsed.data.kind)) {
      return forbiddenKindResponse();
    }

    let definition;
    let applicationBehavior;
    try {
      definition = parseFormDefinition(parsed.data.definition);
      if (parsed.data.kind === "event_registration") {
        if (!parsed.data.linkedEventId) {
          throw new Error("Event registration forms must link to an event.");
        }
      } else if (parsed.data.linkedEventId) {
        throw new Error("Only event registration forms can link to an event.");
      }
      applicationBehavior = parseFormApplicationBehavior(
        parsed.data.kind,
        parsed.data.applicationBehavior,
        definition
      );
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Please check the form configuration." },
        { status: 422 }
      );
    }

    try {
      const draft = await createFormDraft({
        actorUserId: permission.auth.user.id,
        applicationBehavior,
        definition,
        description: parsed.data.description,
        kind: parsed.data.kind,
        linkedEventId: parsed.data.linkedEventId,
        slug: parsed.data.slug,
        title: parsed.data.title,
      });
      return NextResponse.json(draft, { status: 201 });
    } catch (error) {
      logServerError("forms.admin.create_draft", error);
      return NextResponse.json(
        { error: "The form draft could not be created. Check the slug and try again." },
        { status: 409 }
      );
    }
  },
  { requireAuth: true }
);

function parsePositiveInt(value: string | null, fallback: number, max: number) {
  const parsed = Number(value || fallback);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, max) : fallback;
}

export const GET = withApiGuard(
  async (request) => {
    const permission = await requireAdminApiPermission("cms.forms.manage");
    if (permission.response) return permission.response;

    const url = new URL(request.url);
    const kindValue = url.searchParams.get("kind");
    const kind = kindValue ? FormKindSchema.safeParse(kindValue) : null;
    if (kindValue && !kind?.success) {
      return NextResponse.json({ error: "Invalid form kind." }, { status: 422 });
    }
    if (kind?.success && !canAccessFormStudioKind(permission.auth.roles, kind.data)) {
      return forbiddenKindResponse();
    }

    const page = parsePositiveInt(url.searchParams.get("page"), 1, 100_000);
    const pageSize = parsePositiveInt(url.searchParams.get("pageSize"), 25, 100);
    const query = (url.searchParams.get("q") || "").trim().slice(0, 100);
    const scopedKind = formStudioKindFilter(permission.auth.roles);

    try {
      const result = await listForms({
        kind: scopedKind || (kind?.success ? kind.data : undefined),
        page,
        pageSize,
        query,
      });
      return NextResponse.json({ ...result, page, pageSize });
    } catch (error) {
      logServerError("forms.admin.list", error);
      return NextResponse.json({ error: "Forms could not be loaded." }, { status: 500 });
    }
  },
  { requireAuth: true }
);
