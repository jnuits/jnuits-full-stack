import { afterEach, describe, expect, it, vi } from "vitest";
import { RATE_LIMITS } from "@/lib/security/rate-limit";

const captchaMocks = vi.hoisted(() => ({
  isCaptchaConfigured: vi.fn(),
  isCaptchaRequired: vi.fn(),
  verifyCaptchaToken: vi.fn(),
}));

vi.mock("@/lib/security/captcha", () => captchaMocks);

import {
  enforceAuthActionProtection,
  shouldAttemptPostClaimAutoLogin,
} from "./action-protection";

function headers(ip = "203.0.113.10") {
  return new Headers({ "x-forwarded-for": ip });
}

describe("auth action protection", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("lets Supabase-consumed flows forward a non-empty token without local verification", async () => {
    captchaMocks.isCaptchaRequired.mockReturnValue(true);
    captchaMocks.isCaptchaConfigured.mockReturnValue(true);

    await expect(
      enforceAuthActionProtection({
        captchaToken: "turnstile-token",
        captchaValidation: "supabase",
        email: "member@example.com",
        rateLimit: RATE_LIMITS.authLogin,
        rateLimitPrefix: `test-auth-login-${crypto.randomUUID()}`,
        requestHeaders: headers(),
      })
    ).resolves.toBeNull();

    expect(captchaMocks.verifyCaptchaToken).not.toHaveBeenCalled();
  });

  it("directly verifies Turnstile for protected claim mutations", async () => {
    captchaMocks.isCaptchaRequired.mockReturnValue(true);
    captchaMocks.isCaptchaConfigured.mockReturnValue(true);
    captchaMocks.verifyCaptchaToken.mockResolvedValue({ error: null, ok: true });

    await expect(
      enforceAuthActionProtection({
        captchaToken: "turnstile-token",
        captchaValidation: "turnstile",
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
        captchaValidation: "turnstile",
        email: "member@example.com",
        rateLimit: RATE_LIMITS.authRegister,
        rateLimitPrefix: `test-auth-claim-fail-${crypto.randomUUID()}`,
        requestHeaders: headers(),
      })
    ).resolves.toBe("CAPTCHA verification failed.");
  });

  it("does not attempt post-claim auto-login when CAPTCHA is required", () => {
    captchaMocks.isCaptchaRequired.mockReturnValue(true);

    expect(shouldAttemptPostClaimAutoLogin()).toBe(false);
  });
});