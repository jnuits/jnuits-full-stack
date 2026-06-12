import { describe, expect, it } from "vitest";
import { validateEnv } from "./validate-env.mjs";

const baseEnv = {
  APP_BASE_URL: "https://jnuits.org.bd",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SECRET_KEY: "sb_secret_test",
};

describe("validateEnv", () => {
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

  it("accepts a complete production environment", () => {
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

    expect(result).toEqual({ invalid: [], missing: [], ok: true });
  });
});
