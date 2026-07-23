import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createAdminClient: vi.fn(), requireAdminApiPermission: vi.fn(), resolveEventForAdminMutation: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/admin/api-auth", () => ({ requireAdminApiPermission: mocks.requireAdminApiPermission }));
vi.mock("@/lib/content/events", () => ({ resolveEventForAdminMutation: mocks.resolveEventForAdminMutation }));
vi.mock("@/lib/security/with-api-guard", () => ({ withApiGuard: <T>(handler: T) => handler }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("@/lib/supabase/flexible", () => ({ asFlexibleClient: <T>(client: T) => client }));

import { POST } from "./route";

function request(code = "CODE1234") {
  return new NextRequest("https://jnuits.test/api/admin/events/event-1/checkin", {
    body: JSON.stringify({ code }), headers: { "Content-Type": "application/json" }, method: "POST",
  });
}

describe("atomic event check-in route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdminApiPermission.mockResolvedValue({ auth: { user: { id: "operator-1" } } });
    mocks.resolveEventForAdminMutation.mockResolvedValue({ id: "event-1" });
    const identityQuery = { eq: vi.fn(), maybeSingle: vi.fn(), select: vi.fn() };
    identityQuery.select.mockReturnValue(identityQuery);
    identityQuery.eq.mockReturnValue(identityQuery);
    identityQuery.maybeSingle.mockResolvedValue({ data: { members: null, registrant_email: "attendee@example.test", registrant_name: "Attendee" }, error: null });
    mocks.createAdminClient.mockReturnValue({ from: vi.fn(() => identityQuery), rpc: mocks.rpc });
    mocks.rpc.mockResolvedValue({ data: [{ checked_in_at: "2026-07-23T15:00:00.000Z", registration_id: "registration-1", result_status: "checked_in" }], error: null });
  });

  it("checks in through the event-scoped RPC", async () => {
    const response = await POST(request(), { params: Promise.resolve({ eventId: "event-1" }) });
    expect(response.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith("check_in_event_registration", {
      p_actor_user_id: "operator-1", p_event_id: "event-1", p_registration_code: "CODE1234",
    });
    await expect(response.json()).resolves.toMatchObject({ alreadyCheckedIn: false, name: "Attendee", success: true });
  });

  it("returns a successful idempotent retry", async () => {
    mocks.rpc.mockResolvedValue({ data: [{ checked_in_at: "2026-07-23T15:00:00.000Z", registration_id: "registration-1", result_status: "already_checked_in" }], error: null });
    const response = await POST(request(), { params: Promise.resolve({ eventId: "event-1" }) });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ alreadyCheckedIn: true, success: true });
  });

  it("does not check in a waitlisted registration", async () => {
    mocks.rpc.mockResolvedValue({ data: [{ checked_in_at: null, registration_id: "registration-1", result_status: "waitlisted" }], error: null });
    const response = await POST(request("WAIT1234"), { params: Promise.resolve({ eventId: "event-1" }) });
    expect(response.status).toBe(409);
    expect(mocks.createAdminClient().from).not.toHaveBeenCalled();
  });
});
