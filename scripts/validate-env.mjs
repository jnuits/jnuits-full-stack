#!/usr/bin/env node

import { loadEnvConfig } from "@next/env";
import process from "node:process";
import { fileURLToPath } from "node:url";

export const baseRequiredEnv = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SECRET_KEY",
  "APP_BASE_URL",
];

export const productionRequiredEnv = [
  "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
  "TURNSTILE_SECRET_KEY",
  "RATE_LIMIT_BACKEND",
  "RATE_LIMIT_SECRET_SALT",
];

function isBlank(value) {
  return typeof value !== "string" || value.trim().length === 0;
}

function isValidUrl(value, { requireHttps }) {
  try {
    const url = new URL(value);
    return requireHttps ? url.protocol === "https:" : /^https?:$/.test(url.protocol);
  } catch {
    return false;
  }
}

export function validateEnv(env, options = {}) {
  const production = Boolean(options.production);
  const missing = [];
  const invalid = [];
  const required = production
    ? [...baseRequiredEnv, ...productionRequiredEnv]
    : baseRequiredEnv;

  for (const key of required) {
    if (isBlank(env[key])) {
      missing.push(key);
    }
  }

  if (!isBlank(env.NEXT_PUBLIC_SUPABASE_URL) && !isValidUrl(env.NEXT_PUBLIC_SUPABASE_URL, { requireHttps: production })) {
    invalid.push(
      production
        ? "NEXT_PUBLIC_SUPABASE_URL must be a valid https URL."
        : "NEXT_PUBLIC_SUPABASE_URL must be a valid http(s) URL."
    );
  }

  if (!isBlank(env.APP_BASE_URL) && !isValidUrl(env.APP_BASE_URL, { requireHttps: production })) {
    invalid.push(
      production
        ? "APP_BASE_URL must be a valid https URL."
        : "APP_BASE_URL must be a valid http(s) URL."
    );
  }

  if (production && env.RATE_LIMIT_BACKEND !== "supabase") {
    invalid.push("RATE_LIMIT_BACKEND must be set to 'supabase' for production builds.");
  }

  if (
    production &&
    !isBlank(env.RATE_LIMIT_SECRET_SALT) &&
    env.RATE_LIMIT_SECRET_SALT.trim().length < 32
  ) {
    invalid.push("RATE_LIMIT_SECRET_SALT must be at least 32 characters.");
  }

  return {
    ok: missing.length === 0 && invalid.length === 0,
    missing,
    invalid,
  };
}

function formatFailure(result) {
  const lines = ["Environment validation failed."];

  if (result.missing.length) {
    lines.push(`Missing: ${result.missing.join(", ")}`);
  }

  if (result.invalid.length) {
    lines.push(...result.invalid.map((message) => `Invalid: ${message}`));
  }

  lines.push("Set the variables in your deployment environment or .env.local.");
  return lines.join("\n");
}

export function runValidateEnvCli(argv = process.argv, env = process.env) {
  const production = argv.includes("--production") || env.NODE_ENV === "production";
  loadEnvConfig(process.cwd(), !production);

  const result = validateEnv(process.env, { production });

  if (!result.ok) {
    console.error(formatFailure(result));
    return 1;
  }

  console.log(
    production
      ? "Environment validation passed for production."
      : "Environment validation passed."
  );
  return 0;
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exitCode = runValidateEnvCli();
}
