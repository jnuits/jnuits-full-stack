import { describe, expect, it } from "vitest";

import type { FormDefinition } from "./definition";
import { buildFormUploadInstructions } from "./upload-signing";

const formDefinitionId = "11111111-1111-4111-8111-111111111111";
const formVersionId = "33333333-3333-4333-8333-333333333333";
const now = new Date("2026-07-18T06:00:00.000Z");

const definition: FormDefinition = {
  fields: [
    { id: "full_name", label: "Full name", maxLength: 160, required: true, type: "text" },
    { id: "identity_document", label: "Identity document", maxFiles: 1, required: true, type: "pdf" },
    { id: "portrait", label: "Portrait", maxFiles: 2, required: false, type: "image" },
  ],
  payment: { enabled: false },
};

const config = {
  apiKey: "public-api-key",
  apiSecret: "server-only-secret",
  cloudName: "jnuits-test",
};

describe("form upload signing", () => {
  it("creates private, version-bound instructions without exposing the secret", () => {
    const result = buildFormUploadInstructions({
      config,
      definition,
      formDefinitionId,
      formVersionId,
      now,
      randomId: () => "22222222-2222-4222-8222-222222222222",
      uploads: [
        {
          fieldId: "identity_document",
          mimeType: "application/pdf",
          sha256: "a".repeat(64),
          size: 1024,
        },
      ],
    });

    expect(result.expiresAt).toBe("2026-07-18T06:10:00.000Z");
    expect(result.formVersionId).toBe(formVersionId);
    expect(result.manifestSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(result.proof).not.toContain(config.apiSecret);
    expect(result.uploads).toEqual([
      expect.objectContaining({
        allowedFormats: "pdf",
        apiKey: config.apiKey,
        assetFolder:
          "jnuits/jnuits-full-stack/private/forms/11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222",
        context:
          "form_definition_id=11111111-1111-4111-8111-111111111111|form_version_id=33333333-3333-4333-8333-333333333333|field_id=identity_document|upload_id=22222222-2222-4222-8222-222222222222|sha256=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        publicId: "22222222-2222-4222-8222-222222222222.pdf",
        resourceType: "raw",
        timestamp: 1784354400,
        uploadUrl: "https://api.cloudinary.com/v1_1/jnuits-test/raw/authenticated/upload",
      }),
    ]);
  });

  it("rejects MIME, size, and field mismatches before issuing a signature", () => {
    expect(() =>
      buildFormUploadInstructions({
        config,
        definition,
        formDefinitionId,
        formVersionId,
        now,
        uploads: [
          {
            fieldId: "identity_document",
            mimeType: "image/png",
            sha256: "a".repeat(64),
            size: 1024,
          },
        ],
      })
    ).toThrow("does not accept that file type");

    expect(() =>
      buildFormUploadInstructions({
        config,
        definition,
        formDefinitionId,
        formVersionId,
        now,
        uploads: [
          {
            fieldId: "portrait",
            mimeType: "image/png",
            sha256: "a".repeat(64),
            size: 10 * 1024 * 1024 + 1,
          },
        ],
      })
    ).toThrow("10 MB");
  });
});
