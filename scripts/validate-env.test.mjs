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
  APP_MAC_SECRET: "12345678901234567890123456789012",
  AUTH_CAPTCHA_REQUIRED: "true",
  CLOUDINARY_API_KEY: "cloudinary-api-key",
  CLOUDINARY_API_SECRET: "cloudinary-api-secret",
  CLOUDINARY_CLOUD_NAME: "jnuits-test",
  GOOGLE_DRIVE_EXPORTS_FOLDER_ID: "exports-folder-id",
  GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL: "ci@example.test",
  GOOGLE_DRIVE_SERVICE_ACCOUNT_PRIVATE_KEY: "test-private-key",
  GOOGLE_DRIVE_SHARED_DRIVE_ID: "shared-drive-id",
  NEXT_PUBLIC_SENTRY_DSN: "https://public@example.ingest.sentry.io/123",
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: "turnstile-site",
  RATE_LIMIT_BACKEND: "supabase",
  RATE_LIMIT_SECRET_SALT: "12345678901234567890123456789012",
  RESEND_API_KEY: "re_test_api_key",
  RESEND_FROM_EMAIL: "JnUITS <no-reply@example.test>",
  RESEND_WEBHOOK_SECRET: "whsec_test_webhook_secret",
  RETENTION_MANIFEST_SIGNING_SECRET: "test-retention-signing-secret",
  TURNSTILE_SECRET_KEY: "turnstile-secret",
};

describe("validateEnv", () => {
  afterEach(() => vi.restoreAllMocks());

  it("reports all missing base variables", () => {
    expect(validateEnv({}, { production: false }).missing).toEqual([
      "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SECRET_KEY", "APP_BASE_URL",
    ]);
  });

  it("requires complete production delivery, media, archive, telemetry, and CAPTCHA configuration", () => {
    const result = validateEnv({ ...baseEnv, NEXT_PUBLIC_TURNSTILE_SITE_KEY: "site", RATE_LIMIT_BACKEND: "supabase", RATE_LIMIT_SECRET_SALT: "1".repeat(32), TURNSTILE_SECRET_KEY: "secret" }, { production: true });
    expect(result.missing).toEqual(expect.arrayContaining([
      "AUTH_CAPTCHA_REQUIRED", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET", "CLOUDINARY_CLOUD_NAME",
      "GOOGLE_DRIVE_EXPORTS_FOLDER_ID", "GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL", "GOOGLE_DRIVE_SERVICE_ACCOUNT_PRIVATE_KEY",
      "GOOGLE_DRIVE_SHARED_DRIVE_ID", "NEXT_PUBLIC_SENTRY_DSN", "RESEND_API_KEY", "RESEND_FROM_EMAIL",
      "RESEND_WEBHOOK_SECRET", "RETENTION_MANIFEST_SIGNING_SECRET", "APP_MAC_SECRET",
    ]));
  });

  it("requires a dedicated application MAC secret of at least 32 characters in production", () => {
    const missing = validateEnv(
      { ...completeProductionEnv, APP_MAC_SECRET: "" },
      { production: true },
    );
    expect(missing.missing).toContain("APP_MAC_SECRET");

    const short = validateEnv(
      { ...completeProductionEnv, APP_MAC_SECRET: "too-short" },
      { production: true },
    );
    expect(short.invalid).toContain(
      "APP_MAC_SECRET must be at least 32 characters.",
    );
  });

  it("rejects disabled CAPTCHA, malformed service email, malformed sender, and public secrets", () => {
    const result = validateEnv({
      ...completeProductionEnv,
      AUTH_CAPTCHA_REQUIRED: "false",
      GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL: "not-email",
      NEXT_PUBLIC_CLOUDINARY_API_SECRET: "leaked",
      RESEND_FROM_EMAIL: "not-email",
    }, { production: true });
    expect(result.invalid).toEqual(expect.arrayContaining([
      "AUTH_CAPTCHA_REQUIRED must be explicitly enabled for production builds.",
      "GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL must be a valid email address.",
      "NEXT_PUBLIC_CLOUDINARY_API_SECRET must not expose secret configuration to the browser.",
      "RESEND_FROM_EMAIL must include a valid sender email address.",
    ]));
    expect(JSON.stringify(result)).not.toContain("leaked");
  });

  it("accepts both bare and display-name production sender addresses", () => {
    for (const sender of [
      "no-reply@jnuits.org.bd",
      "  no-reply@jnuits.org.bd  ",
      "JnUITS Notifications <no-reply@jnuits.org.bd>",
    ]) {
      expect(validateEnv({ ...completeProductionEnv, RESEND_FROM_EMAIL: sender }, { production: true }))
        .toEqual({ invalid: [], missing: [], ok: true });
    }
  });

  it("still rejects senders without a usable address", () => {
    for (const sender of ["JnUITS", "JnUITS <not-an-address>", "no-reply@localhost", "a b@example.test"]) {
      expect(validateEnv({ ...completeProductionEnv, RESEND_FROM_EMAIL: sender }, { production: true }).invalid)
        .toContain("RESEND_FROM_EMAIL must include a valid sender email address.");
    }
  });

  it("rejects browser variables whose names imply secret material", () => {
    const leaks = {
      NEXT_PUBLIC_GOOGLE_CREDENTIALS: "leak-credentials",
      NEXT_PUBLIC_RETENTION_SIGNING_SECRET: "leak-signing",
      NEXT_PUBLIC_SERVICE_ACCOUNT_PRIVATE_KEY: "leak-private-key",
    };
    const result = validateEnv({ ...completeProductionEnv, ...leaks }, { production: true });
    expect(result.invalid).toEqual(expect.arrayContaining(
      Object.keys(leaks).map((name) => `${name} must not expose secret configuration to the browser.`)
    ));
    for (const value of Object.values(leaks)) {
      expect(JSON.stringify(result)).not.toContain(value);
    }
  });

  it("keeps legitimate browser keys permitted", () => {
    expect(validateEnv({
      ...completeProductionEnv,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: "turnstile-site",
    }, { production: true }).ok).toBe(true);
  });

  it("requires Supabase rate limiting and valid HTTPS URLs in production", () => {
    const result = validateEnv({ ...completeProductionEnv, APP_BASE_URL: "http://localhost:3000", NEXT_PUBLIC_SENTRY_DSN: "not-url", RATE_LIMIT_BACKEND: "memory" }, { production: true });
    expect(result.invalid).toEqual(expect.arrayContaining([
      "APP_BASE_URL must be a valid https URL.",
      "NEXT_PUBLIC_SENTRY_DSN must be a valid https URL.",
      "RATE_LIMIT_BACKEND must be set to 'supabase' for production builds.",
    ]));
  });

  it("accepts a complete production environment", () => {
    expect(validateEnv(completeProductionEnv, { production: true })).toEqual({ invalid: [], missing: [], ok: true });
  });

  it("CLI errors name variables but never their values", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const exitCode = runValidateEnvCli(["node", "scripts/validate-env.mjs", "--production"], { NEXT_PUBLIC_CLOUDINARY_API_SECRET: "do-not-print" });
    expect(exitCode).toBe(1);
    expect(errorSpy.mock.calls[0]?.[0]).toContain("NEXT_PUBLIC_SUPABASE_URL");
    expect(errorSpy.mock.calls[0]?.[0]).not.toContain("do-not-print");
  });
});
