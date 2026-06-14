import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getAuthContext } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiError } from "@/lib/errors/api-error";
import {
  checkRateLimitForApi,
  getRequestIp,
  RATE_LIMITS,
} from "@/lib/security/rate-limit";
import { recordSecurityEvent } from "@/lib/security/security-events";
import { withApiGuard } from "@/lib/security/with-api-guard";

const clientSecurityEventSchema = z.object({
  eventType: z.enum([
    "auth.mfa.challenge_verified",
    "auth.mfa.factor_enrolled",
    "auth.password_changed",
    "auth.reauthentication_requested",
  ]),
  payload: z.record(z.string(), z.unknown()).optional().default({}),
});

async function handlePost(request: NextRequest) {
  const auth = await getAuthContext();

  if (!auth.user?.id) {
    return apiError("Unauthenticated", {
      fallback: "Authentication required.",
      status: 401,
    });
  }

  const ip = getRequestIp(request.headers);
  const limit = await checkRateLimitForApi(
    `security-event:${auth.user.id}:${ip}`,
    RATE_LIMITS.securityEvent
  );

  if (!limit.success) {
    return apiError("Too many security events.", {
      fallback: "Too many security events.",
      status: 429,
    });
  }

  const body = await request.json().catch(() => null);
  const parsed = clientSecurityEventSchema.safeParse(body);

  if (!parsed.success) {
    return apiError("Invalid security event.", {
      fallback: "Invalid security event.",
      status: 400,
    });
  }

  const admin = createAdminClient();
  await recordSecurityEvent(admin, {
    actorUserId: auth.user.id,
    eventType: parsed.data.eventType,
    payload: parsed.data.payload,
    severity: parsed.data.eventType.includes("password")
      ? "warning"
      : "info",
    targetUserId: auth.user.id,
  });

  return NextResponse.json({ ok: true });
}

export const POST = withApiGuard(handlePost, {
  requireAuth: true,
});
