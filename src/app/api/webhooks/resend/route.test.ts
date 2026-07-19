import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  rpc: vi.fn(),
  verifyResendWebhook: vi.fn(),
}));

vi.mock("@/lib/notifications/resend-webhook", () => ({
  verifyResendWebhook: mocks.verifyResendWebhook,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}));

vi.mock("@/lib/supabase/flexible", () => ({
  asFlexibleClient: <T>(client: T) => client,
}));

import { POST } from "./route";

const originalWebhookSecret = process.env.RESEND_WEBHOOK_SECRET;

function request() {
  return new Request("https://jnuits.example.test/api/webhooks/resend", {
    body: '{"type":"email.delivered"}',
    headers: {
      "svix-id": "msg_test",
      "svix-signature": "v1,signature",
      "svix-timestamp": "1700000000",
    },
    method: "POST",
  });
}

describe("Resend delivery webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.RESEND_WEBHOOK_SECRET = "whsec_test";
    mocks.createAdminClient.mockReturnValue({ rpc: mocks.rpc });
    mocks.rpc.mockResolvedValue({
      data: [{ applied_status: "delivered", duplicate: false, tracked: true }],
      error: null,
    });
    mocks.verifyResendWebhook.mockReturnValue({
      createdAt: "2026-07-19T07:00:00.000Z",
      eventId: "msg_test",
      providerMessageId: "provider-message-test",
      type: "email.delivered",
    });
  });

  afterEach(() => {
    if (originalWebhookSecret === undefined) {
      delete process.env.RESEND_WEBHOOK_SECRET;
    } else {
      process.env.RESEND_WEBHOOK_SECRET = originalWebhookSecret;
    }
  });

  it("rejects delivery when the signing secret is unavailable", async () => {
    delete process.env.RESEND_WEBHOOK_SECRET;

    const response = await POST(request());

    expect(response.status).toBe(503);
    expect(mocks.verifyResendWebhook).not.toHaveBeenCalled();
  });

  it("rejects an invalid signed event without accessing the database", async () => {
    mocks.verifyResendWebhook.mockImplementation(() => {
      throw new Error("invalid signature");
    });

    const response = await POST(request());

    expect(response.status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("records verified delivery events through the idempotent RPC", async () => {
    const response = await POST(request());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      duplicate: false,
      received: true,
      tracked: true,
    });
    expect(mocks.rpc).toHaveBeenCalledWith(
      "record_invitation_delivery_webhook_event",
      {
        p_delivery_status: "delivered",
        p_event_type: "email.delivered",
        p_occurred_at: "2026-07-19T07:00:00.000Z",
        p_provider_event_id: "msg_test",
        p_provider_message_id: "provider-message-test",
      }
    );
  });

  it("falls back to the form-confirmation ledger when no invitation matches", async () => {
    mocks.rpc
      .mockResolvedValueOnce({
        data: [{ applied_status: null, duplicate: false, tracked: false }],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [{ applied_status: "delivered", duplicate: false, tracked: true }],
        error: null,
      });

    const response = await POST(request());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      duplicate: false,
      received: true,
      tracked: true,
    });
    expect(mocks.rpc).toHaveBeenNthCalledWith(
      2,
      "record_form_confirmation_delivery_webhook_event",
      expect.objectContaining({ p_provider_event_id: "msg_test" })
    );
  });
  it("falls back to the event-registration ledger when earlier ledgers do not match", async () => {
    mocks.rpc
      .mockResolvedValueOnce({
        data: [{ applied_status: null, duplicate: false, tracked: false }],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [{ applied_status: null, duplicate: false, tracked: false }],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [{ applied_status: "delivered", duplicate: false, tracked: true }],
        error: null,
      });

    const response = await POST(request());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      duplicate: false,
      received: true,
      tracked: true,
    });
    expect(mocks.rpc).toHaveBeenNthCalledWith(
      3,
      "record_event_registration_delivery_webhook_event",
      expect.objectContaining({ p_provider_event_id: "msg_test" })
    );
  });
  it("stores verified engagement events without changing delivery status", async () => {
    mocks.verifyResendWebhook.mockReturnValue({
      createdAt: "2026-07-19T07:00:00.000Z",
      eventId: "msg_opened",
      providerMessageId: "provider-message-test",
      type: "email.opened",
    });

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith(
      "record_invitation_delivery_webhook_event",
      expect.objectContaining({ p_delivery_status: null, p_event_type: "email.opened" })
    );
  });

  it("returns retryable failure when the durable ledger is unavailable", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "database unavailable" } });

    const response = await POST(request());

    expect(response.status).toBe(500);
  });
});
