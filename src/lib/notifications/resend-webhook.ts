import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

const MAX_WEBHOOK_AGE_MS = 5 * 60 * 1000;

const resendWebhookPayloadSchema = z
  .object({
    created_at: z.string().datetime(),
    data: z.object({ email_id: z.string().min(1) }).passthrough(),
    type: z.string().min(1),
  })
  .passthrough();

export class ResendWebhookVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ResendWebhookVerificationError";
  }
}

export type VerifiedResendWebhookEvent = {
  createdAt: string;
  eventId: string;
  providerMessageId: string;
  type: string;
};

type ResendWebhookHeaders = {
  "svix-id"?: null | string;
  "svix-signature"?: null | string;
  "svix-timestamp"?: null | string;
};

function decodeWebhookSecret(secret: string) {
  if (!secret.startsWith("whsec_")) {
    throw new ResendWebhookVerificationError("Webhook secret is invalid.");
  }

  const encoded = secret.slice("whsec_".length);
  const decoded = Buffer.from(encoded, "base64");

  if (!encoded || decoded.length === 0) {
    throw new ResendWebhookVerificationError("Webhook secret is invalid.");
  }

  return decoded;
}

function hasValidSignature(signatureHeader: string, expectedSignature: string) {
  const expected = Buffer.from(expectedSignature, "utf8");

  return signatureHeader.split(" ").some((candidate) => {
    const [version, signature] = candidate.split(",", 2);
    const received = Buffer.from(signature || "", "utf8");

    return (
      version === "v1" &&
      received.length === expected.length &&
      timingSafeEqual(received, expected)
    );
  });
}

export function verifyResendWebhook(input: {
  headers: ResendWebhookHeaders;
  nowMs?: number;
  payload: string;
  secret: string;
}): VerifiedResendWebhookEvent {
  const eventId = input.headers["svix-id"];
  const signature = input.headers["svix-signature"];
  const timestamp = input.headers["svix-timestamp"];

  if (!eventId || !signature || !timestamp) {
    throw new ResendWebhookVerificationError("Webhook signature headers are missing.");
  }

  const timestampSeconds = Number(timestamp);
  if (!Number.isSafeInteger(timestampSeconds)) {
    throw new ResendWebhookVerificationError("Webhook timestamp is invalid.");
  }

  const nowMs = input.nowMs ?? Date.now();
  if (Math.abs(nowMs - timestampSeconds * 1000) > MAX_WEBHOOK_AGE_MS) {
    throw new ResendWebhookVerificationError("Webhook signature has expired.");
  }

  const expectedSignature = createHmac("sha256", decodeWebhookSecret(input.secret))
    .update(`${eventId}.${timestamp}.${input.payload}`)
    .digest("base64");

  if (!hasValidSignature(signature, expectedSignature)) {
    throw new ResendWebhookVerificationError("Webhook signature is invalid.");
  }

  const parsed = resendWebhookPayloadSchema.safeParse(
    JSON.parse(input.payload) as unknown
  );
  if (!parsed.success) {
    throw new ResendWebhookVerificationError("Webhook payload is invalid.");
  }

  return {
    createdAt: parsed.data.created_at,
    eventId,
    providerMessageId: parsed.data.data.email_id,
    type: parsed.data.type,
  };
}
