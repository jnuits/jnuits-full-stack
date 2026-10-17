import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

const signer = source("src/lib/forms/upload-signing.ts");
const proof = source("src/lib/forms/upload-proof.ts");
const provider = source("src/lib/forms/cloudinary-assets.ts");
const publicSignerRoute = source("src/app/api/forms/[slug]/uploads/sign/route.ts");
const adminSignerRoute = source("src/app/api/admin/cloudinary/sign/route.ts");
const downloadRoute = source(
  "src/app/api/admin/forms/[formId]/submissions/[submissionId]/assets/[assetId]/download/route.ts"
);

const submitRoutes = [
  source("src/app/api/forms/[slug]/submit/route.ts"),
  source("src/app/api/events/[eventId]/register/route.ts"),
];

describe("private form upload workflow contract", () => {
  it("keeps the public form signer isolated from the admin media signer", () => {
    expect(publicSignerRoute).toContain("buildFormUploadInstructions");
    expect(publicSignerRoute).toContain("createFormUploadSession");
    expect(publicSignerRoute).not.toContain("admin/cloudinary");
    expect(adminSignerRoute).not.toContain("buildFormUploadInstructions");
  });

  it("limits uploads to private image/PDF assets of at most 10 MB", () => {
    expect(signer).toContain("FORM_UPLOAD_MAX_BYTES = 10 * 1024 * 1024");
    expect(signer).toContain('"application/pdf"');
    expect(signer).toContain('"image/jpeg"');
    expect(signer).toContain('"image/png"');
    expect(signer).toContain('"image/webp"');
    expect(signer).toContain('${resourceType}/upload');
    expect(signer).toContain('type: "authenticated"');
    expect(source("src/components/forms/public-form-screen.tsx")).toContain('body.set("type", "authenticated")');
    expect(signer).toContain("randomUUID");
    expect(signer).toContain("private/forms/${options.formDefinitionId}/${sessionId}");
    expect(signer).toContain("FORM_UPLOAD_PROOF_TTL_MS = 10 * 60 * 1000");
  });

  it("binds every proof to exact form, version, field, manifest, checksum, and upload ownership", () => {
    for (const token of [
      "formDefinitionId",
      "formVersionId",
      "fieldId",
      "manifestSha256",
      "sha256",
      "sessionId",
      "uploadId",
    ]) {
      expect(`${signer}\n${proof}`).toContain(token);
    }
    expect(proof).toContain("timingSafeEqual");
    expect(proof).toContain("payload.expiresAt <= now");
    expect(proof).toContain("A signed upload was submitted more than once");
    expect(proof).toContain("Submitted upload metadata does not match its signed upload");
  });

  it("verifies provider metadata and consumes authorization before persistence", () => {
    for (const token of [
      "asset_id",
      "public_id",
      "version",
      "asset_folder",
      "resource_type",
      'details.type !== "authenticated"',
      "details.bytes",
      "normalizedFormat",
      "context.form_definition_id",
      "context.form_version_id",
      "context.field_id",
      "context.upload_id",
      "context.sha256",
    ]) {
      expect(provider).toContain(token);
    }
    for (const route of submitRoutes) {
      const verify = route.indexOf("verifyCloudinaryFormAssets");
      const consume = route.indexOf("consumeFormUploadSession");
      expect(verify).toBeGreaterThan(0);
      expect(consume).toBeGreaterThan(verify);
    }
  });

  it("delivers only through the authorized audited non-cacheable staff proxy", () => {
    expect(downloadRoute).toContain('requireAdminApiPermission("admin.forms.review"');
    expect(downloadRoute).toContain('eq("form_definition_id", formId.data)');
    expect(downloadRoute).toContain("loadVerifiedCloudinaryFormAsset");
    expect(downloadRoute).toContain("buildSignedCloudinaryFormAssetUrl");
    expect(downloadRoute).toContain('action: "form.upload_downloaded"');
    expect(downloadRoute).toContain('"Cache-Control": "private, no-store, max-age=0"');
    expect(downloadRoute).toContain('"Content-Disposition": `attachment;');
    expect(downloadRoute).not.toContain("cloudinaryPublicUrl");
  });

  it("does not store or return signed delivery URLs as canonical submission data", () => {
    expect(proof).not.toContain("secureUrl");
    expect(provider).not.toContain("console.");
    for (const route of submitRoutes) {
      expect(route).not.toContain("signedUrl:");
      expect(route).not.toContain("secure_url");
    }
  });
});
