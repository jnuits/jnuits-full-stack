/**
 * withApiGuard — Composable API route security middleware.
 *
 * Wraps a Next.js route handler with:
 *  1. IP-based rate limiting (uses the shared sliding-window limiter)
 *  2. Required authentication (optional, for authenticated-only routes)
 *  3. Standardized JSON error responses via the api-error policy
 *
 * Usage:
 *   export const POST = withApiGuard(handler, {
 *     rateLimit: RATE_LIMITS.contact,
 *     requireAuth: false,
 *   });
 *
 *   export const GET = withApiGuard(handler, {
 *     rateLimit: RATE_LIMITS.memberVerify,
 *     requireAuth: true,   // rejects unauthenticated requests with 401
 *   });
 */

import { type NextRequest, NextResponse } from "next/server";
import {
  checkRateLimit,
  getRequestIp,
  type RateLimitConfig,
} from "@/lib/security/rate-limit";
import { rateLimitError, apiError } from "@/lib/errors/api-error";
import { getAuthContext } from "@/lib/auth/session";

type RouteHandler = (
  request: NextRequest,
  context: { userId?: string }
) => Promise<NextResponse> | NextResponse;

interface ApiGuardOptions {
  /** Rate limit config (from RATE_LIMITS). If omitted, no rate limiting is applied. */
  rateLimit?: RateLimitConfig;
  /** If true, reject unauthenticated requests with 401 before calling the handler. */
  requireAuth?: boolean;
}

export function withApiGuard(
  handler: RouteHandler,
  options: ApiGuardOptions = {}
) {
  return async function guardedHandler(request: NextRequest): Promise<NextResponse> {
    // 1. Rate limiting
    if (options.rateLimit) {
      const ip = getRequestIp(request.headers);
      const rl = checkRateLimit(`ip:${ip}`, options.rateLimit);
      if (!rl.success) return rateLimitError(rl.resetAt);
    }

    // 2. Auth check
    let userId: string | undefined;
    if (options.requireAuth) {
      try {
        const auth = await getAuthContext();
        if (!auth.user?.id) {
          return apiError("Unauthenticated", { status: 401, fallback: "Authentication required. Sign in and try again." });
        }
        userId = auth.user.id;
      } catch (err) {
        return apiError(err, { status: 401, fallback: "Authentication required. Sign in and try again." });
      }
    }

    // 3. Delegate to the handler
    return handler(request, { userId });
  };
}
