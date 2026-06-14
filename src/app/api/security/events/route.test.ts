import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const routeMocks = vi.hoisted(() => ({
  checkRateLimitForApi: vi.fn(),
  getAuthContext: vi.fn(),
  recordSecurityEvent: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthContext: routeMocks.getAuthContext,
}));

vi.mock("@/lib/security/rate-limit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/security/rate-limit")>();

  return {
    ...actual,
    checkRateLimitForApi: routeMocks.checkRateLimitForApi,
  };
});

vi.mock("@/lib/security/security-events", () => ({
  recordSecurityEvent: routeMocks.recordSecurityEvent,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({})),
}));

import { RATE_LIMITS } from "@/lib/security/rate-limit";
import { POST } from "./route";

function postRequest() {
  return new NextRequest("https://jnuits.org.bd/api/security/events", {
    body: JSON.stringify({
      eventType: "auth.reauthentication_requested",
      payload: {},
    }),
    headers: {
      origin: "https://jnuits.org.bd",
      "x-forwarded-for": "203.0.113.7",
    },
    method: "POST",
  });
}

describe("client security event route", () => {
  beforeEach(() => {
    vi.stubEnv("APP_BASE_URL", "https://jnuits.org.bd");
    routeMocks.getAuthContext.mockResolvedValue({
      roles: ["member"],
      user: { id: "user-1" },
    });
    routeMocks.checkRateLimitForApi.mockResolvedValue({
      remaining: 0,
      resetAt: Date.now() + 60_000,
      success: false,
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("uses the durable API limiter with a user and IP scoped key", async () => {
    const response = await POST(postRequest(), {
      params: Promise.resolve({}),
    });

    expect(routeMocks.checkRateLimitForApi).toHaveBeenCalledWith(
      "security-event:user-1:203.0.113.7",
      RATE_LIMITS.securityEvent
    );
    expect(routeMocks.recordSecurityEvent).not.toHaveBeenCalled();
    expect(response.status).toBe(429);
  });
});
