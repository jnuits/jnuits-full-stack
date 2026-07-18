import { describe, expect, it } from "vitest";

import { formSubmissionsToExportTable } from "./form-submissions";

describe("form submission exports", () => {
  it("keeps canonical metadata, versioned answers, and Cloudinary references in a tabular export", () => {
    const table = formSubmissionsToExportTable([
      {
        answers: { department: "CSE", full_name: "=formula", interests: ["coding", "design"] },
        assets: [
          {
            cloudinary_asset_id: "asset-1",
            cloudinary_folder: "private/forms/example",
            cloudinary_public_id: "file-1.pdf",
            cloudinary_version: "123",
            field_id: "identity_document",
          },
        ],
        confirmation_status: "confirmed",
        created_at: "2026-07-18T06:00:00.000Z",
        form_version_id: "version-1",
        id: "submission-1",
        review_status: "approved",
        submitter_email: "person@example.test",
      },
    ]);

    expect(table.columns.map((column) => column.key)).toEqual([
      "submission_id",
      "form_version_id",
      "submitted_at",
      "confirmation_status",
      "review_status",
      "submitter_email",
      "answer_department",
      "answer_full_name",
      "answer_interests",
      "cloudinary_assets",
    ]);
    expect(table.rows).toEqual([
      expect.objectContaining({
        answer_department: "CSE",
        answer_full_name: "=formula",
        answer_interests: "coding; design",
        cloudinary_assets:
          "identity_document:asset-1@123 (private/forms/example/file-1.pdf)",
      }),
    ]);
  });
});
