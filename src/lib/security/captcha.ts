import "server-only";

const TURNSTILE_VERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export function getTurnstileSiteKey() {
  return process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() || "";
}

function getTurnstileSecretKey() {
  return process.env.TURNSTILE_SECRET_KEY?.trim() || "";
}

function getConfiguredSupabaseUrl() {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    process.env.SUPABASE_URL?.trim() ||
    ""
  );
}

export function isLocalSupabaseUrl() {
  const rawUrl = getConfiguredSupabaseUrl();

  if (!rawUrl) {
    return true;
  }

  try {
    const { hostname } = new URL(rawUrl);
    return (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "0.0.0.0" ||
      hostname === "::1" ||
      hostname.endsWith(".localhost")
    );
  } catch {
    return false;
  }
}

export function isHostedSupabaseUrl() {
  return !isLocalSupabaseUrl();
}

export function isCaptchaConfigured() {
  return Boolean(getTurnstileSiteKey() && getTurnstileSecretKey());
}

export function isDeployedProduction() {
  return process.env.VERCEL_ENV === "production";
}

export function isCaptchaRequired() {
  if (isDeployedProduction()) {
    return true;
  }

  const usingHostedSupabase = isHostedSupabaseUrl();
  const override = process.env.AUTH_CAPTCHA_REQUIRED?.trim().toLowerCase();

  if (override === "false" || override === "0" || override === "off") {
    return usingHostedSupabase;
  }

  if (override === "true" || override === "1" || override === "on") {
    return true;
  }

  return usingHostedSupabase || process.env.NODE_ENV === "production";
}

export function getAuthCaptchaUiConfig() {
  const required = isCaptchaRequired();

  return {
    required,
    siteKey: required ? getTurnstileSiteKey() : "",
  };
}

export async function verifyCaptchaToken(token: string, remoteIp?: string) {
  const secret = getTurnstileSecretKey();

  if (!isCaptchaRequired()) {
    return { error: null, ok: true };
  }

  if (!secret || !getTurnstileSiteKey()) {
    return {
      error:
        "CAPTCHA protection is not configured. Set TURNSTILE_SECRET_KEY and NEXT_PUBLIC_TURNSTILE_SITE_KEY.",
      ok: false,
    };
  }

  if (!token) {
    return { error: "Complete the verification challenge.", ok: false };
  }

  const body = new URLSearchParams({
    response: token,
    secret,
  });

  if (remoteIp) {
    body.set("remoteip", remoteIp);
  }

  const response = await fetch(TURNSTILE_VERIFY_URL, {
    body,
    method: "POST",
  }).catch(() => null);

  if (!response?.ok) {
    return { error: "CAPTCHA verification failed.", ok: false };
  }

  const result = (await response.json().catch(() => null)) as
    | { success?: boolean }
    | null;

  return result?.success
    ? { error: null, ok: true }
    : { error: "CAPTCHA verification failed.", ok: false };
}
