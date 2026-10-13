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
    vi.stubEnv("AUTH_CAPTCHA_REQUIRED", "false");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "publishable-key");
    vi.stubEnv("SUPABASE_SECRET_KEY", "server-only-key");
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

  it("verifies a signed-in user's password without public CAPTCHA in production", async () => {
    vi.stubEnv("AUTH_CAPTCHA_REQUIRED", "true");
    vi.stubEnv("VERCEL_ENV", "production");
    routeMocks.checkRateLimitForApi.mockResolvedValue({ success: true });
    const signInWithPassword = vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    const signOut = vi.fn().mockResolvedValue({ error: null });
    routeMocks.createSupabaseClient.mockReturnValue({ auth: { signInWithPassword, signOut } });

    const response = await POST(postRequest({ currentPassword: "password123", email: "another@example.test" }), { params: Promise.resolve({}) });

    expect(response.status).toBe(200);
    expect(routeMocks.createSupabaseClient).toHaveBeenCalledWith("https://project.supabase.co", "server-only-key", {
      auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
    });
    expect(signInWithPassword).toHaveBeenCalledWith({ email: "member@example.test", password: "password123" });
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    await expect(response.json()).resolves.toMatchObject({ verified: true });
  });

  it("rejects an expired session before creating a trusted password client", async () => {
    routeMocks.getAuthContext.mockResolvedValue({ user: null });
    const response = await POST(postRequest(), { params: Promise.resolve({}) });
    expect(response.status).toBe(401);
    expect(routeMocks.createSupabaseClient).not.toHaveBeenCalled();
  });

  it("never unlocks another identity and closes the temporary session", async () => {
    routeMocks.checkRateLimitForApi.mockResolvedValue({ success: true });
    const signOut = vi.fn().mockResolvedValue({ error: null });
    routeMocks.createSupabaseClient.mockReturnValue({ auth: {
      signInWithPassword: vi.fn().mockResolvedValue({ data: { user: { id: "another-user" } }, error: null }), signOut,
    }});
    const response = await POST(postRequest(), { params: Promise.resolve({}) });
    expect(response.status).toBe(403);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
  });
  it("rejects cross-origin requests before creating the password client", async () => {
    const attempted = postRequest(); attempted.headers.set("origin", "https://other.invalid");
    const response = await POST(attempted, { params: Promise.resolve({}) });
    expect(response.status).toBe(403);
    expect(routeMocks.createSupabaseClient).not.toHaveBeenCalled();
  });
});
