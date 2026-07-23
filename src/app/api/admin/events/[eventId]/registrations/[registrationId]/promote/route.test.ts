import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  recordEventRegistrationDelivery: vi.fn(),
  requireAdminApiPermission: vi.fn(),
  resolveEventForAdminMutation: vi.fn(),
  rpc: vi.fn(),
  sendEmail: vi.fn(),
}));
vi.mock("@/lib/admin/api-auth", () => ({ requireAdminApiPermission: mocks.requireAdminApiPermission }));
vi.mock("@/lib/content/events", () => ({ resolveEventForAdminMutation: mocks.resolveEventForAdminMutation }));
vi.mock("@/lib/events/delivery", () => ({ recordEventRegistrationDelivery: mocks.recordEventRegistrationDelivery }));
vi.mock("@/lib/notifications/email-builders", () => ({ buildEventConfirmationEmail: vi.fn(() => "<p>Confirmation</p>") }));
vi.mock("@/lib/notifications/send-email", () => ({ sendEmail: mocks.sendEmail }));
vi.mock("@/lib/security/with-api-guard", () => ({ withApiGuard: <T>(handler: T) => handler }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("@/lib/supabase/flexible", () => ({ asFlexibleClient: <T>(client: T) => client }));

import { POST } from "./route";
const registrationId = "fc9f5564-c735-4d2c-86ce-008ec55b7e80";

function request() {
  return new NextRequest(`https://jnuits.org.bd/api/admin/events/event-1/registrations/${registrationId}/promote`, { method: "POST" });
}

describe("event waitlist promotion route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdminApiPermission.mockResolvedValue({ auth: { user: { id: "operator-1" } } });
    mocks.resolveEventForAdminMutation.mockResolvedValue({ id: "event-1", legacyContentPostId: null });
    mocks.rpc.mockResolvedValue({ data: [{ registration_code: "CONFIRM1", result_status: "promoted" }], error: null });
    mocks.recordEventRegistrationDelivery.mockResolvedValue(undefined);
    mocks.sendEmail.mockResolvedValue({ messageId: "promotion-email-1", success: true });

    const registrationQuery = { eq: vi.fn(), maybeSingle: vi.fn(), select: vi.fn() };
    registrationQuery.select.mockReturnValue(registrationQuery);
    registrationQuery.eq.mockReturnValue(registrationQuery);
    registrationQuery.maybeSingle.mockResolvedValue({ data: { registrant_email: "attendee@example.test", registrant_name: "Event Attendee" }, error: null });
    const eventQuery = { eq: vi.fn(), maybeSingle: vi.fn(), select: vi.fn() };
    eventQuery.select.mockReturnValue(eventQuery);
    eventQuery.eq.mockReturnValue(eventQuery);
    eventQuery.maybeSingle.mockResolvedValue({ data: { location_label: "JnUITS hall", starts_at: "2026-08-15T10:00:00.000Z", title: "JnUITS Summit" }, error: null });

    mocks.createAdminClient.mockReturnValue({
      from: vi.fn((table: string) => table === "event_registrations" ? registrationQuery : eventQuery),
      rpc: mocks.rpc,
    });
  });

  it("promotes through the capacity-safe RPC", async () => {
    const response = await POST(request(), { params: Promise.resolve({ eventId: "event-1", registrationId }) });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ auditRecorded: true, code: "CONFIRM1", success: true });
    expect(mocks.rpc).toHaveBeenCalledWith("promote_event_waitlist_registration", {
      p_actor_user_id: "operator-1", p_event_id: "event-1", p_registration_id: registrationId,
    });
    expect(mocks.sendEmail).toHaveBeenCalledWith(expect.objectContaining({
      idempotencyKey: "event-registration/event-1/CONFIRM1/promoted",
      to: "attendee@example.test",
    }));
  });

  it("treats an idempotent promoted result as success", async () => {
    const first = await POST(request(), { params: Promise.resolve({ eventId: "event-1", registrationId }) });
    const retry = await POST(request(), { params: Promise.resolve({ eventId: "event-1", registrationId }) });
    expect(first.status).toBe(200);
    expect(retry.status).toBe(200);
    expect(mocks.sendEmail).toHaveBeenNthCalledWith(2, expect.objectContaining({
      idempotencyKey: "event-registration/event-1/CONFIRM1/promoted",
    }));
  });

  it("does not send confirmation when capacity is still full", async () => {
    mocks.rpc.mockResolvedValue({ data: [{ registration_code: null, result_status: "full" }], error: null });
    const response = await POST(request(), { params: Promise.resolve({ eventId: "event-1", registrationId }) });
    expect(response.status).toBe(409);
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });
});
