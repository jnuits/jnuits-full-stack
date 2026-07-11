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

  it("honors an explicit local or preview disable override", () => {
    vi.stubEnv("AUTH_CAPTCHA_REQUIRED", "false");
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project-ref.supabase.co");

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

    expect(isCaptchaRequired()).toBe(true);
    expect(getAuthCaptchaUiConfig()).toEqual({
      required: true,
      siteKey: "site-key",
    });
  });

  it("requires captcha unless a non-production environment explicitly disables it", () => {
    vi.stubEnv("AUTH_CAPTCHA_REQUIRED", "true");
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("VERCEL_ENV", "development");

    expect(isCaptchaRequired()).toBe(true);
  });

  it("does not call Turnstile verification when captcha is explicitly disabled", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("AUTH_CAPTCHA_REQUIRED", "false");
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("VERCEL_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project-ref.supabase.co");
    vi.stubEnv("TURNSTILE_SECRET_KEY", "secret-key");

    await expect(verifyCaptchaToken("")).resolves.toEqual({
      error: null,
      ok: true,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});