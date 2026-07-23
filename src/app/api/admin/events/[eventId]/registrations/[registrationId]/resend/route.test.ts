import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createAdminClient: vi.fn(), recordEventRegistrationDelivery: vi.fn(), requireAdminApiPermission: vi.fn(), resolveEventForAdminMutation: vi.fn(), sendEmail: vi.fn() }));
vi.mock("@/lib/admin/api-auth", () => ({ requireAdminApiPermission: mocks.requireAdminApiPermission }));
vi.mock("@/lib/content/events", () => ({ resolveEventForAdminMutation: mocks.resolveEventForAdminMutation }));
vi.mock("@/lib/events/delivery", () => ({ recordEventRegistrationDelivery: mocks.recordEventRegistrationDelivery }));
vi.mock("@/lib/notifications/email-builders", () => ({ buildEventConfirmationEmail: vi.fn(() => "confirmed"), buildEventWaitlistEmail: vi.fn(() => "waitlisted") }));
vi.mock("@/lib/notifications/send-email", () => ({ sendEmail: mocks.sendEmail }));
vi.mock("@/lib/security/with-api-guard", () => ({ withApiGuard: <T>(handler: T) => handler }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("@/lib/supabase/flexible", () => ({ asFlexibleClient: <T>(client: T) => client }));

import { POST } from "./route";
const registrationId = "11111111-1111-4111-8111-111111111111";
const requestId = "22222222-2222-4222-8222-222222222222";

function request() {
  return new NextRequest(`https://jnuits.test/api/admin/events/event-1/registrations/${registrationId}/resend`, {
    body: JSON.stringify({ idempotencyKey: requestId }), headers: { "Content-Type": "application/json" }, method: "POST",
  });
}

describe("event registration notice resend", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdminApiPermission.mockResolvedValue({ auth: { user: { id: "operator-1" } } });
    mocks.resolveEventForAdminMutation.mockResolvedValue({ id: "event-1" });
    mocks.sendEmail.mockResolvedValue({ messageId: "message-1", success: true });
    mocks.recordEventRegistrationDelivery.mockResolvedValue(undefined);
    const registrationQuery = { eq: vi.fn(), maybeSingle: vi.fn(), select: vi.fn() };
    registrationQuery.select.mockReturnValue(registrationQuery); registrationQuery.eq.mockReturnValue(registrationQuery);
    registrationQuery.maybeSingle.mockResolvedValue({ data: { cancelled_at: null, registration_code: "CODE1234", registration_status: "confirmed", registrant_email: "attendee@example.test", registrant_name: "Attendee" }, error: null });
    const eventQuery = { eq: vi.fn(), maybeSingle: vi.fn(), select: vi.fn() };
    eventQuery.select.mockReturnValue(eventQuery); eventQuery.eq.mockReturnValue(eventQuery);
    eventQuery.maybeSingle.mockResolvedValue({ data: { location_label: "Hall", starts_at: "2026-08-15T10:00:00.000Z", title: "Summit" }, error: null });
    mocks.createAdminClient.mockReturnValue({ from: vi.fn((table: string) => table === "event_registrations" ? registrationQuery : table === "events" ? eventQuery : { insert: vi.fn().mockResolvedValue({ error: null }) }) });
  });

  it("uses the durable delivery path with caller-bound idempotency", async () => {
    const response = await POST(request(), { params: Promise.resolve({ eventId: "event-1", registrationId }) });
    expect(response.status).toBe(200);
    expect(mocks.sendEmail).toHaveBeenCalledWith(expect.objectContaining({ idempotencyKey: `event-registration/event-1/CODE1234/resend/${requestId}` }));
    expect(mocks.recordEventRegistrationDelivery).toHaveBeenCalledWith(expect.objectContaining({ registrationCode: "CODE1234", status: "sent" }));
  });

  it("rejects cancelled registrations before sending", async () => {
    const client = mocks.createAdminClient();
    client.from("event_registrations").maybeSingle.mockResolvedValue({ data: { cancelled_at: "2026-07-23T15:00:00.000Z", registration_code: "CODE1234", registration_status: "cancelled", registrant_email: "attendee@example.test", registrant_name: "Attendee" }, error: null });
    const response = await POST(request(), { params: Promise.resolve({ eventId: "event-1", registrationId }) });
    expect(response.status).toBe(409);
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });
});
