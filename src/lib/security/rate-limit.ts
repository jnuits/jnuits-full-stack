/**
 * Lightweight in-process sliding-window rate limiter.
 * Works on both Node and Edge runtimes without external dependencies.
 * API routes should use checkRateLimitForApi so production traffic uses
 * the Supabase-backed durable limiter.
 */

import { createHash } from "node:crypto";
import * as Sentry from "@sentry/nextjs";
import { createAdminClient } from "@/lib/supabase/admin";
import { asFlexibleClient } from "@/lib/supabase/flexible";

interface WindowEntry {
  count: number;
  resetAt: number;
}

// Module-level store survives across requests in the same process.
const store = new Map<string, WindowEntry>();

// Periodically prune expired entries to prevent memory leaks.
const pruneTimer = setInterval(
  () => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (entry.resetAt <= now) store.delete(key);
    }
  },
  60_000 // prune every 60 s
);

if (typeof pruneTimer === "object" && "unref" in pruneTimer) {
  pruneTimer.unref();
}

export interface RateLimitConfig {
  /** Number of allowed requests per window. */
  limit: number;
  /** Window duration in seconds. */
  windowSeconds: number;
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetAt: number; // unix ms
}

/**
 * Check and record a hit for `key` against the given config.
 * Returns `success: false` when the limit is exceeded.
 */
export function checkRateLimit(key: string, config: RateLimitConfig): RateLimitResult {
  const now = Date.now();
  const windowMs = config.windowSeconds * 1_000;

  let entry = store.get(key);

  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: now + windowMs };
    store.set(key, entry);
  }

  entry.count += 1;

  const remaining = Math.max(0, config.limit - entry.count);
  const success = entry.count <= config.limit;

  return { success, remaining, resetAt: entry.resetAt };
}

function shouldUseSupabaseRateLimit() {
  const backend = process.env.RATE_LIMIT_BACKEND?.trim().toLowerCase();

  if (backend === "memory" || backend === "local") {
    return false;
  }

  return backend === "supabase" || process.env.NODE_ENV === "production";
}

function getRateLimitSalt() {
  return process.env.RATE_LIMIT_SECRET_SALT?.trim() || "";
}

function hashRateLimitKey(key: string) {
  const salt = getRateLimitSalt();

  if (!salt) {
    return null;
  }

  return createHash("sha256").update(`${salt}:${key}`).digest("hex");
}

/**
 * Async API-route limiter. In local development it uses the in-process store.
 * In production, it records only salted key hashes in Supabase.
 */
export async function checkRateLimitForApi(
  key: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  if (!shouldUseSupabaseRateLimit()) {
    return checkRateLimit(key, config);
  }

  const keyHash = hashRateLimitKey(key);
  const fallbackResetAt = Date.now() + config.windowSeconds * 1_000;

  if (!keyHash) {
    console.error("[RateLimit] RATE_LIMIT_SECRET_SALT is required for Supabase-backed rate limiting.");
    return { success: false, remaining: 0, resetAt: fallbackResetAt };
  }

  try {
    const admin = asFlexibleClient(createAdminClient());
    const { data, error } = await admin.rpc("hit_rate_limit", {
      p_key_hash: keyHash,
      p_limit: config.limit,
      p_window_seconds: config.windowSeconds,
    });

    if (error) {
      throw error;
    }

    const row = Array.isArray(data) ? data[0] : data;
    const resetAt =
      typeof row?.reset_at === "string"
        ? Date.parse(row.reset_at)
        : fallbackResetAt;

    return {
      success: Boolean(row?.success),
      remaining:
        typeof row?.remaining === "number"
          ? row.remaining
          : Math.max(0, config.limit - 1),
      resetAt: Number.isFinite(resetAt) ? resetAt : fallbackResetAt,
    };
  } catch (error) {
    console.error("[RateLimit] Supabase-backed rate limit failed:", error);
    // The limiter fails closed below, so callers see a denial without any
    // signal of why — report the backend outage to Sentry explicitly.
    Sentry.captureException(error, { tags: { context: "rate-limit-backend" } });
    return { success: false, remaining: 0, resetAt: fallbackResetAt };
  }
}

/**
 * Extract the best available IP identifier from a Next.js request.
 * Works behind Vercel, Cloudflare, and direct connections.
 *
 * Vercel overwrites `x-real-ip`, so prefer it over headers a direct client can
 * supply. Cloudflare's connecting IP remains the next trusted proxy signal.
 */
export function getRequestIp(headers: Headers): string {
  return (
    headers.get("x-real-ip") ??
    headers.get("cf-connecting-ip") ??
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

// ─── Pre-configured limits for each endpoint ──────────────────────────────────

export const RATE_LIMITS = {
  /** Public contact form — 5 submissions per 10 minutes per IP */
  contactSubmit: { limit: 5, windowSeconds: 600 } satisfies RateLimitConfig,

  /** Membership status lookup — 10 queries per 5 minutes per IP */
  membershipStatus: { limit: 10, windowSeconds: 300 } satisfies RateLimitConfig,

  /** Member directory verification — 5 attempts per 5 minutes per IP */
  memberVerify: { limit: 5, windowSeconds: 300 } satisfies RateLimitConfig,

  /** Step-up password re-auth — 3 attempts per 10 minutes per user */
  profileStepUp: { limit: 3, windowSeconds: 600 } satisfies RateLimitConfig,

  /** Direct profile edit — 10 per 5 minutes per IP (auth required separately) */
  profileDirect: { limit: 10, windowSeconds: 300 } satisfies RateLimitConfig,

  /** Event registration — 3 per 10 minutes per IP */
  eventRegister: { limit: 3, windowSeconds: 600 } satisfies RateLimitConfig,

  /** Public form submission — 3 per 10 minutes per IP */
  formSubmit: { limit: 3, windowSeconds: 600 } satisfies RateLimitConfig,

  /** Form confirmation attempts — 8 per 10 minutes per IP */
  formConfirm: { limit: 8, windowSeconds: 600 } satisfies RateLimitConfig,

  /** Form confirmation resend — 3 per hour per IP and canonical email */
  formConfirmationResend: { limit: 3, windowSeconds: 3_600 } satisfies RateLimitConfig,

  /** Event check-in (admin only) — 60 per minute per IP */
  eventCheckin: { limit: 60, windowSeconds: 60 } satisfies RateLimitConfig,

  /** Public certificate batch verification — 12 batches per 10 minutes per IP */
  certificateBatch: { limit: 12, windowSeconds: 600 } satisfies RateLimitConfig,

  /** Public single certificate view — 30 views per 10 minutes per IP */
  certificateView: { limit: 30, windowSeconds: 600 } satisfies RateLimitConfig,

  /** Admin Cloudinary signing — 30 signatures per 5 minutes per IP */
  cloudinarySign: { limit: 30, windowSeconds: 300 } satisfies RateLimitConfig,

  /** Auth login attempts — 8 per 10 minutes per IP+email */
  authLogin: { limit: 8, windowSeconds: 600 } satisfies RateLimitConfig,

  /** Account claim/register attempts — 5 per 15 minutes per IP */
  authRegister: { limit: 5, windowSeconds: 900 } satisfies RateLimitConfig,

  /** Password recovery requests — 5 per 15 minutes per IP+email */
  authPasswordReset: { limit: 5, windowSeconds: 900 } satisfies RateLimitConfig,

  /** Client-reported security events — 20 per minute per user */
  securityEvent: { limit: 20, windowSeconds: 60 } satisfies RateLimitConfig,

  /** Public member directory reads — generous for browsing, blocks scraping floods */
  publicDirectory: { limit: 60, windowSeconds: 60 } satisfies RateLimitConfig,
} as const;
