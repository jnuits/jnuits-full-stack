/**
 * Centralized safe error policy for API routes.
 *
 * Rules:
 * - Never expose raw Postgres/Supabase error codes to clients.
 * - Never expose stack traces.
 * - Log the raw error server-side (Sentry / console) for debugging.
 * - Return a safe, human-readable message to the client.
 */

import { NextResponse } from "next/server";

type JsonResponse = Record<string, unknown>;

/** Maps known error patterns to safe client-facing messages. */
const SAFE_MESSAGES: Array<{ test: RegExp; message: string }> = [
  {
    test: /duplicate key|unique constraint/i,
    message: "A record with those details already exists.",
  },
  {
    test: /foreign key constraint/i,
    message: "This operation references a record that no longer exists.",
  },
  {
    test: /not-null constraint|null value in column/i,
    message: "A required field is missing.",
  },
  {
    test: /jwt expired|invalid token|invalid signature/i,
    message: "Your session has expired. Please sign in again.",
  },
  {
    test: /permission denied|row-level security/i,
    message: "You do not have permission to perform this action.",
  },
  {
    test: /ECONNREFUSED|ETIMEDOUT|fetch failed/i,
    message: "The service is temporarily unavailable. Please try again shortly.",
  },
];

/**
 * Given any caught error value, returns a safe string suitable for
 * inclusion in an API response body.
 */
export function getSafeErrorMessage(error: unknown, fallback = "Something went wrong. Please try again."): string {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : fallback;

  for (const { test, message } of SAFE_MESSAGES) {
    if (test.test(raw)) return message;
  }

  return fallback;
}

/**
 * Log the raw error server-side without leaking it to the client.
 * In production, Sentry captures it automatically via the instrumentation layer.
 */
export function logServerError(context: string, error: unknown): void {
  if (process.env.NODE_ENV !== "production") {
    console.error(`[API Error] ${context}:`, error);
  }
  // Sentry auto-captures unhandled Node errors.
  // For explicit captures you can import `captureException` from @sentry/nextjs here.
}

/**
 * Build a standardised error JSON response with a safe message.
 */
export function apiError(
  error: unknown,
  options: {
    status?: number;
    fallback?: string;
    extra?: JsonResponse;
    context?: string;
  } = {}
): NextResponse {
  const { status = 500, fallback, extra = {}, context = "unknown" } = options;

  logServerError(context, error);

  return NextResponse.json(
    { message: getSafeErrorMessage(error, fallback), ...extra },
    { status }
  );
}

/**
 * Build a 429 Too Many Requests response with Retry-After header.
 */
export function rateLimitError(resetAt: number): NextResponse {
  const retryAfterSeconds = Math.ceil((resetAt - Date.now()) / 1000);
  return NextResponse.json(
    { message: "Too many requests. Please wait before trying again." },
    {
      status: 429,
      headers: {
        "Retry-After": String(Math.max(1, retryAfterSeconds)),
        "X-RateLimit-Reset": String(resetAt),
      },
    }
  );
}
