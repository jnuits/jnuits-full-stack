import { createHash } from "node:crypto";
import { afterEach,beforeEach,describe,expect,it,vi } from "vitest";
const mocks=vi.hoisted(()=>({rpc:vi.fn(),captcha:vi.fn(),send:vi.fn(),inspect:vi.fn(),enroll:vi.fn()}));
vi.mock("@/lib/supabase/admin",()=>({createAdminClient:()=>({rpc:mocks.rpc})}));
vi.mock("@/lib/security/captcha",()=>({verifyCaptchaToken:mocks.captcha}));
vi.mock("@/lib/notifications/send-email",()=>({sendEmail:mocks.send}));
vi.mock("./provider",()=>({createNewsletterProvider:()=>({inspect:mocks.inspect,enroll:mocks.enroll})}));
import {subscribeNewsletter,confirmNewsletter} from "./service";
const input={email:"Consenting@example.test",consent:true,captchaToken:"fixture-captcha",website:""};
const token="a".repeat(64);
const ready={status:"ready",email:"consenting@example.test",token_id:"11111111-1111-4111-8111-111111111111",subscription_id:"22222222-2222-4222-8222-222222222222"};
beforeEach(()=>{
  vi.clearAllMocks();
  vi.stubEnv("RESEND_NEWSLETTER_API_KEY","re_newsletter_fixture");vi.stubEnv("APP_BASE_URL","https://jnuits.org.bd");
  mocks.captcha.mockResolvedValue({ok:true});mocks.inspect.mockResolvedValue({blocked:false,contactId:null});
  mocks.enroll.mockResolvedValue({status:"confirmed",contactId:"contact"});
  mocks.send.mockResolvedValue({success:true,messageId:"message"});
  mocks.rpc.mockImplementation(async (_fn,args)=>({error:null,data:args.p_action==="subscribe"?{status:"send",token_id:args.p_payload.token_id}:args.p_action==="prepare"?ready:args.p_action==="finish"?{status:args.p_payload.status==="pending"?"newsletter_unavailable":args.p_payload.status}:{status:"recorded"}}));
});
afterEach(()=>vi.unstubAllEnvs());
describe("newsletter double opt-in orchestration",()=>{
  it.each([{...input,consent:false},{...input,consent:undefined},{...input,email:"invalid"}])("rejects invalid consent/address before side effects",async value=>{
    expect((await subscribeNewsletter(value,"192.0.2.10")).status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();expect(mocks.inspect).not.toHaveBeenCalled();expect(mocks.send).not.toHaveBeenCalled();
  });
  it("does not send or enroll honeypot submissions or failed CAPTCHA",async()=>{
    expect((await subscribeNewsletter({...input,website:"bot"},"192.0.2.10")).status).toBe(202);
    expect(mocks.send).not.toHaveBeenCalled();expect(mocks.rpc).not.toHaveBeenCalled();
    mocks.captcha.mockResolvedValue({ok:false});
    expect((await subscribeNewsletter(input,"192.0.2.10")).status).toBe(400);
    expect(mocks.inspect).not.toHaveBeenCalled();
  });
  it("persists only a random token hash and sends HTML/plain text without early provider enrollment",async()=>{
    expect((await subscribeNewsletter(input,"192.0.2.10")).status).toBe(202);
    const email=mocks.send.mock.calls[0][0];
    const sentToken=/token=([a-f0-9]{64})/.exec(email.html)?.[1];
    expect(sentToken).toMatch(/^[a-f0-9]{64}$/);
    expect(email.text).toContain("token="+sentToken);expect(email.to).toBe("consenting@example.test");
    expect(email.redactProviderErrors).toBe(true);
    const payload=mocks.rpc.mock.calls[0][1].p_payload;
    expect(payload.token_hash).toBe(createHash("sha256").update(sentToken!).digest("hex"));
    expect(JSON.stringify(mocks.rpc.mock.calls)).not.toContain(sentToken);
    expect(mocks.enroll).not.toHaveBeenCalled();
    expect(mocks.captcha.mock.invocationCallOrder[0]).toBeLessThan(mocks.inspect.mock.invocationCallOrder[0]);
  });
  it.each(["ignored","limited"])("keeps duplicate/cooldown %s requests generic without mail",async status=>{
    mocks.rpc.mockResolvedValue({data:{status},error:null});
    expect(await subscribeNewsletter(input,"192.0.2.10")).toEqual({status:202,body:{message:"If eligible, check your email to confirm your newsletter subscription."}});
    expect(mocks.send).not.toHaveBeenCalled();expect(mocks.enroll).not.toHaveBeenCalled();
  });
  it("does not send to provider-suppressed addresses or expose suppression state",async()=>{
    mocks.inspect.mockResolvedValue({blocked:true,contactId:null});
    expect((await subscribeNewsletter(input,"192.0.2.10")).status).toBe(202);
    expect(mocks.rpc).not.toHaveBeenCalled();expect(mocks.send).not.toHaveBeenCalled();
  });
  it("records delivery failure without activating or leaking provider diagnostics",async()=>{
    mocks.send.mockResolvedValue({success:false,error:"private diagnostic"});
    const result=await subscribeNewsletter(input,"192.0.2.10");
    expect(result).toEqual({status:503,body:{error:"newsletter_unavailable"}});
    expect(mocks.rpc.mock.calls.at(-1)?.[1]).toMatchObject({p_action:"delivery",p_payload:{success:false}});
    expect(mocks.enroll).not.toHaveBeenCalled();
  });
  it.each(["invalid_token","expired_token","newsletter_unavailable"])("denies %s tokens before provider work",async status=>{
    mocks.rpc.mockResolvedValue({data:{status},error:null});
    expect((await confirmNewsletter({token})).body).toEqual({error:status});
    expect(mocks.enroll).not.toHaveBeenCalled();
  });
  it("rejects malformed tokens before persistence",async()=>{
    expect((await confirmNewsletter({token:"not-a-token"})).status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("requires provider success before active state and hashes the supplied token",async()=>{
    expect(await confirmNewsletter({token})).toEqual({status:200,body:{status:"confirmed"}});
    expect(mocks.rpc.mock.calls[0][1]).toMatchObject({p_action:"prepare",p_payload:{token_hash:createHash("sha256").update(token).digest("hex")}});
    expect(mocks.enroll.mock.invocationCallOrder[0]).toBeLessThan(mocks.rpc.mock.invocationCallOrder[1]);
    expect(mocks.rpc.mock.calls[1][1]).toMatchObject({p_action:"finish",p_payload:{status:"confirmed",contact_id:"contact"}});
  });
  it("makes partial provider failure retryable and never finalizes confirmed",async()=>{
    mocks.enroll.mockRejectedValue(new Error("private provider diagnostic"));
    expect(await confirmNewsletter({token})).toEqual({status:503,body:{error:"newsletter_unavailable"}});
    expect(mocks.rpc.mock.calls.at(-1)?.[1]).toMatchObject({p_action:"finish",p_payload:{status:"pending"}});
  });
  it("requires preferences when globally suppressed and repeats completed confirmation idempotently",async()=>{
    mocks.enroll.mockResolvedValue({status:"preferences_required"});
    expect(await confirmNewsletter({token})).toEqual({status:200,body:{status:"preferences_required"}});
    mocks.enroll.mockClear();mocks.rpc.mockResolvedValue({data:{status:"confirmed"},error:null});
    expect(await confirmNewsletter({token})).toEqual({status:200,body:{status:"confirmed"}});
    expect(mocks.enroll).not.toHaveBeenCalled();
  });
  it("fails closed when persistence is unavailable",async()=>{
    mocks.rpc.mockResolvedValue({data:null,error:{message:"private SQL diagnostic"}});
    expect((await confirmNewsletter({token})).status).toBe(503);
    expect(mocks.enroll).not.toHaveBeenCalled();
  });
});
