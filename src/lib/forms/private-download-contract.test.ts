import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const route = readFileSync(resolve(process.cwd(), "src/app/api/admin/forms/[formId]/submissions/[submissionId]/assets/[assetId]/download/route.ts"), "utf8");

describe("private form upload downloads", () => {
  it("requires review permission and verifies ownership at every hierarchy level", () => {
    expect(route).toContain('requireAdminApiPermission("admin.forms.review"');
    expect(route).toContain('.eq("form_definition_id", formId.data)');
    expect(route).toContain('.eq("form_submission_id", submissionId.data)');
    expect(route).toContain("loadVerifiedCloudinaryFormAsset(asset)");
  });

  it("proxies authenticated delivery with non-cacheable safe headers", () => {
    expect(route).toContain("buildSignedCloudinaryFormAssetUrl(asset)");
    expect(route).toContain('"Cache-Control": "private, no-store, max-age=0"');
    expect(route).toContain('"X-Content-Type-Options": "nosniff"');
    expect(route).toContain('filename="form-upload-${row.id}.${extension}"');
  });

  it("audits downloads without PII", () => {
    expect(route).toContain('action: "form.upload_downloaded"');
    expect(route).not.toContain("submitter_email");
    expect(route).not.toContain("cloudinaryPublicId };");
  });
});
