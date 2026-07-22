import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  createClient: vi.fn(),
  enforceAuthActionProtection: vi.fn(),
  loadPublishedFormByVersionId: vi.fn(),
  recordEventRegistrationDelivery: vi.fn(),
  resolvePublishedEventForMutation: vi.fn(),
  rpc: vi.fn(),
  sendEmail: vi.fn(),
}));

vi.mock("@/lib/auth/action-protection", () => ({
  enforceAuthActionProtection: mocks.enforceAuthActionProtection,
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

vi.mock("@/lib/notifications/email-builders", () => ({
  buildEventConfirmationEmail: vi.fn(() => "<p>Confirmation</p>"),
  buildEventWaitlistEmail: vi.fn(() => "<p>Waitlist</p>"),
}));

vi.mock("@/lib/notifications/send-email", () => ({
  sendEmail: mocks.sendEmail,
}));

vi.mock("@/lib/security/with-api-guard", () => ({
  withApiGuard: <T>(handler: T) => handler,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}));

vi.mock("@/lib/supabase/flexible", () => ({
  asFlexibleClient: <T>(client: T) => client,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createClient,
}));

import { POST } from "./route";

function request() {
  return new NextRequest("https://jnuits.org.bd/api/events/event-1/register", {
    body: JSON.stringify({
      captchaToken: "captcha-token",
      email: "attendee@example.test",
      name: "Event Attendee",
      phone: "+8801700000000",
    }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
}

describe("event registration route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.enforceAuthActionProtection.mockResolvedValue(null);
    mocks.recordEventRegistrationDelivery.mockResolvedValue(undefined);
    mocks.sendEmail.mockResolvedValue({ messageId: "event-email-1", success: true });
    mocks.createAdminClient.mockReturnValue({ rpc: mocks.rpc });
    mocks.createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    });
    mocks.resolvePublishedEventForMutation.mockResolvedValue({
      id: "event-1",
      legacyContentPostId: null,
      locationLabel: "JnUITS hall",
      registrationClosed: false,
      registrationMode: "internal",
      registrationOpen: true,
      startsAt: "2026-08-15T10:00:00.000Z",
      title: "JnUITS Summit",
    });
  });

  it("returns a waitlist confirmation when the atomic registration RPC queues the attendee", async () => {
    mocks.rpc.mockResolvedValue({
      data: [{ registration_code: "WAITLIST1", result_status: "waitlisted" }],
      error: null,
    });

    const response = await POST(request(), {
      params: Promise.resolve({ eventId: "event-1" }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      code: "WAITLIST1",
      eventTitle: "JnUITS Summit",
      success: true,
      waitlisted: true,
    });
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
        idempotencyKey: "event-registration/event-1/WAITLIST1/waitlisted",
        subject: "You're on the waitlist: JnUITS Summit",
        to: "attendee@example.test",
      })
    );
    expect(mocks.recordEventRegistrationDelivery).toHaveBeenCalledWith({
      eventId: "event-1",
      idempotencyKey: "event-registration/event-1/WAITLIST1/waitlisted",
      providerMessageId: "event-email-1",
      registrationCode: "WAITLIST1",
      status: "sent",
    });
  });
});
