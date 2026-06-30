import "server-only";

import {
  isCaptchaConfigured,
  isCaptchaRequired,
  verifyCaptchaToken,
} from "@/lib/security/captcha";
import {
  checkRateLimit,
  getRequestIp,
  type RateLimitConfig,
} from "@/lib/security/rate-limit";

export type AuthCaptchaValidationMode = "supabase" | "turnstile";

export async function enforceAuthActionProtection(options: {
  captchaToken: string;
  captchaValidation: AuthCaptchaValidationMode;
  email?: string;
  rateLimit: RateLimitConfig;
  rateLimitPrefix: string;
  requestHeaders: Headers;
}) {
  const ip = getRequestIp(options.requestHeaders);
  const key = `${options.rateLimitPrefix}:${ip}:${options.email || "unknown"}`;
  const rateLimit = checkRateLimit(key, options.rateLimit);

  if (!rateLimit.success) {
    return "Too many attempts. Try again later.";
  }

  if (!isCaptchaRequired()) {
    return null;
  }

  if (!isCaptchaConfigured()) {
    return "CAPTCHA protection is not configured. Set TURNSTILE_SECRET_KEY and NEXT_PUBLIC_TURNSTILE_SITE_KEY.";
  }

  const token = options.captchaToken.trim();
  if (!token) {
    return "Complete the verification challenge.";
  }

  if (options.captchaValidation === "turnstile") {
    const captcha = await verifyCaptchaToken(token, ip);
    return captcha.ok ? null : captcha.error;
  }

  return null;
}

export function shouldAttemptPostClaimAutoLogin() {
  return !isCaptchaRequired();
}
