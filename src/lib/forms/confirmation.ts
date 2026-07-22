import { createHash, randomBytes } from "node:crypto";

export const FORM_CONFIRMATION_TTL_MS = 24 * 60 * 60 * 1_000;
export const FORM_CONFIRMATION_RESEND_ACCEPTED_MESSAGE =
  "If an eligible pending submission matches that email, a new confirmation link is on its way.";

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export type FormConfirmation = {
  expiresAt: Date;
  token: string;
  tokenHash: string;
};
export function buildFormConfirmationUrl(options: {
  baseUrl: string;
  formSlug: string;
  submissionId: string;
  token: string;
}) {
  const url = new URL("/forms/confirm", options.baseUrl);
  url.searchParams.set("submission", options.submissionId);
  url.searchParams.set("token", options.token);
  url.searchParams.set("form", options.formSlug);
  return url.toString();
}

export function getFormConfirmationResendEndpoint(formSlug: string) {
  return `/api/forms/${encodeURIComponent(formSlug)}/confirmations/resend`;
}

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
