import "server-only";
import { z } from "zod";

const unavailable = () => new Error("Newsletter provider unavailable.");
export type NewsletterProviderResult = { status: "confirmed"; contactId: string } | { status: "preferences_required" };
export type RecipientState = { blocked: boolean; contactId: string | null };

function configuration() {
  const apiKey = process.env.RESEND_NEWSLETTER_API_KEY?.trim();
  const segmentId = process.env.RESEND_NEWSLETTER_SEGMENT_ID?.trim();
  const topicId = process.env.RESEND_NEWSLETTER_TOPIC_ID?.trim();
  if (!apiKey || !z.uuid().safeParse(segmentId).success || !z.uuid().safeParse(topicId).success) throw unavailable();
  return { apiKey, segmentId: segmentId!, topicId: topicId! };
}

export function createNewsletterProvider({ sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve,ms)) }: { sleep?: (ms: number) => Promise<void> } = {}) {
  const config = configuration();
  let nextCallAt = 0;
  const request = async (path: string, method = "GET", body?: unknown, missingAllowed = false): Promise<Record<string,unknown> | null> => {
    // Resend's default request budget is small; avoid a burst within one sync.
    const delay = Math.max(0,nextCallAt-Date.now());
    if (delay) await sleep(delay);
    nextCallAt = Date.now()+550;
    let response: Response;
    try {
      response = await fetch("https://api.resend.com"+path, {
        method, headers: { Authorization: "Bearer "+config.apiKey, "Content-Type":"application/json" },
        ...(body === undefined ? {} : {body:JSON.stringify(body)}), cache:"no-store", signal:AbortSignal.timeout(5000),
      });
    } catch { throw unavailable(); }
    if (missingAllowed && response.status === 404) return null;
    if (!response.ok) throw unavailable();
    const value = await response.json().catch(()=>null);
    if (!value || typeof value !== "object" || Array.isArray(value)) throw unavailable();
    return value as Record<string,unknown>;
  };
  const inspect = async (email: string): Promise<RecipientState> => {
    const suppression = await request("/suppressions/"+encodeURIComponent(email),"GET",undefined,true);
    if (suppression) return {blocked:true,contactId:null};
    const contact = await request("/contacts/"+encodeURIComponent(email),"GET",undefined,true);
    if (!contact) return {blocked:false,contactId:null};
    if (typeof contact.id !== "string" || typeof contact.unsubscribed !== "boolean") throw unavailable();
    return {blocked:contact.unsubscribed,contactId:contact.id};
  };
  const enroll = async (email: string): Promise<NewsletterProviderResult> => {
    const recipient = await inspect(email);
    if (recipient.blocked) return {status:"preferences_required"};
    const topic = await request("/topics/"+encodeURIComponent(config.topicId));
    if (topic?.id !== config.topicId || topic.default_subscription !== "opt_out" || topic.visibility !== "public") throw unavailable();
    const segment = await request("/segments/"+encodeURIComponent(config.segmentId));
    if (segment?.id !== config.segmentId) throw unavailable();
    let contactId = recipient.contactId;
    if (!contactId) {
      // Only a confirmed, unsuppressed new contact may be created. No update
      // ever changes an existing contact's global unsubscribed flag.
      const created = await request("/contacts","POST",{email,unsubscribed:false});
      if (typeof created?.id !== "string") throw unavailable();
      contactId=created.id;
    }
    await request("/contacts/"+encodeURIComponent(contactId)+"/topics","PATCH",[{id:config.topicId,subscription:"opt_in"}]);
    await request("/contacts/"+encodeURIComponent(contactId)+"/segments/"+encodeURIComponent(config.segmentId),"POST");
    return {status:"confirmed",contactId};
  };
  return {inspect,enroll};
}
