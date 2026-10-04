import "server-only";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import { getAppBaseUrl } from "@/lib/env";
import { verifyCaptchaToken } from "@/lib/security/captcha";
import { sendEmail } from "@/lib/notifications/send-email";
import { createAdminClient } from "@/lib/supabase/admin";
import { createNewsletterProvider } from "./provider";
import { buildNewsletterConfirmationEmail } from "./email";

export type NewsletterReply = { status: number; body: Record<string,string> };
const accepted: NewsletterReply={status:202,body:{message:"If eligible, check your email to confirm your newsletter subscription."}};
const unavailable: NewsletterReply={status:503,body:{error:"newsletter_unavailable"}};
const subscribeInput=z.object({
  email:z.string().trim().max(254).email().transform(value=>value.toLowerCase()),consent:z.literal(true),
  captchaToken:z.string().max(4096),website:z.string().max(200).optional().default(""),
});
const confirmInput=z.object({token:z.string().regex(/^[a-f0-9]{64}$/)});
const tokenHash=(token: string)=>createHash("sha256").update(token).digest("hex");

async function store(action: string,payload: Record<string,unknown>): Promise<Record<string,unknown>> {
  const {data,error}=await createAdminClient().rpc("newsletter_store",{p_action:action,p_payload:payload as never});
  if (error || !data || typeof data!=="object" || Array.isArray(data)) throw new Error("Newsletter persistence unavailable.");
  return data as Record<string,unknown>;
}

export async function subscribeNewsletter(input: unknown,ip: string): Promise<NewsletterReply> {
  const parsed=subscribeInput.safeParse(input);
  if (!parsed.success) return {status:400,body:{error:"invalid_input"}};
  if (parsed.data.website) return accepted;
  try {
    const captcha=await verifyCaptchaToken(parsed.data.captchaToken,ip);
    if (!captcha.ok) return {status:400,body:{error:"captcha_failed"}};
    const provider=createNewsletterProvider();
    if ((await provider.inspect(parsed.data.email)).blocked) return accepted;
    const token=randomBytes(32).toString("hex"),tokenId=randomUUID();
    const begun=await store("subscribe",{email:parsed.data.email,token_id:tokenId,token_hash:tokenHash(token)});
    if (begun.status==="ignored" || begun.status==="limited") return accepted;
    if (begun.status!=="send" || begun.token_id!==tokenId) return unavailable;
    const confirmationUrl=new URL("/newsletter/confirm",getAppBaseUrl());
    confirmationUrl.searchParams.set("token",token);
    const content=await buildNewsletterConfirmationEmail(confirmationUrl.toString());
    const delivery=await sendEmail({
      ...content,to:parsed.data.email,subject:"Confirm your JnUITS newsletter subscription",
      idempotencyKey:"newsletter-confirmation/"+tokenId,redactProviderErrors:true,
      providerApiKey:process.env.RESEND_NEWSLETTER_API_KEY,timeoutMs:5000,
    });
    const success=Boolean(delivery.success && delivery.messageId);
    await store("delivery",{token_id:tokenId,success,message_id:success?delivery.messageId:null});
    return success?accepted:unavailable;
  } catch { return unavailable; }
}

export async function confirmNewsletter(input: unknown): Promise<NewsletterReply> {
  const parsed=confirmInput.safeParse(input);
  if (!parsed.success) return {status:400,body:{error:"invalid_token"}};
  try {
    const attemptId=randomUUID();
    const prepared=await store("prepare",{token_hash:tokenHash(parsed.data.token),attempt_id:attemptId});
    if (prepared.status==="confirmed" || prepared.status==="preferences_required") return {status:200,body:{status:prepared.status}};
    if (prepared.status==="invalid_token") return {status:400,body:{error:"invalid_token"}};
    if (prepared.status==="expired_token") return {status:410,body:{error:"expired_token"}};
    if (prepared.status!=="ready" || typeof prepared.email!=="string" || typeof prepared.token_id!=="string" || typeof prepared.subscription_id!=="string") return unavailable;
    const payload={token_id:prepared.token_id,subscription_id:prepared.subscription_id,attempt_id:attemptId};
    let synchronization;
    try { synchronization=await createNewsletterProvider().enroll(prepared.email); }
    catch {
      await store("finish",{...payload,status:"pending"});
      return unavailable;
    }
    const finished=await store("finish",{...payload,status:synchronization.status,
      ...(synchronization.status==="confirmed"?{contact_id:synchronization.contactId}:{})});
    if (finished.status==="confirmed" || finished.status==="preferences_required") return {status:200,body:{status:finished.status}};
    return unavailable;
  } catch { return unavailable; }
}
