import { afterEach, describe, expect, it, vi } from "vitest";
import { buildPasswordSignInPayload } from "@/lib/auth/password-sign-in";

describe("buildPasswordSignInPayload", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("omits Supabase CAPTCHA options when local auth CAPTCHA is disabled", () => {
    vi.stubEnv("AUTH_CAPTCHA_REQUIRED", "false");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");

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


  it("includes the CAPTCHA token when a hosted Supabase project is used locally", () => {
    vi.stubEnv("AUTH_CAPTCHA_REQUIRED", "false");
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
