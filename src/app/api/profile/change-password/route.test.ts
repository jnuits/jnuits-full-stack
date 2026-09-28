import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const routeMocks = vi.hoisted(() => ({
  checkRateLimitForApi: vi.fn(),
  createSupabaseClient: vi.fn(),
  getAuthContext: vi.fn(),
  getPasswordExposureError: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthContext: routeMocks.getAuthContext,
}));

vi.mock("@/lib/security/rate-limit", () => ({
  checkRateLimitForApi: routeMocks.checkRateLimitForApi,
  getRequestIp: vi.fn(() => "127.0.0.1"),
  RATE_LIMITS: {
    profileStepUp: { limit: 3, windowSeconds: 600 },
  },
}));

vi.mock("@/lib/security/pwned-passwords", () => ({
  getPasswordExposureError: routeMocks.getPasswordExposureError,
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: routeMocks.createSupabaseClient,
}));

import { POST } from "./route";

function request(overrides: Record<string, string> = {}) {
  return new NextRequest("https://jnuits.org.bd/api/profile/change-password", {
    body: JSON.stringify({
      captchaToken: "",
      confirmPassword: "River-Cedar-Glass-2046!",
      currentPassword: "Current-pass-2046!",
      password: "River-Cedar-Glass-2046!",
      ...overrides,
    }),
    headers: { origin: "https://jnuits.org.bd" },
    method: "POST",
  });
}

describe("profile password-change route", () => {
  beforeEach(() => {
    vi.stubEnv("APP_BASE_URL", "https://jnuits.org.bd");
    vi.stubEnv("AUTH_CAPTCHA_REQUIRED", "false");
    vi.stubEnv("APP_MAC_SECRET", "test-mac-key");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "publishable-key");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
    routeMocks.getAuthContext.mockResolvedValue({
      user: { email: "member@example.test", id: "user-1" },
    });
    routeMocks.checkRateLimitForApi.mockResolvedValue({
      remaining: 2,
      resetAt: Date.now() + 60_000,
      success: true,
    });
    routeMocks.getPasswordExposureError.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("verifies the current password and updates through the same fresh session", async () => {
    const signInWithPassword = vi.fn().mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    const updateUser = vi.fn().mockResolvedValue({ error: null });
    const signOut = vi.fn().mockResolvedValue({ error: null });
    routeMocks.createSupabaseClient.mockReturnValue({
      auth: { signInWithPassword, signOut, updateUser },
    });

    const response = await POST(request(), { params: Promise.resolve({}) });

    expect(response.status).toBe(200);
    expect(signInWithPassword).toHaveBeenCalledWith({
      email: "member@example.test",
      password: "Current-pass-2046!",
    });
    expect(updateUser).toHaveBeenCalledWith({
      current_password: "Current-pass-2046!",
      password: "River-Cedar-Glass-2046!",
    });
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
    await expect(response.json()).resolves.toMatchObject({
      message: "Password updated successfully.",
    });
  });

  it("never attempts the update when the current password is wrong", async () => {
    const updateUser = vi.fn();
    routeMocks.createSupabaseClient.mockReturnValue({
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({
          data: { user: null },
          error: new Error("Invalid login credentials"),
        }),
        signOut: vi.fn(),
        updateUser,
      },
    });

    const response = await POST(request(), { params: Promise.resolve({}) });

    expect(response.status).toBe(403);
    expect(updateUser).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({
      message: "Current password is incorrect.",
    });
  });
});
