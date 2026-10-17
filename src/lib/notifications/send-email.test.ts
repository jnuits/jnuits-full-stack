import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  logServerError: vi.fn(),
}));

vi.mock("@/lib/errors/api-error", () => ({
  logServerError: (...args: unknown[]) => mocks.logServerError(...args),
}));

import { sendEmail } from "@/lib/notifications/send-email";

describe("sendEmail", () => {
  it("reports missing configuration without attempting a provider request",async()=>{
    vi.stubEnv("RESEND_API_KEY","");vi.stubEnv("RESEND_FROM_EMAIL","");
    const transport=vi.fn();vi.stubGlobal("fetch",transport);
    expect(await sendEmail({to:"operator@example.test",subject:"Security notice",html:"<p>Change recorded</p>"})).toMatchObject({success:false,failureKind:"configuration"});
    expect(transport).not.toHaveBeenCalled();
  });
  it.each([[400,"rejected"],[429,"rate_limited"],[503,"uncertain"]])("classifies HTTP %s without claiming delivery",async(status,kind)=>{
    vi.stubEnv("RESEND_API_KEY","test-api-key");vi.stubEnv("RESEND_FROM_EMAIL","no-reply@example.test");
    vi.stubGlobal("fetch",vi.fn().mockResolvedValue(Response.json({message:"private provider details"},{status:status as number})));
    const result=await sendEmail({to:"operator@example.test",subject:"Security notice",html:"<p>Change recorded</p>",redactProviderErrors:true});
    expect(result).toMatchObject({success:false,failureKind:kind,httpStatus:status});
    expect(JSON.stringify([result,mocks.logServerError.mock.calls])).not.toContain("private provider details");
  });
  it("preserves an unknown outcome after transport loss",async()=>{
    vi.stubEnv("RESEND_API_KEY","test-api-key");vi.stubEnv("RESEND_FROM_EMAIL","no-reply@example.test");
    vi.stubGlobal("fetch",vi.fn().mockRejectedValue(new Error("connection lost after send")));
    expect(await sendEmail({to:"operator@example.test",subject:"Security notice",html:"<p>Change recorded</p>",redactProviderErrors:true})).toMatchObject({success:false,failureKind:"uncertain"});
  });
  it("does not invent acceptance when a successful HTTP response has no message receipt",async()=>{
    vi.stubEnv("RESEND_API_KEY","test-api-key");vi.stubEnv("RESEND_FROM_EMAIL","no-reply@example.test");
    vi.stubGlobal("fetch",vi.fn().mockResolvedValue(Response.json({})));
    expect(await sendEmail({to:"operator@example.test",subject:"Security notice",html:"<p>Change recorded</p>",redactProviderErrors:true})).toMatchObject({success:false,failureKind:"uncertain"});
  });
  it("sends newsletter plaintext with a dedicated key without changing transactional credentials",async()=>{
    vi.stubEnv("RESEND_API_KEY","transactional-fixture-key");vi.stubEnv("RESEND_FROM_EMAIL","JnUITS <no-reply@example.test>");
    const fetchMock=vi.fn().mockImplementation(async()=>Response.json({id:"newsletter-message"}));vi.stubGlobal("fetch",fetchMock);
    await sendEmail({to:"consenting@example.test",subject:"Confirm newsletter",html:"<p>Confirm</p>",text:"Confirm newsletter",providerApiKey:"dedicated-newsletter-fixture-key",timeoutMs:5000,redactProviderErrors:true});
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer dedicated-newsletter-fixture-key");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).text).toBe("Confirm newsletter");
    expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
    await sendEmail({to:"member@example.test",subject:"Transactional",html:"<p>Welcome</p>"});
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe("Bearer transactional-fixture-key");
  });
  it("redacts OTP provider bodies and transport errors from logs and caller responses", async () => {
    vi.stubEnv("RESEND_API_KEY", "test-api-key");
    vi.stubEnv("RESEND_FROM_EMAIL", "no-reply@example.test");
    const sensitiveBody = "fixture code 012345 and email HTML";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: sensitiveBody }), { status: 400 })));
    const result = await sendEmail({ to: "operator@example.test", subject: "Verify your admin action", html: sensitiveBody, redactProviderErrors: true });
    expect(result.success).toBe(false);
    expect(JSON.stringify([result, mocks.logServerError.mock.calls])).not.toContain(sensitiveBody);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error(sensitiveBody)));
    const transport = await sendEmail({ to: "operator@example.test", subject: "Verify your admin action", html: sensitiveBody, redactProviderErrors: true });
    expect(JSON.stringify([transport, mocks.logServerError.mock.calls])).not.toContain(sensitiveBody);
  });
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
