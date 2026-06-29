import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getAuthCaptchaUiConfig,
  isCaptchaRequired,
  verifyCaptchaToken,
} from "@/lib/security/captcha";

describe("captcha configuration", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("can disable auth captcha outside deployed production", () => {
    vi.stubEnv("AUTH_CAPTCHA_REQUIRED", "false");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");

    expect(isCaptchaRequired()).toBe(false);
    expect(getAuthCaptchaUiConfig()).toEqual({
      required: false,
      siteKey: "",
    });
  });

  it("keeps captcha required in Vercel production even if disabled by env", () => {
    vi.stubEnv("AUTH_CAPTCHA_REQUIRED", "false");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "site-key");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");

    expect(isCaptchaRequired()).toBe(true);
    expect(getAuthCaptchaUiConfig()).toEqual({
      required: true,
      siteKey: "site-key",
    });
  });


  it("keeps captcha required for hosted Supabase even when local override is disabled", () => {
    vi.stubEnv("AUTH_CAPTCHA_REQUIRED", "false");
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("VERCEL_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project-ref.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "site-key");

    expect(isCaptchaRequired()).toBe(true);
    expect(getAuthCaptchaUiConfig()).toEqual({
      required: true,
      siteKey: "site-key",
    });
  });
  it("does not call Turnstile verification when captcha is locally disabled", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("AUTH_CAPTCHA_REQUIRED", "false");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "site-key");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://localhost:54321");
    vi.stubEnv("TURNSTILE_SECRET_KEY", "secret-key");

    await expect(verifyCaptchaToken("")).resolves.toEqual({
      error: null,
      ok: true,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
