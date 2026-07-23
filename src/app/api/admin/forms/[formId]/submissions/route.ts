import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminApiPermission } from "@/lib/admin/api-auth";
import { logServerError } from "@/lib/errors/api-error";
import {
  FORM_REVIEW_STATUSES,
  listFormSubmissionsForReview,
} from "@/lib/forms/review";
import { withApiGuard } from "@/lib/security/with-api-guard";

const formIdSchema = z.string().uuid();

function positiveInt(value: string | null, fallback: number, max: number) {
  const parsed = Number(value || fallback);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, max) : fallback;
}

export const GET = withApiGuard(
  async (request, context) => {
    const permission = await requireAdminApiPermission("admin.forms.review");
    if (permission.response) return permission.response;

    const { formId: rawFormId } = await context.params;
    const formId =
      typeof rawFormId === "string" ? formIdSchema.safeParse(rawFormId) : null;
    if (!formId?.success) {
      return NextResponse.json({ error: "Form not found." }, { status: 404 });
    }

    const url = new URL(request.url);
    const statusValue = url.searchParams.get("status");
    const status = statusValue
      ? z.enum(FORM_REVIEW_STATUSES).safeParse(statusValue)
      : null;
    if (statusValue && !status?.success) {
      return NextResponse.json({ error: "Invalid review status." }, { status: 422 });
    }

    const page = positiveInt(url.searchParams.get("page"), 1, 100_000);
    const pageSize = positiveInt(url.searchParams.get("pageSize"), 25, 100);
    const query = (url.searchParams.get("q") || "").trim().slice(0, 120);

    try {
      const result = await listFormSubmissionsForReview({
        formDefinitionId: formId.data,
        page,
        pageSize,
        query,
        status: status?.success ? status.data : undefined,
      });
      return NextResponse.json({ ...result, page, pageSize });
    } catch (error) {
      logServerError("forms.admin.review_list", error);
      return NextResponse.json(
        { error: "Form submissions could not be loaded." },
        { status: 500 }
      );
    }
  },
  { requireAuth: true }
);
