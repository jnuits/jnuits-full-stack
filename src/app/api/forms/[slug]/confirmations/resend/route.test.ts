import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  enforceAuthActionProtection: vi.fn(),
  loadPublishedForm: vi.fn(),
  markFormConfirmationSent: vi.fn(),
  recordFormConfirmationDelivery: vi.fn(),
  refreshFormSubmissionConfirmation: vi.fn(),
  sendEmail: vi.fn(),
}));

vi.mock("@/lib/auth/action-protection", () => ({
  enforceAuthActionProtection: mocks.enforceAuthActionProtection,
}));

vi.mock("@/lib/forms/repository", () => ({
  loadPublishedForm: mocks.loadPublishedForm,
  markFormConfirmationSent: mocks.markFormConfirmationSent,
  recordFormConfirmationDelivery: mocks.recordFormConfirmationDelivery,
  refreshFormSubmissionConfirmation: mocks.refreshFormSubmissionConfirmation,
}));

vi.mock("@/lib/notifications/send-email", () => ({
  sendEmail: mocks.sendEmail,
}));

vi.mock("@/lib/security/with-api-guard", () => ({
  withApiGuard: <T>(handler: T) => handler,
}));

import { POST } from "./route";

const formId = "11111111-1111-4111-8111-111111111111";
const submissionId = "22222222-2222-4222-8222-222222222222";

function request(body: unknown) {
  return new NextRequest("https://jnuits.example.test/api/forms/membership-2026/confirmations/resend", {
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
}

function context() {
  return { params: Promise.resolve({ slug: "membership-2026" }) };
}

describe("form confirmation resend route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.enforceAuthActionProtection.mockResolvedValue(null);
    mocks.loadPublishedForm.mockResolvedValue({
      id: formId,
      kind: "membership_application",
      title: "Membership application",
    });
    mocks.markFormConfirmationSent.mockResolvedValue(undefined);
    mocks.recordFormConfirmationDelivery.mockResolvedValue(undefined);
    mocks.refreshFormSubmissionConfirmation.mockResolvedValue({
      applicantName: "Ada Lovelace",
      formSubmissionId: submissionId,
      resultStatus: "resent",
    });
    mocks.sendEmail.mockResolvedValue({ messageId: "provider-message", success: true });
  });

  it("refreshes and sends a confirmation without returning submission data", async () => {
    const response = await POST(
      request({ captchaToken: "turnstile-token", email: "Ada@example.test" }),
      context()
    );

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({ success: true });
    expect(mocks.refreshFormSubmissionConfirmation).toHaveBeenCalledWith(
      expect.objectContaining({
        formDefinitionId: formId,
        submitterEmail: "ada@example.test",
      })
    );
    expect(mocks.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: expect.stringMatching(
          new RegExp(`^form-confirmation-resend/${submissionId}/[a-f0-9]{64}$`)
        ),
        to: "ada@example.test",
      })
    );
    expect(mocks.recordFormConfirmationDelivery).toHaveBeenCalledWith(
      expect.objectContaining({
        formSubmissionId: submissionId,
        idempotencyKey: expect.stringMatching(
          new RegExp(`^form-confirmation-resend/${submissionId}/[a-f0-9]{64}$`)
        ),
        providerMessageId: "provider-message",
        status: "sent",
      })
    );

    expect(mocks.markFormConfirmationSent).toHaveBeenCalledWith(
      submissionId,
      expect.stringMatching(/^[a-f0-9]{64}$/)
    );
  });

  it("returns the same accepted response when no pending submission matches", async () => {
    mocks.refreshFormSubmissionConfirmation.mockResolvedValue({
      applicantName: null,
      formSubmissionId: null,
      resultStatus: "not_found",
    });

    const response = await POST(request({ email: "missing@example.test" }), context());

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({ success: true });
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it("does not disclose database throttling or send another email", async () => {
    mocks.refreshFormSubmissionConfirmation.mockResolvedValue({
      applicantName: null,
      formSubmissionId: null,
      resultStatus: "rate_limited",
    });

    const response = await POST(request({ email: "ada@example.test" }), context());

    expect(response.status).toBe(202);
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it("requires public abuse protection before refreshing a token", async () => {
    mocks.enforceAuthActionProtection.mockResolvedValue("Complete the verification challenge.");

    const response = await POST(request({ email: "ada@example.test" }), context());

    expect(response.status).toBe(422);
    expect(mocks.refreshFormSubmissionConfirmation).not.toHaveBeenCalled();
  });

  it("rejects event forms and malformed emails", async () => {
    mocks.loadPublishedForm.mockResolvedValue({ id: formId, kind: "event_registration" });

    const eventResponse = await POST(request({ email: "ada@example.test" }), context());
    const invalidResponse = await POST(request({ email: "not-an-email" }), context());

    expect(eventResponse.status).toBe(409);
    expect(invalidResponse.status).toBe(400);
    expect(mocks.refreshFormSubmissionConfirmation).not.toHaveBeenCalled();
  });
});
