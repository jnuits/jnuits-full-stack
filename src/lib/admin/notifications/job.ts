import "server-only";
import { z } from "zod";
import { sendEmail } from "@/lib/notifications/send-email";
import { loadAdminRecommendationInputs } from "@/lib/admin/recommendation-inputs";
import { adminDigestMonthKey, buildAdminRecommendations } from "@/lib/admin/recommendations";
import { AdminDeliveryStore, frozenSenderMatches, inspectAdminEmailSuppression } from "./delivery-store";
import { deliverAdminNotifications } from "./delivery";
import { buildAdminSecurityEmail, buildAdminRecommendationsEmail } from "./security-email";

const batchSchema = z.object({ enabled: z.boolean(), digestEnd: z.boolean(),
  notices: z.array(z.object({ id: z.uuid(), recipientUserId: z.uuid(), email: z.email(), title: z.string().max(160), summary: z.string().max(512),
    actorLabel: z.string().max(200), occurredAt: z.iso.datetime({offset:true}) })).max(500),
  subjects: z.array(z.object({userId:z.uuid(),email:z.email()})).max(100) });
const collectionSchema = z.object({read:z.number().int().min(0).max(500),created:z.number().int().nonnegative(),backlog:z.boolean()});

/** Extends the one leased daily job; collection and email activation remain independent. */
export async function runAdminNotificationWork({leaseId,now,dryRun,deadline}: {leaseId:string;now:Date;dryRun:boolean;deadline:Date}) {
  const result = {notices:0,sends:0,digests:0,backlog:false,errors:[] as string[]};
  if (!Number.isFinite(deadline.getTime()) || deadline.getTime() <= Date.now()) { result.errors.push("notification_deadline_reached"); return result; }
  const store = new AdminDeliveryStore(deadline);
  try {
    const collected = collectionSchema.parse(await store.request("collect_admin_security_notices", {p_limit:500,p_dry_run:dryRun,p_lease_id:leaseId}));
    result.notices=collected.created; result.backlog=collected.backlog;
    if (dryRun) return result;
    const month = adminDigestMonthKey(now);
    const batch = batchSchema.parse(await store.request("get_admin_notification_batch", {p_lease_id:leaseId,p_month:month,p_account_limit:100,p_notice_limit:500}));
    if (!batch.enabled) return result;
    result.backlog ||= !batch.digestEnd;
    const from = process.env.RESEND_FROM_EMAIL;
    const replyTo = process.env.RESEND_REPLY_TO || from;
    if (from !== "JnUITS <no-reply@jnuits.org.bd>" || !replyTo || !process.env.RESEND_API_KEY) throw new Error("configuration_unavailable");
    for (const notice of batch.notices) {
      if (Date.now() >= deadline.getTime()) { result.backlog=true;break; }
      const email = buildAdminSecurityEmail(notice);
      await store.request("queue_admin_notice_email", {p_notice_id:notice.id,p_payload:{...email,from,replyTo,to:notice.email}});
    }
    const pacing={nextProviderCall:0};
    const deliverPhase=(channel:"security"|"recommendation",maxSends:number)=>deliverAdminNotifications({leaseId,maxSends,deadline,pacing}, {
      now:Date.now,sleep:ms=>new Promise(resolve=>setTimeout(resolve,ms)),
      candidates:(lease,limit)=>store.candidates(lease,limit,channel),claim:(lease,id)=>store.claim(lease,id),validate:claim=>store.validate(claim,leaseId),
      inspectSuppression:inspectAdminEmailSuppression,senderMatches:frozenSenderMatches,send:sendEmail,finish:(claim,outcome)=>store.finish(claim,outcome),
    });
    // Security gets its opportunity before optional account evaluation/checkpoints.
    const security=await deliverPhase("security",10);
    result.sends=security.accepted;result.errors.push(...security.errors);
    if(security.errors.length)return result;
    const remaining=Math.max(0,10-security.attempted);
    for (let index=0;index<batch.subjects.length;index++) {
      if (Date.now() >= deadline.getTime()) { result.backlog=true;break; }
      const subject = batch.subjects[index];
      const inputs = await loadAdminRecommendationInputs(subject.userId,now,true,deadline);
      if (!inputs) { result.errors.push("recommendation_inputs_unavailable");break; }
      const recommendations = buildAdminRecommendations(inputs);
      if (recommendations.length) {
        const email = buildAdminRecommendationsEmail(recommendations,month);
        const queued = await store.request("queue_admin_recommendation_email", {p_subject:subject.userId,p_month:month,p_payload:{...email,from,replyTo,to:subject.email},p_rubric:1,p_recommendation_ids:recommendations.map(item=>item.id)});
        if (typeof queued === "string") result.digests++;
      }
      await store.request("advance_admin_digest_cursor", {p_lease_id:leaseId,p_month:month,p_subject:subject.userId,p_reset:batch.digestEnd&&index===batch.subjects.length-1});
    }
    if(remaining>0&&Date.now()<deadline.getTime()) {
      const delivery=await deliverPhase("recommendation",remaining);
      result.sends+=delivery.accepted;result.errors.push(...delivery.errors);
    }
  } catch { result.errors.push("notification_work_unavailable"); }
  return result;
}
