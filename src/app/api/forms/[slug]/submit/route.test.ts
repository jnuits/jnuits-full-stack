import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ consumeFormUploadSession: vi.fn(), createFormSubmissionAssets: vi.fn(), createPendingFormSubmission: vi.fn(),
  enforceAuthActionProtection: vi.fn(), loadPublishedForm: vi.fn(), markFormConfirmationSent: vi.fn(), recordFormConfirmationDelivery: vi.fn(),
  sendEmail: vi.fn(), verifyFormUploadProof: vi.fn() }));
vi.mock("@/lib/forms/cloudinary-assets", () => ({ verifyCloudinaryFormAssets: vi.fn().mockResolvedValue(undefined) }));

vi.mock("@/lib/cloudinary/config", () => ({ getCloudinaryConfig: () => ({ apiSecret: "test-cloudinary-secret" }) }));
vi.mock("@/lib/env", () => ({ getAppBaseUrl: () => "https://jnuits.example.test" }));
vi.mock("@/lib/forms/repository", () => ({ createFormSubmissionAssets: mocks.createFormSubmissionAssets, createPendingFormSubmission: mocks.createPendingFormSubmission,
  loadPublishedForm: mocks.loadPublishedForm, markFormConfirmationSent: mocks.markFormConfirmationSent, recordFormConfirmationDelivery: mocks.recordFormConfirmationDelivery }));
vi.mock("@/lib/forms/upload-sessions", () => ({ consumeFormUploadSession: mocks.consumeFormUploadSession }));
vi.mock("@/lib/forms/upload-proof", () => ({ hashFormUploadManifest: () => "c".repeat(64), validateProofBoundFormAssets: ({ assets }: { assets: unknown }) => assets,
  verifyFormUploadProof: mocks.verifyFormUploadProof }));
vi.mock("@/lib/notifications/email-builders", () => ({ buildFormConfirmationEmail: vi.fn(() => "<p>Confirm</p>") }));
vi.mock("@/lib/notifications/send-email", () => ({ sendEmail: mocks.sendEmail }));
vi.mock("@/lib/auth/action-protection", () => ({ enforceAuthActionProtection: mocks.enforceAuthActionProtection }));
vi.mock("@/lib/security/with-api-guard", () => ({ withApiGuard: <T>(handler: T) => handler }));
import { POST } from "./route";
const ids = { definition: "11111111-1111-4111-8111-111111111111", submission: "33333333-3333-4333-8333-333333333333", version: "22222222-2222-4222-8222-222222222222", session: "44444444-4444-4444-8444-444444444444" };
function request(body: unknown) { return new NextRequest("https://jnuits.example.test/api/forms/membership-2026/submit", { body: JSON.stringify(body), headers: { "Content-Type": "application/json" }, method: "POST" }); }
function membershipForm(withUpload = false) { return { applicationBehavior: { fieldMapping: { email: "email", fullName: "full_name", studentId: "student_id" }, kind: "membership_application" },
  definition: { fields: [{ id: "full_name", label: "Full name", maxLength: 160, required: true, type: "text" }, { id: "email", label: "Email", required: true, type: "email" },
    ...(withUpload ? [{ id: "identity_document", label: "ID", maxFiles: 1, required: true, type: "pdf" }] : [])], payment: { enabled: false } },
  description: null, id: ids.definition, kind: "membership_application", slug: "membership-2026", title: "Membership application", versionId: ids.version };
}
const upload = { assetFolder: `jnuits/jnuits-full-stack/private/forms/${ids.definition}/${ids.session}`, fieldId: "identity_document", mimeType: "application/pdf",
  publicId: "55555555-5555-4555-8555-555555555555.pdf", resourceType: "raw", sha256: "a".repeat(64), size: 1024, uploadId: "66666666-6666-4666-8666-666666666666" };
const asset = { bytes: upload.size, cloudinaryAssetId: "a".repeat(32), cloudinaryFolder: upload.assetFolder, cloudinaryPublicId: upload.publicId,
  cloudinaryVersion: "1234567890", contentType: upload.mimeType, fieldId: upload.fieldId, resourceType: upload.resourceType, sha256: upload.sha256, uploadId: upload.uploadId };
describe("public form submission route", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.consumeFormUploadSession.mockResolvedValue(true); mocks.createFormSubmissionAssets.mockResolvedValue(undefined);
    mocks.createPendingFormSubmission.mockResolvedValue(ids.submission); mocks.enforceAuthActionProtection.mockResolvedValue(null); mocks.loadPublishedForm.mockResolvedValue(membershipForm());
    mocks.markFormConfirmationSent.mockResolvedValue(undefined); mocks.recordFormConfirmationDelivery.mockResolvedValue(undefined); mocks.sendEmail.mockResolvedValue({ messageId: "email-1", success: true });
    mocks.verifyFormUploadProof.mockReturnValue({ formDefinitionId: ids.definition, formVersionId: ids.version, sessionId: ids.session, uploads: [upload] }); });
  it("stores a pending submission and sends an idempotent confirmation", async () => {
    const response = await POST(request({ answers: { email: "Applicant@Example.Test", full_name: "Applicant Name" }, captchaToken: "captcha-token" }), { params: Promise.resolve({ slug: "membership-2026" }) });
    expect(response.status).toBe(202); expect(mocks.createPendingFormSubmission).toHaveBeenCalledWith(expect.objectContaining({ formVersionId: ids.version, submitterEmail: "applicant@example.test" }));
    expect(mocks.sendEmail).toHaveBeenCalledWith(expect.objectContaining({ idempotencyKey: `form-confirmation/${ids.submission}` }));
  });
  it("consumes a version-bound upload session exactly once before persistence", async () => {
    mocks.loadPublishedForm.mockResolvedValue(membershipForm(true));
    const response = await POST(request({ answers: { email: "applicant@example.test", full_name: "Applicant Name", identity_document: [upload.uploadId] },
      assets: [asset], captchaToken: "captcha-token", uploadProof: "proof-token" }), { params: Promise.resolve({ slug: "membership-2026" }) });
    expect(response.status).toBe(202);
    expect(mocks.verifyFormUploadProof).toHaveBeenCalledWith({ expectedFormDefinitionId: ids.definition, expectedFormVersionId: ids.version, proof: "proof-token", secret: "test-cloudinary-secret" });
    expect(mocks.consumeFormUploadSession).toHaveBeenCalledWith({ formDefinitionId: ids.definition, formVersionId: ids.version, manifestSha256: "c".repeat(64), sessionId: ids.session });
  });
  it("rejects replayed upload sessions before creating a submission", async () => {
    mocks.loadPublishedForm.mockResolvedValue(membershipForm(true)); mocks.consumeFormUploadSession.mockResolvedValue(false);
    const response = await POST(request({ answers: { email: "applicant@example.test", full_name: "Applicant Name", identity_document: [upload.uploadId] },
      assets: [asset], uploadProof: "proof-token" }), { params: Promise.resolve({ slug: "membership-2026" }) });
    expect(response.status).toBe(422); expect(mocks.createPendingFormSubmission).not.toHaveBeenCalled();
  });
  it("accepts honeypot submissions without persistence", async () => {
    const response = await POST(request({ answers: {}, website: "https://spam.example.test" }), { params: Promise.resolve({ slug: "membership-2026" }) });
    expect(response.status).toBe(202); expect(mocks.loadPublishedForm).not.toHaveBeenCalled();
  });
});
