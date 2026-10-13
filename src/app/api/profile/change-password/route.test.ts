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
    vi.stubEnv("SUPABASE_SECRET_KEY", "server-only-key");
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
    routeMocks.createSupabaseClient.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("verifies and updates through a fresh user session without private-dashboard CAPTCHA", async () => {
    vi.stubEnv("AUTH_CAPTCHA_REQUIRED", "true");
    vi.stubEnv("VERCEL_ENV", "production");
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
    expect(routeMocks.createSupabaseClient).toHaveBeenCalledWith("https://project.supabase.co", "server-only-key", {
      auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
    });
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
  it("rejects an expired session before privileged verification", async () => {
    routeMocks.getAuthContext.mockResolvedValue({ user: null });
    routeMocks.createSupabaseClient.mockReset();
    const response = await POST(request(), { params: Promise.resolve({}) });
    expect(response.status).toBe(401);
    expect(routeMocks.createSupabaseClient).not.toHaveBeenCalled();
  });
  it("ignores a body email and never updates another authenticated identity", async () => {
    const signInWithPassword = vi.fn().mockResolvedValue({ data: { user: { id: "another-user" } }, error: null });
    const signOut = vi.fn().mockResolvedValue({ error: null });
    const updateUser = vi.fn();
    routeMocks.createSupabaseClient.mockReturnValue({ auth: { signInWithPassword, signOut, updateUser } });
    const response = await POST(request({ email: "another@example.test" }), { params: Promise.resolve({}) });
    expect(response.status).toBe(403);
    expect(signInWithPassword).toHaveBeenCalledWith({ email: "member@example.test", password: "Current-pass-2046!" });
    expect(updateUser).not.toHaveBeenCalled();
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
  });
  it("enforces the durable limiter before trusted verification", async () => {
    routeMocks.checkRateLimitForApi.mockResolvedValue({ success: false, resetAt: Date.now() + 60_000 });
    const response = await POST(request(), { params: Promise.resolve({}) });
    expect(response.status).toBe(429);
    expect(routeMocks.createSupabaseClient).not.toHaveBeenCalled();
  });
  it("rejects cross-origin requests before password verification", async () => {
    const attempted = request(); attempted.headers.set("origin", "https://other.invalid");
    const response = await POST(attempted, { params: Promise.resolve({}) });
    expect(response.status).toBe(403);
    expect(routeMocks.createSupabaseClient).not.toHaveBeenCalled();
  });
});
