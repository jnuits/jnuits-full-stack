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
  it("updates the private admin-notice ledger only after all earlier ledgers decline a verified event",async()=>{
    mocks.rpc.mockResolvedValue({data:[{tracked:false}],error:null});
    mocks.rpc.mockResolvedValueOnce({data:[{tracked:false}],error:null}).mockResolvedValueOnce({data:[{tracked:false}],error:null}).mockResolvedValueOnce({data:[{tracked:false}],error:null}).mockResolvedValueOnce({data:{tracked:false},error:null}).mockResolvedValueOnce({data:{tracked:true,duplicate:false},error:null});
    const response=await POST(request());expect(await response.json()).toEqual({received:true,tracked:true,duplicate:false});
    expect(mocks.rpc).toHaveBeenNthCalledWith(5,"record_admin_notification_webhook_event",{p_provider_event_id:"msg_test",p_provider_message_id:"provider-message-test",p_event_type:"email.delivered",p_occurred_at:"2026-07-19T07:00:00.000Z"});
  });
  it("acknowledges unrelated verified event types without sending them to the notice state machine",async()=>{
    mocks.rpc.mockResolvedValue({data:{tracked:false},error:null});
    mocks.verifyResendWebhook.mockReturnValue({createdAt:"2026-07-19T07:00:00.000Z",eventId:"unrelated",providerMessageId:"provider",type:"email.opened"});
    expect((await POST(request())).status).toBe(200);expect(mocks.rpc).toHaveBeenCalledTimes(4);
  });
  it("records newsletter suppression only after verified events match no earlier ledger", async () => {
    mocks.rpc.mockResolvedValue({data:[{tracked:false}],error:null});
    mocks.rpc.mockResolvedValueOnce({data:[{tracked:false}],error:null}).mockResolvedValueOnce({data:[{tracked:false}],error:null}).mockResolvedValueOnce({data:[{tracked:false}],error:null}).mockResolvedValueOnce({data:{tracked:true,duplicate:true},error:null});
    mocks.verifyResendWebhook.mockReturnValue({createdAt:"2026-10-04T00:00:00Z",eventId:"fixture-complaint",providerMessageId:"newsletter-fixture",type:"email.complained"});
    const response=await POST(request());
    expect(await response.json()).toEqual({received:true,tracked:true,duplicate:true});
    expect(mocks.rpc).toHaveBeenNthCalledWith(4,"newsletter_store",{p_action:"webhook",p_payload:{event_id:"fixture-complaint",message_id:"newsletter-fixture",event_type:"email.complained",occurred_at:"2026-10-04T00:00:00Z",delivery_status:"complained"}});
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.rpc.mockReset();
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

  it.each([undefined, "1", "262145"])("rejects oversized webhook bytes with declared length %s before verification or persistence", async (declared) => {
    let canceled = false;
    let emitted = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        emitted += 1;
        if (emitted === 1) controller.enqueue(new Uint8Array(262145));
        else if (emitted < 4) controller.enqueue(new Uint8Array(1));
        else controller.close();
      },
      cancel() { canceled = true; },
    });
    const oversized = new Request("https://jnuits.example.test/api/webhooks/resend", {
      method: "POST", body, duplex: "half",
      headers: declared ? { "content-length": declared } : {},
    } as RequestInit);
    const response = await POST(oversized);
    expect(response.status).toBe(413);
    expect(canceled).toBe(true);
    expect(mocks.verifyResendWebhook).not.toHaveBeenCalled();
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("counts multibyte UTF-8 bytes across chunks rather than characters", async () => {
    const chunk = new TextEncoder().encode("€".repeat(44000));
    const body = new ReadableStream<Uint8Array>({
      start(controller) { controller.enqueue(chunk); controller.enqueue(chunk); controller.close(); },
    });
    const response = await POST(new Request("https://jnuits.example.test/api/webhooks/resend", { method: "POST", body, duplex: "half" } as RequestInit));
    expect(response.status).toBe(413);
    expect(mocks.verifyResendWebhook).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("preserves exact payload across a split multibyte character", async () => {
    const payload = '{"type":"email.delivered","label":"বাংলা €"}';
    const bytes = new TextEncoder().encode(payload);
    const body = new ReadableStream<Uint8Array>({
      start(controller) { controller.enqueue(bytes.slice(0, 37)); controller.enqueue(bytes.slice(37)); controller.close(); },
    });
    const response = await POST(new Request("https://jnuits.example.test/api/webhooks/resend", { method: "POST", body, duplex: "half" } as RequestInit));
    expect(response.status).toBe(200);
    expect(mocks.verifyResendWebhook).toHaveBeenCalledWith(expect.objectContaining({ payload }));
  });

  it("does not verify an aborted body", async () => {
    const abort = new AbortController();
    abort.abort();
    const response = await POST(new Request("https://jnuits.example.test/api/webhooks/resend", {
      method: "POST", body: "{}", signal: abort.signal,
    }));
    expect(response.status).toBe(400);
    expect(mocks.verifyResendWebhook).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

});
