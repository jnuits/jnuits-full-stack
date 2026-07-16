import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  requireAdminApiPermission: vi.fn(),
  resolveEventForAdminMutation: vi.fn(),
}));

vi.mock("@/lib/admin/api-auth", () => ({
  requireAdminApiPermission: mocks.requireAdminApiPermission,
}));

vi.mock("@/lib/content/events", () => ({
  resolveEventForAdminMutation: mocks.resolveEventForAdminMutation,
}));

vi.mock("@/lib/security/with-api-guard", () => ({
  withApiGuard: <T>(handler: T) => handler,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}));

import { POST } from "./route";

describe("event check-in route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdminApiPermission.mockResolvedValue({
      auth: { user: { id: "operator-1" } },
    });
    mocks.resolveEventForAdminMutation.mockResolvedValue({
      id: "event-1",
      legacyContentPostId: null,
    });

    const registrationQuery = {
      eq: vi.fn(),
      limit: vi.fn(),
      maybeSingle: vi.fn(),
      or: vi.fn(),
      select: vi.fn(),
    };

    registrationQuery.select.mockReturnValue(registrationQuery);
    registrationQuery.eq.mockReturnValue(registrationQuery);
    registrationQuery.limit.mockReturnValue(registrationQuery);
    registrationQuery.maybeSingle.mockResolvedValue({
      data: {
        cancelled_at: null,
        checked_in_at: null,
        id: "registration-1",
        registration_status: "waitlisted",
        registrant_email: "waitlisted@example.test",
        registrant_name: "Waitlisted Attendee",
      },
      error: null,
    });

    mocks.createAdminClient.mockReturnValue({
      from: vi.fn(() => registrationQuery),
    });
  });

  it("does not turn a waitlisted reference into a checked-in attendee", async () => {
    const request = new NextRequest(
      "https://jnuits.org.bd/api/admin/events/event-1/checkin",
      {
        body: JSON.stringify({ code: "WAITLIST1" }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      }
    );

    const response = await POST(request, {
      params: Promise.resolve({ eventId: "event-1" }),
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "This registration is still on the waitlist.",
      waitlisted: true,
    });
  });
});
