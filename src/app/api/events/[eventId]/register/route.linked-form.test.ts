import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  checkRateLimitForApi: vi.fn(),
  consumeFormUploadSession: vi.fn(),
  createAdminClient: vi.fn(),
  createClient: vi.fn(),
  getCloudinaryConfig: vi.fn(),
  enforceAuthActionProtection: vi.fn(),
  loadPublishedFormByVersionId: vi.fn(),
  resolvePublishedEventForMutation: vi.fn(),
  recordEventRegistrationDelivery: vi.fn(),
  rpc: vi.fn(),
  sendEmail: vi.fn(),
  validateProofBoundFormAssets: vi.fn(),
  verifyFormUploadProof: vi.fn(),
}));

vi.mock("@/lib/auth/action-protection", () => ({
  enforceAuthActionProtection: mocks.enforceAuthActionProtection,
}));

vi.mock("@/lib/cloudinary/config", () => ({
  getCloudinaryConfig: mocks.getCloudinaryConfig,
}));

vi.mock("@/lib/content/events", () => ({
  resolvePublishedEventForMutation: mocks.resolvePublishedEventForMutation,
}));

vi.mock("@/lib/forms/repository", () => ({
  loadPublishedFormByVersionId: mocks.loadPublishedFormByVersionId,
}));

vi.mock("@/lib/events/delivery", () => ({
  recordEventRegistrationDelivery: mocks.recordEventRegistrationDelivery,
}));

vi.mock("@/lib/forms/upload-proof", () => ({
  hashFormUploadManifest: () => "c".repeat(64),
  validateProofBoundFormAssets: mocks.validateProofBoundFormAssets,
  verifyFormUploadProof: mocks.verifyFormUploadProof,
}));
vi.mock("@/lib/forms/upload-sessions", () => ({
  consumeFormUploadSession: mocks.consumeFormUploadSession,
}));

vi.mock("@/lib/notifications/email-builders", () => ({
  buildEventConfirmationEmail: vi.fn(() => "<p>Confirmation</p>"),
  buildEventWaitlistEmail: vi.fn(() => "<p>Waitlist</p>"),
}));

vi.mock("@/lib/notifications/send-email", () => ({ sendEmail: mocks.sendEmail }));
vi.mock("@/lib/security/rate-limit", () => ({
  checkRateLimitForApi: mocks.checkRateLimitForApi,
  getRequestIp: () => "127.0.0.1",
  RATE_LIMITS: { eventRegister: { limit: 5, windowMs: 60_000 } },
}));
vi.mock("@/lib/security/with-api-guard", () => ({ withApiGuard: <T>(handler: T) => handler }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("@/lib/supabase/flexible", () => ({ asFlexibleClient: <T>(client: T) => client }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));

import { POST } from "./route";

describe("linked event registration form", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.checkRateLimitForApi.mockResolvedValue({ success: true });
  mocks.consumeFormUploadSession.mockResolvedValue(true);
    mocks.enforceAuthActionProtection.mockResolvedValue(null);
    mocks.getCloudinaryConfig.mockReturnValue({ apiSecret: "server-only-secret" });
    mocks.validateProofBoundFormAssets.mockReturnValue([]);
    mocks.recordEventRegistrationDelivery.mockResolvedValue(undefined);
    mocks.sendEmail.mockResolvedValue({ messageId: "event-email-1", success: true });
    mocks.verifyFormUploadProof.mockReturnValue({ uploads: [] });
    mocks.createAdminClient.mockReturnValue({ rpc: mocks.rpc });
    mocks.createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    });
    mocks.resolvePublishedEventForMutation.mockResolvedValue({
      id: "event-1",
      legacyContentPostId: null,
      locationLabel: "JnUITS hall",
      registrationClosed: false,
      registrationFormVersionId: "00000000-0000-4000-8000-000000000001",
      registrationMode: "internal",
      registrationOpen: true,
      startsAt: "2026-08-15T10:00:00.000Z",
      title: "JnUITS Summit",
    });
    mocks.loadPublishedFormByVersionId.mockResolvedValue({
      applicationBehavior: {
        fieldMapping: { email: "email", fullName: "full_name", phone: "phone" },
      },
      definition: {
        fields: [
          { id: "full_name", label: "Full name", required: true, type: "text" },
          { id: "email", label: "Email", required: true, type: "email" },
          { id: "phone", label: "Phone", required: false, type: "telephone" },
          { id: "meal", label: "Meal", required: true, type: "select", options: [{ label: "Veg", value: "veg" }] },
        ],
        payment: { enabled: false },
      },
      id: "00000000-0000-4000-8000-000000000002",
      kind: "event_registration",
      slug: "summit-registration",
      title: "Summit registration",
      versionId: "00000000-0000-4000-8000-000000000001",
    });
    mocks.rpc.mockResolvedValue({
      data: [{ registration_code: "FORM123", result_status: "confirmed" }],
      error: null,
    });
  });

  it("uses validated linked-form answers in the atomic event registration RPC", async () => {
    const response = await POST(
      new NextRequest("https://jnuits.org.bd/api/events/event-1/register", {
        body: JSON.stringify({
          answers: {
            email: "Attendee@Example.Test",
            full_name: "Event Attendee",
            meal: "veg",
            phone: "+8801700000000",
          },
          captchaToken: "captcha-token",
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      }),
      { params: Promise.resolve({ eventId: "event-1" }) }
    );

    expect(response.status).toBe(200);
    expect(mocks.enforceAuthActionProtection).toHaveBeenCalledWith(
      expect.objectContaining({
        captchaToken: "captcha-token",
        captchaValidation: "turnstile",
        email: "attendee@example.test",
        rateLimitPrefix: "event-register:event-1",
      })
    );
    expect(mocks.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: "event-registration/event-1/FORM123/confirmed",
        to: "attendee@example.test",
      })
    );
    expect(mocks.recordEventRegistrationDelivery).toHaveBeenCalledWith({
      eventId: "event-1",
      idempotencyKey: "event-registration/event-1/FORM123/confirmed",
      providerMessageId: "event-email-1",
      registrationCode: "FORM123",
      status: "sent",
    });    expect(mocks.rpc).toHaveBeenCalledWith(
      "register_for_event_with_form_assets_atomic",
      expect.objectContaining({
        p_answers: {
          email: "attendee@example.test",
          full_name: "Event Attendee",
          meal: "veg",
          phone: "+8801700000000",
        },
        p_event_id: "event-1",
        p_form_definition_id: "00000000-0000-4000-8000-000000000002",
        p_form_version_id: "00000000-0000-4000-8000-000000000001",
        p_registrant_email: "attendee@example.test",
        p_registrant_name: "Event Attendee",
        p_registrant_phone: "+8801700000000",
      })
    );
  });

  it("records a durable waitlist message without claiming confirmation", async () => {
    mocks.rpc.mockResolvedValue({
      data: [{ registration_code: "WAIT123", result_status: "waitlisted" }],
      error: null,
    });

    const response = await POST(
      new NextRequest("https://jnuits.org.bd/api/events/event-1/register", {
        body: JSON.stringify({
          answers: {
            email: "attendee@example.test",
            full_name: "Event Attendee",
            meal: "veg",
          },
          captchaToken: "captcha-token",
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      }),
      { params: Promise.resolve({ eventId: "event-1" }) }
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      code: "WAIT123",
      eventTitle: "JnUITS Summit",
      success: true,
      waitlisted: true,
    });
    expect(mocks.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: "event-registration/event-1/WAIT123/waitlisted",
        subject: "You're on the waitlist: JnUITS Summit",
      })
    );
    expect(mocks.recordEventRegistrationDelivery).toHaveBeenCalledWith({
      eventId: "event-1",
      idempotencyKey: "event-registration/event-1/WAIT123/waitlisted",
      providerMessageId: "event-email-1",
      registrationCode: "WAIT123",
      status: "sent",
    });
  });
  it("passes proof-bound event upload assets to its atomic RPC", async () => {
    const uploadId = "22222222-2222-4222-8222-222222222222";
    const asset = {
      bytes: 1024,
      cloudinaryAssetId: "a".repeat(32),
      cloudinaryFolder: "jnuits/jnuits-full-stack/private/forms/form-1/session-1",
      cloudinaryPublicId: `${uploadId}.pdf`,
      cloudinaryVersion: "1234567890",
      contentType: "application/pdf",
      fieldId: "identity_document",
      resourceType: "raw",
      sha256: "b".repeat(64),
      uploadId,
    };
    mocks.loadPublishedFormByVersionId.mockResolvedValue({
      applicationBehavior: {
        fieldMapping: { email: "email", fullName: "full_name", phone: "phone" },
      },
      definition: {
        fields: [
          { id: "full_name", label: "Full name", required: true, type: "text" },
          { id: "email", label: "Email", required: true, type: "email" },
          { id: "identity_document", label: "Identity document", maxFiles: 1, required: true, type: "pdf" },
        ],
        payment: { enabled: false },
      },
      id: "00000000-0000-4000-8000-000000000002",
      kind: "event_registration",
      slug: "summit-registration",
      title: "Summit registration",
      versionId: "00000000-0000-4000-8000-000000000001",
    });
    mocks.verifyFormUploadProof.mockReturnValue({
      sessionId: "33333333-3333-4333-8333-333333333333",
      uploads: [
        {
          assetFolder: asset.cloudinaryFolder,
          fieldId: asset.fieldId,
          mimeType: asset.contentType,
          publicId: asset.cloudinaryPublicId,
          resourceType: asset.resourceType,
          sha256: asset.sha256,
          size: asset.bytes,
          uploadId,
        },
      ],
    });
    mocks.validateProofBoundFormAssets.mockReturnValue([asset]);

    const response = await POST(
      new NextRequest("https://jnuits.org.bd/api/events/event-1/register", {
        body: JSON.stringify({
          answers: {
            email: "attendee@example.test",
            full_name: "Event Attendee",
            identity_document: [uploadId],
          },
          assets: [asset],
          captchaToken: "captcha-token",
          uploadProof: "proof-token",
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      }),
      { params: Promise.resolve({ eventId: "event-1" }) }
    );

    expect(response.status).toBe(200);
    expect(mocks.enforceAuthActionProtection).toHaveBeenCalledWith(
      expect.objectContaining({
        captchaToken: "captcha-token",
        email: "attendee@example.test",
      })
    );

    expect(mocks.verifyFormUploadProof).toHaveBeenCalledWith({
      expectedFormDefinitionId: "00000000-0000-4000-8000-000000000002",
      expectedFormVersionId: "00000000-0000-4000-8000-000000000001",
      proof: "proof-token",
      secret: "server-only-secret",
    });
    expect(mocks.validateProofBoundFormAssets).toHaveBeenCalledWith(
      expect.objectContaining({ assets: [asset] })
    );
    expect(mocks.consumeFormUploadSession).toHaveBeenCalledWith({
      formDefinitionId: "00000000-0000-4000-8000-000000000002",
      formVersionId: "00000000-0000-4000-8000-000000000001",
      manifestSha256: "c".repeat(64),
      sessionId: "33333333-3333-4333-8333-333333333333",
    });
    expect(mocks.rpc).toHaveBeenCalledWith(
      "register_for_event_with_form_assets_atomic",
      expect.objectContaining({ p_assets: [asset] })
    );

    mocks.rpc.mockClear();
    mocks.consumeFormUploadSession.mockResolvedValue(false);
    const replay = await POST(
      new NextRequest("https://jnuits.org.bd/api/events/event-1/register", {
        body: JSON.stringify({
          answers: { email: "attendee@example.test", full_name: "Event Attendee", identity_document: [uploadId] },
          assets: [asset], captchaToken: "captcha-token", uploadProof: "proof-token",
        }),
        headers: { "Content-Type": "application/json" }, method: "POST",
      }),
      { params: Promise.resolve({ eventId: "event-1" }) }
    );
    expect(replay.status).toBe(422);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("stops a linked-form registration before its atomic RPC when CAPTCHA fails", async () => {
    mocks.enforceAuthActionProtection.mockResolvedValue("Complete the verification challenge.");

    const response = await POST(
      new NextRequest("https://jnuits.org.bd/api/events/event-1/register", {
        body: JSON.stringify({
          answers: {
            email: "attendee@example.test",
            full_name: "Event Attendee",
            meal: "veg",
          },
          captchaToken: "invalid-token",
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      }),
      { params: Promise.resolve({ eventId: "event-1" }) }
    );

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({
      error: "Complete the verification challenge.",
    });
    expect(mocks.enforceAuthActionProtection).toHaveBeenCalledOnce();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
