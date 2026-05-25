const PRODUCTION_APP_BASE_URL = "https://jnuits.org.bd";
const LOCAL_APP_BASE_URL = "http://localhost:3000";

function isLocalhostUrl(value: string) {
  try {
    const url = new URL(value);
    return ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  } catch {
    return false;
  }
}

function normalizeBaseUrl(value: string) {
  try {
    return new URL(value).origin.replace(/\/$/, "");
  } catch {
    return "";
  }
}

export function getAppBaseUrl() {
  const configured =
    process.env.APP_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_BASE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "";

  if (configured) {
    if (process.env.NODE_ENV === "production" && isLocalhostUrl(configured)) {
      return PRODUCTION_APP_BASE_URL;
    }

    const normalized = normalizeBaseUrl(configured);
    if (normalized) return normalized;
  }

  return process.env.NODE_ENV === "production"
    ? PRODUCTION_APP_BASE_URL
    : LOCAL_APP_BASE_URL;
}

export function getPublicAppBaseUrl() {
  const configured =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_BASE_URL ||
    process.env.APP_BASE_URL ||
    "";

  if (configured && !isLocalhostUrl(configured)) {
    const normalized = normalizeBaseUrl(configured);
    if (normalized) return normalized;
  }

  return PRODUCTION_APP_BASE_URL;
}
