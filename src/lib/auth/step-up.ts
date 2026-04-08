import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { getSupabaseAdminKey } from "@/lib/supabase/config";

const STEP_UP_COOKIE_NAME = "jnuits-step-up";
const STEP_UP_TTL_SECONDS = 15 * 60;

function createSignature(userId: string, expiresAt: number) {
  return createHmac("sha256", getSupabaseAdminKey())
    .update(`${userId}:${expiresAt}`)
    .digest("hex");
}

export function getStepUpCookieName() {
  return STEP_UP_COOKIE_NAME;
}

export function getStepUpExpiryDate(now = Date.now()) {
  return new Date(now + STEP_UP_TTL_SECONDS * 1000);
}

export function createStepUpCookieValue(userId: string, expiresAt: Date) {
  const expiresMs = expiresAt.getTime();
  const signature = createSignature(userId, expiresMs);

  return `${userId}.${expiresMs}.${signature}`;
}

export function isStepUpActiveForUser(
  cookieStore: {
    get(name: string): { value: string } | undefined;
  },
  userId: string,
  now = Date.now()
) {
  const rawValue = cookieStore.get(STEP_UP_COOKIE_NAME)?.value;

  if (!rawValue) {
    return false;
  }

  const [cookieUserId, expiresAtRaw, signature] = rawValue.split(".");

  if (!cookieUserId || !expiresAtRaw || !signature || cookieUserId !== userId) {
    return false;
  }

  const expiresAt = Number.parseInt(expiresAtRaw, 10);

  if (!Number.isFinite(expiresAt) || expiresAt <= now) {
    return false;
  }

  const expectedSignature = createSignature(cookieUserId, expiresAt);

  try {
    return timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
}

export function buildStepUpCookie(userId: string, now = Date.now()) {
  const expiresAt = getStepUpExpiryDate(now);

  return {
    expiresAt,
    name: STEP_UP_COOKIE_NAME,
    value: createStepUpCookieValue(userId, expiresAt),
  };
}
