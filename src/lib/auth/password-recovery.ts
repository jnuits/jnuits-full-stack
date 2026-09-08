import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import {
  getApplicationMacKey,
  getApplicationMacKeys,
} from "@/lib/supabase/config";

export const PASSWORD_RECOVERY_COOKIE_NAME = "jnuits-password-recovery";
const PASSWORD_RECOVERY_TTL_SECONDS = 15 * 60;

function createSignature(userId: string, expiresAt: number, key: string) {
  return createHmac("sha256", key)
    .update(`${userId}:${expiresAt}`)
    .digest("hex");
}

export function buildPasswordRecoveryCookie(userId: string, now = Date.now()) {
  const expiresAt = new Date(now + PASSWORD_RECOVERY_TTL_SECONDS * 1000);
  const expiresMs = expiresAt.getTime();
  const signature = createSignature(
    userId,
    expiresMs,
    getApplicationMacKey()
  );

  return {
    expiresAt,
    name: PASSWORD_RECOVERY_COOKIE_NAME,
    value: `${userId}.${expiresMs}.${signature}`,
  };
}

export function isPasswordRecoveryActiveForUser(
  cookieStore: {
    get(name: string): { value: string } | undefined;
  },
  userId: string,
  now = Date.now()
) {
  const rawValue = cookieStore.get(PASSWORD_RECOVERY_COOKIE_NAME)?.value;

  if (!rawValue) {
    return false;
  }

  const [cookieUserId, expiresAtRaw, signature] = rawValue.split(".");
  const expiresAt = Number.parseInt(expiresAtRaw || "", 10);

  if (
    cookieUserId !== userId ||
    !Number.isFinite(expiresAt) ||
    expiresAt <= now ||
    !/^[a-f0-9]{64}$/i.test(signature || "")
  ) {
    return false;
  }

  return getApplicationMacKeys().some((key) => {
    const expected = createSignature(userId, expiresAt, key);

    try {
      return timingSafeEqual(
        Buffer.from(signature!, "hex"),
        Buffer.from(expected, "hex")
      );
    } catch {
      return false;
    }
  });
}
