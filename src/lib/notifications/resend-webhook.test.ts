import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  ResendWebhookVerificationError,
  verifyResendWebhook,
} from "@/lib/notifications/resend-webhook";

const webhookSecret = `whsec_${Buffer.from("resend-test-signing-secret").toString("base64")}`;
const timestamp = "1781424000";
const eventId = "msg_01JNUITSDELIVERY";

function signedHeaders(payload: string) {
  const signature = createHmac(
    "sha256",
    Buffer.from(webhookSecret.slice("whsec_".length), "base64")
  )
    .update(`${eventId}.${timestamp}.${payload}`)
    .digest("base64");

  return {
    "svix-id": eventId,
    "svix-signature": `v1,${signature}`,
    "svix-timestamp": timestamp,
  };
}

describe("verifyResendWebhook", () => {
  it("accepts a valid signed delivery event and retains the provider event ID", () => {
    const payload = JSON.stringify({
      created_at: "2026-07-15T10:00:00.000Z",
      data: {
        email_id: "email_01JNUITSDELIVERY",
        to: ["member@example.test"],
      },
      type: "email.delivered",
    });

    expect(
      verifyResendWebhook({
        headers: signedHeaders(payload),
        nowMs: Number(timestamp) * 1000,
        payload,
        secret: webhookSecret,
      })
    ).toEqual({
      createdAt: "2026-07-15T10:00:00.000Z",
      eventId,
      providerMessageId: "email_01JNUITSDELIVERY",
      type: "email.delivered",
    });
  });

  it("rejects an invalid signature before event data is trusted", () => {
    const payload = JSON.stringify({
      created_at: "2026-07-15T10:00:00.000Z",
      data: { email_id: "email_01JNUITSDELIVERY" },
      type: "email.delivered",
    });

    expect(() =>
      verifyResendWebhook({
        headers: { ...signedHeaders(payload), "svix-signature": "v1,invalid" },
        nowMs: Number(timestamp) * 1000,
        payload,
        secret: webhookSecret,
      })
    ).toThrow(ResendWebhookVerificationError);
  });

  it("rejects an expired signed event to reduce replay exposure", () => {
    const payload = JSON.stringify({
      created_at: "2026-07-15T10:00:00.000Z",
      data: { email_id: "email_01JNUITSDELIVERY" },
      type: "email.delivered",
    });

    expect(() =>
      verifyResendWebhook({
        headers: signedHeaders(payload),
        nowMs: (Number(timestamp) + 301) * 1000,
        payload,
        secret: webhookSecret,
      })
    ).toThrow(/expired/i);
  });
});
