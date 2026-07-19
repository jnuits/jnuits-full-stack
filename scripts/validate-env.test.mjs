import { afterEach, describe, expect, it, vi } from "vitest";
import { runValidateEnvCli, validateEnv } from "./validate-env.mjs";

const baseEnv = {
  APP_BASE_URL: "https://jnuits.org.bd",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SECRET_KEY: "sb_secret_test",
};

const completeProductionEnv = {
  ...baseEnv,
  AUTH_CAPTCHA_REQUIRED: "true",
  CLOUDINARY_API_KEY: "cloudinary-api-key",
  CLOUDINARY_API_SECRET: "cloudinary-api-secret",
  CLOUDINARY_CLOUD_NAME: "jnuits-test",
  NEXT_PUBLIC_SENTRY_DSN: "https://public@example.ingest.sentry.io/123",
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: "turnstile-site",
  RATE_LIMIT_BACKEND: "supabase",
  RATE_LIMIT_SECRET_SALT: "12345678901234567890123456789012",
  RESEND_API_KEY: "re_test_api_key",
  RESEND_FROM_EMAIL: "JnUITS <no-reply@example.test>",
  RESEND_WEBHOOK_SECRET: "whsec_test_webhook_secret",
  TURNSTILE_SECRET_KEY: "turnstile-secret",
};

describe("validateEnv", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reports all missing base variables", () => {
    const result = validateEnv({}, { production: false });

    expect(result.ok).toBe(false);
    expect(result.missing).toEqual([
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      "SUPABASE_SECRET_KEY",
      "APP_BASE_URL",
    ]);
  });

  it("requires Supabase-backed rate limiting in production", () => {
    const result = validateEnv(
      {
        ...baseEnv,
        NEXT_PUBLIC_TURNSTILE_SITE_KEY: "turnstile-site",
        RATE_LIMIT_BACKEND: "memory",
        RATE_LIMIT_SECRET_SALT: "12345678901234567890123456789012",
        TURNSTILE_SECRET_KEY: "turnstile-secret",
      },
      { production: true }
    );

    expect(result.ok).toBe(false);
    expect(result.invalid).toContain(
      "RATE_LIMIT_BACKEND must be set to 'supabase' for production builds."
    );
  });

  it("requires delivery, media, telemetry, and explicit CAPTCHA production configuration", () => {
    const result = validateEnv(
      {
        ...baseEnv,
        NEXT_PUBLIC_TURNSTILE_SITE_KEY: "turnstile-site",
        RATE_LIMIT_BACKEND: "supabase",
        RATE_LIMIT_SECRET_SALT: "12345678901234567890123456789012",
        TURNSTILE_SECRET_KEY: "turnstile-secret",
      },
      { production: true }
    );

    expect(result.missing).toEqual(
      expect.arrayContaining([
        "AUTH_CAPTCHA_REQUIRED",
        "CLOUDINARY_API_KEY",
        "CLOUDINARY_API_SECRET",
        "CLOUDINARY_CLOUD_NAME",
        "NEXT_PUBLIC_SENTRY_DSN",
        "RESEND_API_KEY",
        "RESEND_FROM_EMAIL",
        "RESEND_WEBHOOK_SECRET",
      ])
    );
  });

  it("rejects disabled CAPTCHA and malformed public Sentry DSNs in production", () => {
    const disabledCaptcha = validateEnv(
      { ...completeProductionEnv, AUTH_CAPTCHA_REQUIRED: "false" },
      { production: true }
    );
    const malformedDsn = validateEnv(
      { ...completeProductionEnv, NEXT_PUBLIC_SENTRY_DSN: "not-a-url" },
      { production: true }
    );

    expect(disabledCaptcha.invalid).toContain(
      "AUTH_CAPTCHA_REQUIRED must be explicitly enabled for production builds."
    );
    expect(malformedDsn.invalid).toContain(
      "NEXT_PUBLIC_SENTRY_DSN must be a valid https URL."
    );
  });

  it("accepts a complete production environment", () => {
    const result = validateEnv(completeProductionEnv, { production: true });

    expect(result).toEqual({ invalid: [], missing: [], ok: true });
  });

  it("CLI validation reports missing production env without import errors", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const exitCode = runValidateEnvCli(["node", "scripts/validate-env.mjs", "--production"], {});

    expect(exitCode).toBe(1);
    expect(errorSpy.mock.calls[0]?.[0]).toContain("Environment validation failed.");
    expect(errorSpy.mock.calls[0]?.[0]).toContain("NEXT_PUBLIC_SUPABASE_URL");
  });
});
