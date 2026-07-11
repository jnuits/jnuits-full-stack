import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RATE_LIMITS } from "@/lib/security/rate-limit";

const captchaMocks = vi.hoisted(() => ({
  isCaptchaConfigured: vi.fn(),
  isCaptchaRequired: vi.fn(),
  verifyCaptchaToken: vi.fn(),
}));

const rateLimitMocks = vi.hoisted(() => ({
  checkRateLimitForApi: vi.fn(),
}));

vi.mock("@/lib/security/captcha", () => captchaMocks);
vi.mock("@/lib/security/rate-limit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/security/rate-limit")>();

  return {
    ...actual,
    checkRateLimitForApi: rateLimitMocks.checkRateLimitForApi,
  };
});

import {
  AUTH_ACTION_CAPTCHA_MODES,
  enforceAuthActionProtection,
  shouldAttemptPostClaimAutoLogin,
} from "./action-protection";

function headers(ip = "203.0.113.10") {
  return new Headers({ "x-forwarded-for": ip });
}

describe("auth action protection", () => {
  beforeEach(() => {
    rateLimitMocks.checkRateLimitForApi.mockResolvedValue({
      remaining: 4,
      resetAt: Date.now() + 60_000,
      success: true,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("lets Supabase-consumed flows forward a non-empty token without local verification", async () => {
    captchaMocks.isCaptchaRequired.mockReturnValue(true);
    captchaMocks.isCaptchaConfigured.mockReturnValue(true);

    await expect(
      enforceAuthActionProtection({
        captchaToken: "turnstile-token",
        captchaValidation: AUTH_ACTION_CAPTCHA_MODES.passwordSignIn,
        email: "member@example.com",
        rateLimit: RATE_LIMITS.authLogin,
        rateLimitPrefix: `test-auth-login-${crypto.randomUUID()}`,
        requestHeaders: headers(),
      })
    ).resolves.toBeNull();

    expect(captchaMocks.verifyCaptchaToken).not.toHaveBeenCalled();
    expect(rateLimitMocks.checkRateLimitForApi).toHaveBeenCalledWith(
      expect.stringContaining("test-auth-login-"),
      RATE_LIMITS.authLogin
    );
  });

  it("directly verifies Turnstile for protected claim mutations", async () => {
    captchaMocks.isCaptchaRequired.mockReturnValue(true);
    captchaMocks.isCaptchaConfigured.mockReturnValue(true);
    captchaMocks.verifyCaptchaToken.mockResolvedValue({ error: null, ok: true });

    await expect(
      enforceAuthActionProtection({
        captchaToken: "turnstile-token",
        captchaValidation: AUTH_ACTION_CAPTCHA_MODES.memberClaim,
        email: "member@example.com",
        rateLimit: RATE_LIMITS.authRegister,
        rateLimitPrefix: `test-auth-claim-${crypto.randomUUID()}`,
        requestHeaders: headers("198.51.100.7"),
      })
    ).resolves.toBeNull();

    expect(captchaMocks.verifyCaptchaToken).toHaveBeenCalledWith(
      "turnstile-token",
      "198.51.100.7"
    );
  });

  it("rejects invalid direct Turnstile verification before mutation", async () => {
    captchaMocks.isCaptchaRequired.mockReturnValue(true);
    captchaMocks.isCaptchaConfigured.mockReturnValue(true);
    captchaMocks.verifyCaptchaToken.mockResolvedValue({
      error: "CAPTCHA verification failed.",
      ok: false,
    });

    await expect(
      enforceAuthActionProtection({
        captchaToken: "random-string",
        captchaValidation: AUTH_ACTION_CAPTCHA_MODES.memberClaim,
        email: "member@example.com",
        rateLimit: RATE_LIMITS.authRegister,
        rateLimitPrefix: `test-auth-claim-fail-${crypto.randomUUID()}`,
        requestHeaders: headers(),
      })
    ).resolves.toBe("CAPTCHA verification failed.");
  });

  it("documents the intended CAPTCHA validation mode for each auth action", () => {
    expect(AUTH_ACTION_CAPTCHA_MODES).toEqual({
      memberClaim: "turnstile",
      passwordReset: "supabase",
      passwordSignIn: "supabase",
      signupConfirmationResend: "supabase",
    });
  });

  it("does not attempt post-claim auto-login when CAPTCHA is required", () => {
    captchaMocks.isCaptchaRequired.mockReturnValue(true);

    expect(shouldAttemptPostClaimAutoLogin()).toBe(false);
  });
});
