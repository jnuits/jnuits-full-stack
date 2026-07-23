import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { asFlexibleClient } from "@/lib/supabase/flexible";

export const FORM_REVIEW_STATUSES = [
  "unreviewed",
  "in_review",
  "approved",
  "rejected",
  "withdrawn",
] as const;

export type FormReviewStatus = (typeof FORM_REVIEW_STATUSES)[number];

export type FormSubmissionReviewItem = {
  confirmationStatus: string;
  createdAt: string;
  id: string;
  reviewStatus: FormReviewStatus;
  submitterEmail: string | null;
  versionNumber: number | null;
};

function escapeIlike(value: string) {
  return value.replace(/[\\%_,().]/g, (character) => `\\${character}`);
}

export async function listFormSubmissionsForReview(options: {
  formDefinitionId: string;
  page: number;
  pageSize: number;
  query?: string;
  status?: FormReviewStatus;
}) {
  const admin = asFlexibleClient(createAdminClient());
  const from = (options.page - 1) * options.pageSize;
  const to = from + options.pageSize - 1;
  let request = admin
    .from("form_submissions")
    .select(
      "id, submitter_email, confirmation_status, review_status, created_at, form_versions(version_number)",
      { count: "exact" }
    )
    .eq("form_definition_id", options.formDefinitionId)
    .order("created_at", { ascending: false });

  if (options.status) request = request.eq("review_status", options.status);
  if (options.query) {
    request = request.ilike("submitter_email", `%${escapeIlike(options.query)}%`);
  }

  const { count, data, error } = await request.range(from, to);
  if (error) throw error;

  const items = (data || []).map((row: Record<string, unknown>) => {
    const relation = Array.isArray(row.form_versions)
      ? row.form_versions[0]
      : row.form_versions;
    const version = relation && typeof relation === "object"
      ? Number((relation as Record<string, unknown>).version_number)
      : null;

    return {
      confirmationStatus: String(row.confirmation_status || "unknown"),
      createdAt: String(row.created_at || ""),
      id: String(row.id || ""),
      reviewStatus: row.review_status as FormReviewStatus,
      submitterEmail:
        typeof row.submitter_email === "string" ? row.submitter_email : null,
      versionNumber: Number.isFinite(version) ? version : null,
    } satisfies FormSubmissionReviewItem;
  });

  return { items, totalItems: count || 0 };
}
