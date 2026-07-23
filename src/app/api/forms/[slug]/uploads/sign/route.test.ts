import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ buildFormUploadInstructions: vi.fn(), createFormUploadSession: vi.fn(), enforceAuthActionProtection: vi.fn(), loadPublishedForm: vi.fn() }));
vi.mock("@/lib/auth/action-protection", () => ({ enforceAuthActionProtection: mocks.enforceAuthActionProtection }));
vi.mock("@/lib/cloudinary/config", () => ({ getCloudinaryConfig: () => ({ apiKey: "public-key", apiSecret: "server-only-secret", cloudName: "jnuits-test" }) }));
vi.mock("@/lib/forms/repository", () => ({ loadPublishedForm: mocks.loadPublishedForm }));
vi.mock("@/lib/forms/upload-sessions", () => ({ createFormUploadSession: mocks.createFormUploadSession }));
vi.mock("@/lib/forms/upload-signing", () => ({ buildFormUploadInstructions: mocks.buildFormUploadInstructions, FORM_UPLOAD_MAX_BYTES: 10 * 1024 * 1024 }));
vi.mock("@/lib/security/with-api-guard", () => ({ withApiGuard: <T>(handler: T) => handler }));
import { POST } from "./route";
const form = { definition: { fields: [{ id: "identity_document", label: "ID", maxFiles: 1, required: false, type: "pdf" }], payment: { enabled: false } },
  id: "11111111-1111-4111-8111-111111111111", kind: "membership_application", versionId: "22222222-2222-4222-8222-222222222222" };
function request(body: unknown) { return new NextRequest("https://jnuits.example.test/api/forms/membership-2026/uploads/sign", { body: JSON.stringify(body), headers: { "Content-Type": "application/json" }, method: "POST" }); }
const upload = { fieldId: "identity_document", mimeType: "application/pdf", sha256: "a".repeat(64), size: 1024 };
describe("public form upload signer", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.createFormUploadSession.mockResolvedValue(undefined); mocks.enforceAuthActionProtection.mockResolvedValue(null); mocks.loadPublishedForm.mockResolvedValue(form);
    mocks.buildFormUploadInstructions.mockReturnValue({ expiresAt: "2026-07-18T06:10:00.000Z", manifestSha256: "b".repeat(64), proof: "proof-token",
      sessionId: "33333333-3333-4333-8333-333333333333", uploads: [{ apiKey: "public-key", uploadId: "44444444-4444-4444-8444-444444444444" }] }); });
  it("persists a version-bound server session before returning upload instructions", async () => {
    const response = await POST(request({ captchaToken: "captcha-token", uploads: [upload] }), { params: Promise.resolve({ slug: "membership-2026" }) });
    expect(response.status).toBe(200);
    expect(mocks.buildFormUploadInstructions).toHaveBeenCalledWith(expect.objectContaining({ formDefinitionId: form.id, formVersionId: form.versionId, uploads: [upload] }));
    expect(mocks.createFormUploadSession).toHaveBeenCalledWith({ expiresAt: "2026-07-18T06:10:00.000Z", formDefinitionId: form.id,
      formVersionId: form.versionId, manifestSha256: "b".repeat(64), sessionId: "33333333-3333-4333-8333-333333333333" });
  });
  it("does not issue signatures when the server session cannot be persisted", async () => {
    mocks.createFormUploadSession.mockRejectedValue(new Error("unavailable"));
    const response = await POST(request({ captchaToken: "captcha-token", uploads: [upload] }), { params: Promise.resolve({ slug: "membership-2026" }) });
    expect(response.status).toBe(422);
  });
});
