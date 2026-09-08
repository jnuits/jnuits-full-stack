import { createHmac, timingSafeEqual } from "node:crypto";
import type { ResponseCookies } from "next/dist/compiled/@edge-runtime/cookies";
import {
  getApplicationMacKey,
  getApplicationMacKeys,
} from "@/lib/supabase/config";

export const DIRECTORY_VERIFIED_COOKIE = "member_directory_verified";
export const DIRECTORY_VERIFIED_USER_COOKIE = "member_directory_verified_user_id";
export const DIRECTORY_VERIFIED_TTL_SECONDS = 60 * 60;

function createCodeHash(value: string, key: string) {
  return createHmac("sha256", key)
    .update(value.trim().toUpperCase())
    .digest("hex");
}

function createCookieSignature(userId: string, expiresAt: number, key: string) {
  return createHmac("sha256", key)
    .update(`${userId}:${expiresAt}`)
    .digest("hex");
}

export function hashDirectoryVerificationCode(value: string) {
  return createCodeHash(value, getApplicationMacKey());
}

export function hashDirectoryVerificationCodeCandidates(value: string) {
  return getApplicationMacKeys().map((key) => createCodeHash(value, key));
}

export function createDirectoryVerificationCookieValue(
  userId: string,
  expiresAt: Date
) {
  const expiresMs = expiresAt.getTime();
  const signature = createCookieSignature(
    userId,
    expiresMs,
    getApplicationMacKey()
  );

  return `${userId}.${expiresMs}.${signature}`;
}

export function setDirectoryVerificationCookies(
  cookies: ResponseCookies,
  userId: string,
  now = Date.now()
) {
  const expiresAt = new Date(now + DIRECTORY_VERIFIED_TTL_SECONDS * 1000);
  const baseOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
    expires: expiresAt,
  };

  cookies.set(
    DIRECTORY_VERIFIED_COOKIE,
    createDirectoryVerificationCookieValue(userId, expiresAt),
    baseOptions
  );
  // Clear the former unsigned companion cookie. It is never trusted.
  cookies.set(DIRECTORY_VERIFIED_USER_COOKIE, "", {
    ...baseOptions,
    expires: new Date(0),
  });
}

export function clearDirectoryVerificationCookies(cookies: ResponseCookies) {
  const baseOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
    maxAge: 0,
  };

  cookies.set(DIRECTORY_VERIFIED_COOKIE, "", baseOptions);
  cookies.set(DIRECTORY_VERIFIED_USER_COOKIE, "", baseOptions);
}

export function isDirectoryVerifiedForUser(
  cookies: {
    get(name: string): { value: string } | undefined;
  },
  userId: string,
  now = Date.now()
) {
  const rawValue = cookies.get(DIRECTORY_VERIFIED_COOKIE)?.value;

  if (!rawValue) {
    return false;
  }

  const [cookieUserId, expiresAtRaw, signature] = rawValue.split(".");
  const expiresAt = Number.parseInt(expiresAtRaw || "", 10);

  if (
    !cookieUserId ||
    cookieUserId !== userId ||
    !/^[a-f0-9]{64}$/i.test(signature || "") ||
    !Number.isFinite(expiresAt) ||
    expiresAt <= now
  ) {
    return false;
  }

  return getApplicationMacKeys().some((key) => {
    const expected = createCookieSignature(cookieUserId, expiresAt, key);

    try {
      return timingSafeEqual(
        Buffer.from(signature, "hex"),
        Buffer.from(expected, "hex")
      );
    } catch {
      return false;
    }
  });
}
