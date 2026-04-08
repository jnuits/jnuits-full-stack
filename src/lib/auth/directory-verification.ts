import { createHmac } from "node:crypto";
import type { ReadonlyRequestCookies } from "next/dist/server/web/spec-extension/adapters/request-cookies";
import type { ResponseCookies } from "next/dist/compiled/@edge-runtime/cookies";
import { getSupabaseAdminKey } from "@/lib/supabase/config";

export const DIRECTORY_VERIFIED_COOKIE = "member_directory_verified";
export const DIRECTORY_VERIFIED_USER_COOKIE = "member_directory_verified_user_id";
export const DIRECTORY_VERIFIED_TTL_SECONDS = 60 * 60;

export function hashDirectoryVerificationCode(value: string) {
  return createHmac("sha256", getSupabaseAdminKey())
    .update(value.trim().toUpperCase())
    .digest("hex");
}

export function setDirectoryVerificationCookies(
  cookies: ResponseCookies,
  userId: string
) {
  const baseOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
    maxAge: DIRECTORY_VERIFIED_TTL_SECONDS,
  };

  cookies.set(DIRECTORY_VERIFIED_COOKIE, "1", baseOptions);
  cookies.set(DIRECTORY_VERIFIED_USER_COOKIE, userId, baseOptions);
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
  cookies: ReadonlyRequestCookies,
  userId: string
) {
  return (
    cookies.get(DIRECTORY_VERIFIED_COOKIE)?.value === "1" &&
    cookies.get(DIRECTORY_VERIFIED_USER_COOKIE)?.value === userId
  );
}
