import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const routeMocks = vi.hoisted(() => ({
  checkRateLimitForApi: vi.fn(),
  createSupabaseClient: vi.fn(),
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
  createClient: routeMocks.createSupabaseClient,
}));

import { RATE_LIMITS } from "@/lib/security/rate-limit";
import { POST } from "./route";

function postRequest(body: Record<string, string> = {
  currentPassword: "password123",
}) {
  return new NextRequest("https://jnuits.org.bd/api/profile/step-up", {
    body: JSON.stringify(body),
    headers: { origin: "https://jnuits.org.bd" },
    method: "POST",
  });
}

describe("profile step-up route", () => {
  beforeEach(() => {
    vi.stubEnv("APP_BASE_URL", "https://jnuits.org.bd");
    vi.stubEnv("APP_MAC_SECRET", "test-mac-key");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "publishable-key");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
    routeMocks.getAuthContext.mockResolvedValue({
      roles: ["member"],
      user: { email: "member@example.test", id: "user-1" },
    });
    routeMocks.checkRateLimitForApi.mockResolvedValue({
      remaining: 0,
      resetAt: Date.now() + 60_000,
      success: false,
    });
    routeMocks.createSupabaseClient.mockReset();
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

  it("requires a CAPTCHA token when password sign-in protection is enabled", async () => {
    vi.stubEnv("AUTH_CAPTCHA_REQUIRED", "true");
    vi.stubEnv("VERCEL_ENV", "production");
    routeMocks.checkRateLimitForApi.mockResolvedValue({
      remaining: 2,
      resetAt: Date.now() + 60_000,
      success: true,
    });

    const response = await POST(postRequest(), {
      params: Promise.resolve({}),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      message: "Complete the verification challenge.",
    });
    expect(routeMocks.createSupabaseClient).not.toHaveBeenCalled();
  });

  it("passes the CAPTCHA token to Supabase password verification", async () => {
    vi.stubEnv("AUTH_CAPTCHA_REQUIRED", "true");
    routeMocks.checkRateLimitForApi.mockResolvedValue({
      remaining: 2,
      resetAt: Date.now() + 60_000,
      success: true,
    });
    const signInWithPassword = vi.fn().mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    routeMocks.createSupabaseClient.mockReturnValue({
      auth: {
        signInWithPassword,
        signOut: vi.fn().mockResolvedValue({ error: null }),
      },
    });

    const response = await POST(
      postRequest({
        captchaToken: "captcha-token",
        currentPassword: "password123",
      }),
      { params: Promise.resolve({}) },
    );

    expect(response.status).toBe(200);
    expect(signInWithPassword).toHaveBeenCalledWith({
      email: "member@example.test",
      options: { captchaToken: "captcha-token" },
      password: "password123",
    });
  });
});
