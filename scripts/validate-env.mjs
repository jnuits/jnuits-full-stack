import { createRequire } from "node:module";
import process from "node:process";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { loadEnvConfig } = require("@next/env");

export const baseRequiredEnv = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SECRET_KEY",
  "APP_BASE_URL",
];

export const productionRequiredEnv = [
  "APP_MAC_SECRET",
  "AUTH_CAPTCHA_REQUIRED",
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
  "GOOGLE_DRIVE_EXPORTS_FOLDER_ID",
  "GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL",
  "GOOGLE_DRIVE_SERVICE_ACCOUNT_PRIVATE_KEY",
  "GOOGLE_DRIVE_SHARED_DRIVE_ID",
  "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
  "NEXT_PUBLIC_SENTRY_DSN",
  "TURNSTILE_SECRET_KEY",
  "RATE_LIMIT_BACKEND",
  "RATE_LIMIT_SECRET_SALT",
  "RESEND_API_KEY",
  "RESEND_FROM_EMAIL",
  "RESEND_WEBHOOK_SECRET",
  "RETENTION_MANIFEST_SIGNING_SECRET",
];

// Browser variables must never carry secret material. Matching is by name only
// so no value is ever inspected, logged, or echoed. Legitimate public keys
// (publishable key, CAPTCHA site key) intentionally do not match.
const FORBIDDEN_PUBLIC_SECRET_NAME =
  /(?:CREDENTIALS|PASSWORD|PRIVATE_KEY|SECRET|SECRET_KEY|TOKEN)$/i;
// Accepts either a bare address (no-reply@jnuits.org.bd) or a display-name
// sender (JnUITS <no-reply@jnuits.org.bd>). Both are valid for Resend.
const SENDER_ADDRESS_PATTERN =
  /^(?:[^<>]*<\s*[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+\s*>|[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+)$/;
const EMAIL_ADDRESS_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isBlank(value) { return typeof value !== "string" || value.trim().length === 0; }
function isValidUrl(value, { requireHttps }) {
  try { const url = new URL(value); return requireHttps ? url.protocol === "https:" : /^https?:$/.test(url.protocol); }
  catch { return false; }
}
function isEnabled(value) { return ["1", "on", "true"].includes(String(value || "").trim().toLowerCase()); }

export function validateEnv(env, options = {}) {
  const production = Boolean(options.production);
  const missing = [];
  const invalid = [];
  const required = [...new Set([...(production ? [...baseRequiredEnv, ...productionRequiredEnv] : baseRequiredEnv),
    ...(options.adminDelivery ? ["CRON_SECRET", "RESEND_API_KEY", "RESEND_FROM_EMAIL", "RESEND_WEBHOOK_SECRET"] : [])])];

  for (const key of required) if (isBlank(env[key])) missing.push(key);

  for (const [name, value] of Object.entries(env)) {
    if (name.startsWith("NEXT_PUBLIC_") && FORBIDDEN_PUBLIC_SECRET_NAME.test(name) && !isBlank(value)) {
      invalid.push(`${name} must not expose secret configuration to the browser.`);
    }
  }

  if (!isBlank(env.NEXT_PUBLIC_SUPABASE_URL) && !isValidUrl(env.NEXT_PUBLIC_SUPABASE_URL, { requireHttps: production })) {
    invalid.push(production ? "NEXT_PUBLIC_SUPABASE_URL must be a valid https URL." : "NEXT_PUBLIC_SUPABASE_URL must be a valid http(s) URL.");
  }
  if (!isBlank(env.APP_BASE_URL) && !isValidUrl(env.APP_BASE_URL, { requireHttps: production })) {
    invalid.push(production ? "APP_BASE_URL must be a valid https URL." : "APP_BASE_URL must be a valid http(s) URL.");
  }
  if (production && env.RATE_LIMIT_BACKEND !== "supabase") invalid.push("RATE_LIMIT_BACKEND must be set to 'supabase' for production builds.");
  if (production && !isBlank(env.AUTH_CAPTCHA_REQUIRED) && !isEnabled(env.AUTH_CAPTCHA_REQUIRED)) invalid.push("AUTH_CAPTCHA_REQUIRED must be explicitly enabled for production builds.");
  if (production && !isBlank(env.NEXT_PUBLIC_SENTRY_DSN) && !isValidUrl(env.NEXT_PUBLIC_SENTRY_DSN, { requireHttps: true })) invalid.push("NEXT_PUBLIC_SENTRY_DSN must be a valid https URL.");
  if (production && !isBlank(env.RATE_LIMIT_SECRET_SALT) && env.RATE_LIMIT_SECRET_SALT.trim().length < 32) invalid.push("RATE_LIMIT_SECRET_SALT must be at least 32 characters.");
  if (production && !isBlank(env.APP_MAC_SECRET) && env.APP_MAC_SECRET.trim().length < 32) invalid.push("APP_MAC_SECRET must be at least 32 characters.");
  if (production && !isBlank(env.GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL) && !EMAIL_ADDRESS_PATTERN.test(env.GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL.trim())) invalid.push("GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL must be a valid email address.");
  if (production && !isBlank(env.RESEND_FROM_EMAIL) && !SENDER_ADDRESS_PATTERN.test(env.RESEND_FROM_EMAIL.trim())) invalid.push("RESEND_FROM_EMAIL must include a valid sender email address.");
  if (options.adminDelivery) {
    if (!isBlank(env.CRON_SECRET) && env.CRON_SECRET.trim().length < 32) invalid.push("CRON_SECRET must be at least 32 characters for admin delivery.");
    if (!isBlank(env.RESEND_FROM_EMAIL) && env.RESEND_FROM_EMAIL !== "JnUITS <no-reply@jnuits.org.bd>") invalid.push("RESEND_FROM_EMAIL must use the approved JnUITS notification sender.");
    if (!isBlank(env.RESEND_REPLY_TO) && !SENDER_ADDRESS_PATTERN.test(env.RESEND_REPLY_TO.trim())) invalid.push("RESEND_REPLY_TO must be a valid reply address.");
  }

  return { ok: missing.length === 0 && invalid.length === 0, missing, invalid };
}

function formatFailure(result) {
  const lines = ["Environment validation failed."];
  if (result.missing.length) lines.push(`Missing: ${result.missing.join(", ")}`);
  if (result.invalid.length) lines.push(...result.invalid.map((message) => `Invalid: ${message}`));
  lines.push("Set the variables in your deployment environment or .env.local.");
  return lines.join("\n");
}

export function runValidateEnvCli(argv = process.argv, env = process.env) {
  const production = argv.includes("--production") || env.NODE_ENV === "production";
  loadEnvConfig(process.cwd(), !production);
  const result = validateEnv(env, { production, adminDelivery: argv.includes("--admin-delivery") });
  if (!result.ok) { console.error(formatFailure(result)); return 1; }
  console.log(production ? "Environment validation passed for production." : "Environment validation passed.");
  return 0;
}

if (fileURLToPath(import.meta.url) === process.argv[1]) process.exitCode = runValidateEnvCli();
