import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import {
  getApplicationMacKey,
  getApplicationMacKeys,
} from "@/lib/supabase/config";

const STEP_UP_COOKIE_NAME = "jnuits-step-up";
const STEP_UP_TTL_SECONDS = 15 * 60;

function createSignature(userId: string, expiresAt: number, key: string) {
  return createHmac("sha256", key)
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
  const signature = createSignature(userId, expiresMs, getApplicationMacKey());

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

  if (
    !cookieUserId ||
    !expiresAtRaw ||
    !/^[a-f0-9]{64}$/i.test(signature || "") ||
    cookieUserId !== userId
  ) {
    return false;
  }

  const expiresAt = Number.parseInt(expiresAtRaw, 10);

  if (!Number.isFinite(expiresAt) || expiresAt <= now) {
    return false;
  }

  return getApplicationMacKeys().some((key) => {
    const expectedSignature = createSignature(cookieUserId, expiresAt, key);

    try {
      return timingSafeEqual(
        Buffer.from(signature, "hex"),
        Buffer.from(expectedSignature, "hex")
      );
    } catch {
      return false;
    }
  });
}

export function buildStepUpCookie(userId: string, now = Date.now()) {
  const expiresAt = getStepUpExpiryDate(now);

  return {
    expiresAt,
    name: STEP_UP_COOKIE_NAME,
    value: createStepUpCookieValue(userId, expiresAt),
  };
}
