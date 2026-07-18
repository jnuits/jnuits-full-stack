import type { ExportTable } from "./tabular";

type FormSubmissionAssetExportRow = {
  cloudinary_asset_id: string;
  cloudinary_folder: string;
  cloudinary_public_id: string;
  cloudinary_version: string;
  field_id: string;
};

export type FormSubmissionExportRow = {
  answers: null | Record<string, unknown>;
  assets: FormSubmissionAssetExportRow[];
  confirmation_status: string;
  created_at: string;
  form_version_id: string;
  id: string;
  review_status: string;
  submitter_email: null | string;
};

function answerValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (Array.isArray(value)) {
    return value.map(answerValue).join("; ");
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
}

function assetValue(assets: FormSubmissionAssetExportRow[]) {
  return assets
    .map(
      (asset) =>
        `${asset.field_id}:${asset.cloudinary_asset_id}@${asset.cloudinary_version} (${asset.cloudinary_folder}/${asset.cloudinary_public_id})`
    )
    .join("; ");
}

export function formSubmissionsToExportTable(rows: readonly FormSubmissionExportRow[]): ExportTable {
  const answerKeys = Array.from(
    new Set(rows.flatMap((row) => Object.keys(row.answers || {})))
  ).sort((left, right) => left.localeCompare(right));

  return {
    columns: [
      { key: "submission_id", label: "Submission ID" },
      { key: "form_version_id", label: "Form version ID" },
      { key: "submitted_at", label: "Submitted at" },
      { key: "confirmation_status", label: "Confirmation status" },
      { key: "review_status", label: "Review status" },
      { key: "submitter_email", label: "Submitter email" },
      ...answerKeys.map((key) => ({ key: `answer_${key}`, label: `Answer: ${key}` })),
      { key: "cloudinary_assets", label: "Private Cloudinary asset references" },
    ],
    rows: rows.map((row) => ({
      ...Object.fromEntries(
        answerKeys.map((key) => [`answer_${key}`, answerValue(row.answers?.[key])])
      ),
      cloudinary_assets: assetValue(row.assets),
      confirmation_status: row.confirmation_status,
      form_version_id: row.form_version_id,
      review_status: row.review_status,
      submission_id: row.id,
      submitted_at: row.created_at,
      submitter_email: row.submitter_email || "",
    })),
  };
}
