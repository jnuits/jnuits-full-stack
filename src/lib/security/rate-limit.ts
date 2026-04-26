/**
 * Lightweight in-process sliding-window rate limiter.
 * Works on both Node and Edge runtimes without external dependencies.
 * For multi-instance production deployments, replace the store with
 * an Upstash Redis / Vercel KV backend.
 */

interface WindowEntry {
  count: number;
  resetAt: number;
}

// Module-level store survives across requests in the same process.
const store = new Map<string, WindowEntry>();

// Periodically prune expired entries to prevent memory leaks.
setInterval(
  () => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (entry.resetAt <= now) store.delete(key);
    }
  },
  60_000 // prune every 60 s
);

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

/**
 * Extract the best available IP identifier from a Next.js request.
 * Works behind Vercel, Cloudflare, and direct connections.
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

  /** Event check-in (admin only) — 60 per minute per IP */
  eventCheckin: { limit: 60, windowSeconds: 60 } satisfies RateLimitConfig,

  /** Auth login attempts — 8 per 10 minutes per IP+email */
  authLogin: { limit: 8, windowSeconds: 600 } satisfies RateLimitConfig,

  /** Account claim/register attempts — 5 per 15 minutes per IP */
  authRegister: { limit: 5, windowSeconds: 900 } satisfies RateLimitConfig,

  /** Password recovery requests — 5 per 15 minutes per IP+email */
  authPasswordReset: { limit: 5, windowSeconds: 900 } satisfies RateLimitConfig,

  /** Client-reported security events — 20 per minute per user */
  securityEvent: { limit: 20, windowSeconds: 60 } satisfies RateLimitConfig,
} as const;
