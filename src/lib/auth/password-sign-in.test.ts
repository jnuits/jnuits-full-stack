import { afterEach, describe, expect, it, vi } from "vitest";
import { buildPasswordSignInPayload } from "@/lib/auth/password-sign-in";

describe("buildPasswordSignInPayload", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("omits Supabase CAPTCHA options when non-production CAPTCHA is explicitly disabled", () => {
    vi.stubEnv("AUTH_CAPTCHA_REQUIRED", "false");
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("VERCEL_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project-ref.supabase.co");

    expect(
      buildPasswordSignInPayload({
        captchaToken: "",
        email: "member@example.com",
        password: "password",
      })
    ).toEqual({
      email: "member@example.com",
      password: "password",
    });
  });

  it("includes the CAPTCHA token when local or preview CAPTCHA is enabled", () => {
    vi.stubEnv("AUTH_CAPTCHA_REQUIRED", "true");
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("VERCEL_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project-ref.supabase.co");

    expect(
      buildPasswordSignInPayload({
        captchaToken: " token-value ",
        email: "member@example.com",
        password: "password",
      })
    ).toEqual({
      email: "member@example.com",
      options: {
        captchaToken: "token-value",
      },
      password: "password",
    });
  });

  it("includes the CAPTCHA token when deployed production requires CAPTCHA", () => {
    vi.stubEnv("AUTH_CAPTCHA_REQUIRED", "false");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project-ref.supabase.co");

    expect(
      buildPasswordSignInPayload({
        captchaToken: " token-value ",
        email: "admin@example.com",
        password: "password",
      })
    ).toEqual({
      email: "admin@example.com",
      options: {
        captchaToken: "token-value",
      },
      password: "password",
    });
  });
});