import "server-only";
import { type NextRequest, NextResponse } from "next/server";
import { withApiGuard } from "@/lib/security/with-api-guard";
import { checkRateLimitForApi, getRequestIp } from "@/lib/security/rate-limit";
import { readBoundedRequestText, RequestBodyTooLargeError } from "@/lib/security/bounded-request-body";
import { confirmNewsletter, subscribeNewsletter } from "./service";

export function newsletterRoute(operation: "subscribe" | "confirm") {
  const guarded = withApiGuard(async (request) => {
    try {
      const ip = getRequestIp(request.headers);
      const limit = await checkRateLimitForApi(`newsletter:${operation}:ip:${ip}`, {
        limit: operation === "subscribe" ? 10 : 60, windowSeconds: 3600,
      });
      if (!limit.success) return NextResponse.json({ error: "rate_limited" }, {
        status: 429, headers: { "Retry-After": String(Math.max(1, Math.ceil((limit.resetAt - Date.now()) / 1000))) },
      });
      let input: unknown;
      try { input = JSON.parse(await readBoundedRequestText(request, 16 * 1024)); }
      catch (error) {
        return NextResponse.json({ error: error instanceof RequestBodyTooLargeError ? "payload_too_large" : "invalid_input" }, {
          status: error instanceof RequestBodyTooLargeError ? 413 : 400,
        });
      }
      const result = operation === "subscribe" ? await subscribeNewsletter(input, ip) : await confirmNewsletter(input);
      return NextResponse.json(result.body, { status: result.status });
    } catch {
      return NextResponse.json({ error: "newsletter_unavailable" }, { status: 503 });
    }
  });
  return async (request: NextRequest, context: { params: Promise<Record<string, string | string[] | undefined>> }) => {
    const response = await guarded(request, context);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  };
}
