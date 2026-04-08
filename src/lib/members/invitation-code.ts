import "server-only";

import { createHmac, randomBytes } from "node:crypto";
import { getSupabaseAdminKey } from "@/lib/supabase/config";

const INVITATION_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const DEFAULT_INVITATION_EXPIRY_DAYS = 14;

export function normalizeInvitationCode(value: string) {
  return value.trim().toUpperCase();
}

export function hashInvitationCode(value: string) {
  return createHmac("sha256", getSupabaseAdminKey())
    .update(normalizeInvitationCode(value))
    .digest("hex");
}

export function generateInvitationCode(length = 12) {
  const bytes = randomBytes(length);
  let output = "";

  for (let index = 0; index < bytes.length; index += 1) {
    output += INVITATION_ALPHABET[bytes[index] % INVITATION_ALPHABET.length];
  }

  return output;
}

export function getInvitationExpiryIso(days = DEFAULT_INVITATION_EXPIRY_DAYS) {
  const safeDays = Number.isFinite(days) ? Math.max(1, Math.min(60, days)) : DEFAULT_INVITATION_EXPIRY_DAYS;
  const now = Date.now();

  return new Date(now + safeDays * 24 * 60 * 60 * 1000).toISOString();
}
