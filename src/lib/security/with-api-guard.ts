/**
 * withApiGuard — Composable API route security middleware.
 *
 * Wraps a Next.js route handler with:
 *  1. Same-origin checks for unsafe mutation methods
 *  2. IP-based rate limiting (uses the shared sliding-window limiter)
 *  3. Required authentication (optional, for authenticated-only routes)
 *  4. Standardized JSON error responses via the api-error policy
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

import { getAppBaseUrl } from "@/lib/env";
import { rateLimitError, apiError } from "@/lib/errors/api-error";
import { getAuthContext } from "@/lib/auth/session";
import {
  checkRateLimit,
  getRequestIp,
  type RateLimitConfig,
} from "@/lib/security/rate-limit";

type RouteContext = {
  params?: Promise<Record<string, string | string[] | undefined>>;
} & Record<string, unknown>;

type RouteHandler<Context extends RouteContext = RouteContext> = (
  request: NextRequest,
  context: Context & { userId?: string }
) => Promise<NextResponse> | NextResponse;

interface ApiGuardOptions {
  /** Rate limit config (from RATE_LIMITS). If omitted, no rate limiting is applied. */
  rateLimit?: RateLimitConfig;
  /** If true, reject unauthenticated requests with 401 before calling the handler. */
  requireAuth?: boolean;
  /** Defaults to true. Disable only for explicitly cross-origin-safe public endpoints. */
  enforceSameOrigin?: boolean;
}

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function toOrigin(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function addOrigin(origins: Set<string>, value: string | null | undefined) {
  const origin = toOrigin(value);
  if (origin) {
    origins.add(origin);
  }
}

function addVercelHost(origins: Set<string>, value: string | null | undefined) {
  if (!value) {
    return;
  }

  addOrigin(origins, value.startsWith("http") ? value : `https://${value}`);
}

function getAllowedOrigins(request: NextRequest) {
  const origins = new Set<string>();
  const requestUrl = new URL(request.url);
  const forwardedProto =
    request.headers.get("x-forwarded-proto") ?? requestUrl.protocol.replace(":", "");
  const forwardedHost = request.headers.get("x-forwarded-host") ?? request.headers.get("host");

  addOrigin(origins, requestUrl.origin);
  addOrigin(origins, getAppBaseUrl());

  if (forwardedHost) {
    addOrigin(origins, `${forwardedProto}://${forwardedHost}`);
  }

  addVercelHost(origins, process.env.VERCEL_URL);
  addVercelHost(origins, process.env.VERCEL_BRANCH_URL);
  addVercelHost(origins, process.env.VERCEL_PROJECT_PRODUCTION_URL);

  return origins;
}

function getSameOriginError(request: NextRequest) {
  if (!UNSAFE_METHODS.has(request.method.toUpperCase())) {
    return null;
  }

  const origin = request.headers.get("origin");

  if (!origin) {
    return null;
  }

  const parsedOrigin = toOrigin(origin);

  if (!parsedOrigin || !getAllowedOrigins(request).has(parsedOrigin)) {
    return apiError("Cross-origin request rejected.", {
      status: 403,
      fallback: "Cross-origin requests are not allowed.",
    });
  }

  return null;
}

export function withApiGuard<Context extends RouteContext = RouteContext>(
  handler: RouteHandler<Context>,
  options: ApiGuardOptions = {}
) {
  return async function guardedHandler(
    request: NextRequest,
    context = {} as Context
  ): Promise<NextResponse> {
    // 1. Same-origin check for unsafe mutation methods.
    if (options.enforceSameOrigin !== false) {
      const sameOriginError = getSameOriginError(request);
      if (sameOriginError) {
        return sameOriginError;
      }
    }

    // 2. Rate limiting
    if (options.rateLimit) {
      const ip = getRequestIp(request.headers);
      const rl = checkRateLimit(`ip:${ip}`, options.rateLimit);
      if (!rl.success) return rateLimitError(rl.resetAt);
    }

    // 3. Auth check
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

    // 4. Delegate to the handler
    return handler(request, { ...context, userId });
  };
}
