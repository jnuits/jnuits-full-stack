import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createFormSubmissionAssets: vi.fn(),
  createPendingFormSubmission: vi.fn(),
  enforceAuthActionProtection: vi.fn(),
  loadPublishedForm: vi.fn(),
  markFormConfirmationSent: vi.fn(),
  recordFormConfirmationDelivery: vi.fn(),
  sendEmail: vi.fn(),
  verifyFormUploadProof: vi.fn(),
}));

vi.mock("@/lib/cloudinary/config", () => ({
  getCloudinaryConfig: () => ({ apiSecret: "test-cloudinary-secret" }),
}));

vi.mock("@/lib/env", () => ({
  getAppBaseUrl: () => "https://jnuits.example.test",
}));

vi.mock("@/lib/forms/repository", () => ({
  createFormSubmissionAssets: mocks.createFormSubmissionAssets,
  createPendingFormSubmission: mocks.createPendingFormSubmission,
  loadPublishedForm: mocks.loadPublishedForm,
  markFormConfirmationSent: mocks.markFormConfirmationSent,
  recordFormConfirmationDelivery: mocks.recordFormConfirmationDelivery,
}));

vi.mock("@/lib/forms/upload-proof", () => ({
  validateProofBoundFormAssets: ({ assets }: { assets: unknown }) => assets,
  verifyFormUploadProof: mocks.verifyFormUploadProof,
}));

vi.mock("@/lib/notifications/email-builders", () => ({
  buildFormConfirmationEmail: vi.fn(() => "<p>Confirm</p>"),
}));

vi.mock("@/lib/notifications/send-email", () => ({
  sendEmail: mocks.sendEmail,
}));

vi.mock("@/lib/auth/action-protection", () => ({
  enforceAuthActionProtection: mocks.enforceAuthActionProtection,
}));

vi.mock("@/lib/security/with-api-guard", () => ({
  withApiGuard: <T>(handler: T) => handler,
}));

import { POST } from "./route";

const ids = {
  definition: "11111111-1111-4111-8111-111111111111",
  submission: "33333333-3333-4333-8333-333333333333",
  version: "22222222-2222-4222-8222-222222222222",
};

function request(body: unknown) {
  return new NextRequest("https://jnuits.example.test/api/forms/membership-2026/submit", {
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
}

function membershipForm() {
  return {
    applicationBehavior: {
      fieldMapping: { email: "email", fullName: "full_name", studentId: "student_id" },
      kind: "membership_application",
    },
    definition: {
      fields: [
        { id: "full_name", label: "Full name", maxLength: 160, required: true, type: "text" },
        { id: "email", label: "Email", required: true, type: "email" },
        { id: "student_id", label: "Student ID", maxLength: 160, required: false, type: "text" },
      ],
      payment: { enabled: false },
    },
    description: null,
    id: ids.definition,
    kind: "membership_application",
    slug: "membership-2026",
    title: "Membership application",
    versionId: ids.version,
  };
}

function signedUpload() {
  return {
    assetFolder:
      "jnuits/jnuits-full-stack/private/forms/11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222",
    fieldId: "identity_document",
    mimeType: "application/pdf",
    publicId: "33333333-3333-4333-8333-333333333333.pdf",
    resourceType: "raw",
    sha256: "a".repeat(64),
    size: 1024,
    uploadId: "44444444-4444-4444-8444-444444444444",
  };
}

describe("public form submission route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createFormSubmissionAssets.mockResolvedValue(undefined);
    mocks.createPendingFormSubmission.mockResolvedValue(ids.submission);
    mocks.enforceAuthActionProtection.mockResolvedValue(null);
    mocks.loadPublishedForm.mockResolvedValue(membershipForm());
    mocks.markFormConfirmationSent.mockResolvedValue(undefined);
    mocks.recordFormConfirmationDelivery.mockResolvedValue(undefined);
    mocks.sendEmail.mockResolvedValue({ messageId: "email-1", success: true });
    mocks.verifyFormUploadProof.mockReturnValue({
      formDefinitionId: ids.definition,
      uploads: [signedUpload()],
    });
  });

  it("stores only a confirmation token hash and sends an idempotent email", async () => {
    const response = await POST(request({
      answers: {
        email: "Applicant@Example.Test",
        full_name: "Applicant Name",
        student_id: "20201234",
      },
      captchaToken: "captcha-token",
    }), {
      params: Promise.resolve({ slug: "membership-2026" }),
    });

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({
      confirmationRequired: true,
      success: true,
    });
    expect(mocks.createPendingFormSubmission).toHaveBeenCalledWith(
      expect.objectContaining({
        answers: {
          email: "applicant@example.test",
          full_name: "Applicant Name",
          student_id: "20201234",
        },
        confirmationTokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        formDefinitionId: ids.definition,
        formVersionId: ids.version,
        submitterEmail: "applicant@example.test",
      })
    );
    expect(mocks.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: `form-confirmation/${ids.submission}`,
        subject: "Confirm your email for Membership application",
        to: "applicant@example.test",
      })
    );
    expect(mocks.recordFormConfirmationDelivery).toHaveBeenCalledWith(
      expect.objectContaining({
        formSubmissionId: ids.submission,
        idempotencyKey: `form-confirmation/${ids.submission}`,
        providerMessageId: "email-1",
        status: "sent",
      })
    );
    expect(mocks.markFormConfirmationSent).toHaveBeenCalledWith(ids.submission);
  });

  it("accepts honeypot submissions without persisting data", async () => {
    const response = await POST(request({
      answers: {},
      website: "https://spam.example.test",
    }), {
      params: Promise.resolve({ slug: "membership-2026" }),
    });

    expect(response.status).toBe(202);
    expect(mocks.loadPublishedForm).not.toHaveBeenCalled();
    expect(mocks.createPendingFormSubmission).not.toHaveBeenCalled();
  });

  it("does not let the generic route bypass event capacity rules", async () => {
    mocks.loadPublishedForm.mockResolvedValue({
      ...membershipForm(),
      applicationBehavior: null,
      kind: "event_registration",
    });

    const response = await POST(request({ answers: {} }), {
      params: Promise.resolve({ slug: "membership-2026" }),
    });

    expect(response.status).toBe(409);
    expect(mocks.createPendingFormSubmission).not.toHaveBeenCalled();
  });

  it("stops before persistence when CAPTCHA protection fails", async () => {
    mocks.enforceAuthActionProtection.mockResolvedValue("Complete the verification challenge.");

    const response = await POST(request({
      answers: { email: "applicant@example.test", full_name: "Applicant Name" },
    }), {
      params: Promise.resolve({ slug: "membership-2026" }),
    });

    expect(response.status).toBe(422);
    expect(mocks.createPendingFormSubmission).not.toHaveBeenCalled();
  });

  it("persists a proof-bound private upload with its form submission", async () => {
    const upload = signedUpload();
    mocks.loadPublishedForm.mockResolvedValue({
      ...membershipForm(),
      definition: {
        fields: [
          ...membershipForm().definition.fields,
          {
            id: upload.fieldId,
            label: "Identity document",
            maxFiles: 1,
            required: true,
            type: "pdf",
          },
        ],
        payment: { enabled: false },
      },
    });

    const response = await POST(request({
      answers: {
        email: "applicant@example.test",
        full_name: "Applicant Name",
        identity_document: [upload.uploadId],
      },
      assets: [
        {
          bytes: upload.size,
          cloudinaryAssetId: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          cloudinaryFolder: upload.assetFolder,
          cloudinaryPublicId: upload.publicId,
          cloudinaryVersion: "1234567890",
          contentType: upload.mimeType,
          fieldId: upload.fieldId,
          resourceType: upload.resourceType,
          sha256: upload.sha256,
          uploadId: upload.uploadId,
        },
      ],
      captchaToken: "captcha-token",
      uploadProof: "proof-token",
    }), {
      params: Promise.resolve({ slug: "membership-2026" }),
    });

    expect(response.status).toBe(202);
    expect(mocks.enforceAuthActionProtection).toHaveBeenCalledWith(
      expect.objectContaining({
        captchaToken: "captcha-token",
        email: "applicant@example.test",
      })
    );
    expect(mocks.createFormSubmissionAssets).toHaveBeenCalledWith(
      ids.submission,
      [
        expect.objectContaining({
          cloudinaryAssetId: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          fieldId: upload.fieldId,
          uploadId: upload.uploadId,
        }),
      ]
    );
  });
});
