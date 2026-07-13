import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  logServerError: vi.fn(),
}));

vi.mock("@/lib/errors/api-error", () => ({
  logServerError: (...args: unknown[]) => mocks.logServerError(...args),
}));

import { sendEmail } from "@/lib/notifications/send-email";

describe("sendEmail", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("forwards a caller-supplied idempotency key to Resend", async () => {
    vi.stubEnv("RESEND_API_KEY", "test-api-key");
    vi.stubEnv("RESEND_FROM_EMAIL", "JnUITS <no-reply@example.test>");
    vi.stubEnv("RESEND_REPLY_TO", "support@example.test");
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ id: "message-1" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      sendEmail({
        html: "<p>Welcome</p>",
        idempotencyKey: "member-invitation/invite-1",
        subject: "Claim your JnUITS member account",
        to: "member@example.test",
      })
    ).resolves.toEqual({ messageId: "message-1", success: true });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.resend.com/emails",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer test-api-key",
          "Content-Type": "application/json",
          "Idempotency-Key": "member-invitation/invite-1",
        }),
        method: "POST",
      })
    );
    expect(mocks.logServerError).not.toHaveBeenCalled();
  });
});