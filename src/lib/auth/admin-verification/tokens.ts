import "server-only";
import { createHash, createHmac, randomBytes } from "node:crypto";
import type { PreparedIntent } from "./types";

export function createProofSecret() {
  const secret = randomBytes(32).toString("base64url");
  return { secret, hash: createHash("sha256").update(secret).digest("hex") };
}

export function parseProofToken(token: string): { proofId: string; tokenHash: string } | null {
  const match = /^([a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12})\.([A-Za-z0-9_-]{43})$/i.exec(token);
  return match ? { proofId: match[1], tokenHash: createHash("sha256").update(match[2]).digest("hex") } : null;
}

export function createEmailCodeMac(binding: PreparedIntent, challengeId: string, code: string, key: string) {
  return createHmac("sha256", key).update(JSON.stringify([
    "jnuits-admin-email-v1", challengeId, binding.actor.userId, binding.actor.sessionId,
    binding.intent.operation, binding.payloadDigest, binding.policyRevision, binding.actor.roleVersion, code,
  ])).digest("hex");
}

export function hashVerificationIp(ip: string) {
  const salt = process.env.RATE_LIMIT_SECRET_SALT?.trim();
  if (!salt) throw new Error("Verification throttling is unavailable.");
  return createHmac("sha256", salt).update(`admin-verification-ip:${ip}`).digest("hex");
}
