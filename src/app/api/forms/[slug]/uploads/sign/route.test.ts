import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  buildFormUploadInstructions: vi.fn(),
  enforceAuthActionProtection: vi.fn(),
  loadPublishedForm: vi.fn(),
}));

vi.mock("@/lib/auth/action-protection", () => ({
  enforceAuthActionProtection: mocks.enforceAuthActionProtection,
}));

vi.mock("@/lib/cloudinary/config", () => ({
  getCloudinaryConfig: () => ({
    apiKey: "public-key",
    apiSecret: "server-only-secret",
    cloudName: "jnuits-test",
  }),
}));

vi.mock("@/lib/forms/repository", () => ({
  loadPublishedForm: mocks.loadPublishedForm,
}));

vi.mock("@/lib/forms/upload-signing", () => ({
  buildFormUploadInstructions: mocks.buildFormUploadInstructions,
  FORM_UPLOAD_MAX_BYTES: 10 * 1024 * 1024,
}));

vi.mock("@/lib/security/with-api-guard", () => ({
  withApiGuard: <T>(handler: T) => handler,
}));

import { POST } from "./route";

const form = {
  definition: {
    fields: [
      { id: "full_name", label: "Full name", maxLength: 160, required: true, type: "text" },
      { id: "identity_document", label: "ID", maxFiles: 1, required: false, type: "pdf" },
    ],
    payment: { enabled: false },
  },
  id: "11111111-1111-4111-8111-111111111111",
  kind: "membership_application",
};

function request(body: unknown) {
  return new NextRequest("https://jnuits.example.test/api/forms/membership-2026/uploads/sign", {
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
}

const upload = {
  fieldId: "identity_document",
  mimeType: "application/pdf",
  sha256: "a".repeat(64),
  size: 1024,
};

describe("public form upload signer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.enforceAuthActionProtection.mockResolvedValue(null);
    mocks.loadPublishedForm.mockResolvedValue(form);
    mocks.buildFormUploadInstructions.mockReturnValue({
      expiresAt: "2026-07-18T06:10:00.000Z",
      proof: "proof-token",
      uploads: [{ apiKey: "public-key", uploadId: "22222222-2222-4222-8222-222222222222" }],
    });
  });

  it("requires CAPTCHA protection before issuing form-scoped upload instructions", async () => {
    const response = await POST(request({ captchaToken: "captcha-token", uploads: [upload] }), {
      params: Promise.resolve({ slug: "membership-2026" }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      cloudName: "jnuits-test",
      expiresAt: "2026-07-18T06:10:00.000Z",
      proof: "proof-token",
      uploads: [{ apiKey: "public-key", uploadId: "22222222-2222-4222-8222-222222222222" }],
    });
    expect(mocks.enforceAuthActionProtection).toHaveBeenCalledWith(
      expect.objectContaining({
        captchaToken: "captcha-token",
        captchaValidation: "turnstile",
        rateLimitPrefix: `form-upload:${form.id}`,
      })
    );
    expect(mocks.buildFormUploadInstructions).toHaveBeenCalledWith(
      expect.objectContaining({ formDefinitionId: form.id, uploads: [upload] })
    );
  });

  it("issues CAPTCHA-protected upload signatures for event-registration forms", async () => {
    mocks.loadPublishedForm.mockResolvedValue({ ...form, kind: "event_registration" });

    const response = await POST(request({ captchaToken: "captcha-token", uploads: [upload] }), {
      params: Promise.resolve({ slug: "event-2026" }),
    });

    expect(response.status).toBe(200);
    expect(mocks.enforceAuthActionProtection).toHaveBeenCalledOnce();
    expect(mocks.buildFormUploadInstructions).toHaveBeenCalledOnce();
  });
});
