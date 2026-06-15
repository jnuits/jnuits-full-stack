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

  it("includes the CAPTCHA token when deployed production requires CAPTCHA", () => {
    vi.stubEnv("AUTH_CAPTCHA_REQUIRED", "false");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "production");

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
