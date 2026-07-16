import { createHash, randomBytes } from "node:crypto";

export const FORM_CONFIRMATION_TTL_MS = 24 * 60 * 60 * 1_000;

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export type FormConfirmation = {
  expiresAt: Date;
  token: string;
  tokenHash: string;
};

function assertValidToken(token: string) {
  if (!TOKEN_PATTERN.test(token)) {
    throw new Error("Invalid form confirmation token.");
  }
}

export function hashFormConfirmationToken(token: string): string {
  assertValidToken(token);
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function createFormConfirmation(issuedAt = new Date()): FormConfirmation {
  if (!Number.isFinite(issuedAt.getTime())) {
    throw new Error("Invalid confirmation issue time.");
  }

  const token = randomBytes(32).toString("base64url");

  return {
    token,
    tokenHash: hashFormConfirmationToken(token),
    expiresAt: new Date(issuedAt.getTime() + FORM_CONFIRMATION_TTL_MS),
  };
}

export function isFormConfirmationExpired(expiresAt: Date, now = new Date()): boolean {
  return expiresAt.getTime() <= now.getTime();
}
