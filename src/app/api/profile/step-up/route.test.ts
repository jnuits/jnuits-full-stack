import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const routeMocks = vi.hoisted(() => ({
  checkRateLimitForApi: vi.fn(),
  getAuthContext: vi.fn(),
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

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(),
}));

import { RATE_LIMITS } from "@/lib/security/rate-limit";
import { POST } from "./route";

function postRequest() {
  return new NextRequest("https://jnuits.org.bd/api/profile/step-up", {
    body: JSON.stringify({ currentPassword: "password123" }),
    headers: { origin: "https://jnuits.org.bd" },
    method: "POST",
  });
}

describe("profile step-up route", () => {
  beforeEach(() => {
    vi.stubEnv("APP_BASE_URL", "https://jnuits.org.bd");
    routeMocks.getAuthContext.mockResolvedValue({
      roles: ["member"],
      user: { email: "member@example.test", id: "user-1" },
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

  it("uses the durable API limiter before password verification", async () => {
    const response = await POST(postRequest(), {
      params: Promise.resolve({}),
    });

    expect(routeMocks.checkRateLimitForApi).toHaveBeenCalledWith(
      "step-up:user-1",
      RATE_LIMITS.profileStepUp
    );
    expect(response.status).toBe(429);
  });
});
