import "server-only";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { asFlexibleClient } from "@/lib/supabase/flexible";
import type { DeliveryClaim, DeliveryOutcome, FrozenAdminEmail } from "./delivery";

export const frozenAdminEmailSchema = z.strictObject({ from: z.literal("JnUITS <no-reply@jnuits.org.bd>"), replyTo: z.string().min(3).max(320).regex(/^[^\r\n]+$/),
  to: z.email().max(320), subject: z.string().min(1).max(200).regex(/^[^\r\n]+$/), html: z.string().max(60000), text: z.string().max(60000) });
const claimSchema = z.strictObject({ id: z.uuid(), claimToken: z.uuid(), idempotencyKey: z.string().min(1).max(256), payload: frozenAdminEmailSchema });

export class AdminDeliveryStore {
  constructor(private deadline: Date) {}
  async request(name: string, args: Record<string, unknown>) {
    const budget = this.deadline.getTime() - Date.now();
    if (!Number.isFinite(budget) || budget <= 0) throw new Error("Delivery budget expired");
    // The flexible RPC facade erases the native PostgREST request controls.
    const request = asFlexibleClient(createAdminClient()).rpc(name, args) as unknown as {
      abortSignal: (signal: AbortSignal) => PromiseLike<{data: unknown; error: unknown}>;
    };
    const { data, error } = await request.abortSignal(AbortSignal.timeout(Math.max(1, Math.min(5000, budget))));
    if (error) throw new Error("Delivery ledger unavailable");
    return data;
  }
  async candidates(leaseId: string, limit: number, channel: "security"|"recommendation"|null = null) {
    return z.array(z.uuid()).max(10).parse(await this.request("list_admin_notification_deliveries", { p_lease_id: z.uuid().parse(leaseId), p_limit: Math.max(0, Math.min(10, Math.trunc(limit))), ...(channel ? {p_channel:channel} : {}) }));
  }
  async claim(leaseId: string, id: string): Promise<DeliveryClaim | null> {
    const data = await this.request("claim_admin_notification_delivery", { p_id: z.uuid().parse(id), p_lease_id: z.uuid().parse(leaseId) });
    return data === null ? null : claimSchema.parse(data);
  }
  async validate(claim: DeliveryClaim, leaseId: string) {
    return await this.request("validate_admin_notification_delivery", { p_id: claim.id, p_claim_token: claim.claimToken, p_lease_id: leaseId }) === true;
  }
  async finish(claim: DeliveryClaim, outcome: DeliveryOutcome) {
    try {
      return await this.request("finish_admin_notification_delivery", { p_id: claim.id, p_claim_token: claim.claimToken, p_state: outcome.state,
        p_message_id: outcome.messageId || null, p_failure_kind: outcome.failureKind || null }) === true;
    } catch { return false; }
  }
}

export function frozenSenderMatches(payload: FrozenAdminEmail) {
  const from = process.env.RESEND_FROM_EMAIL;
  const replyTo = process.env.RESEND_REPLY_TO || from;
  return !!process.env.RESEND_API_KEY && payload.from === from && payload.replyTo === replyTo;
}

/** Read only: this never removes a suppression or edits a contact. */
export async function inspectAdminEmailSuppression(email: string, timeoutMs: number, { apiKey = process.env.RESEND_API_KEY, fetcher = fetch }: { apiKey?: string; fetcher?: typeof fetch } = {}) {
  if (!apiKey || !z.email().safeParse(email).success || !Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new Error("Suppression lookup unavailable");
  try {
    const response = await fetcher("https://api.resend.com/suppressions/" + encodeURIComponent(email), { method: "GET", headers: { Authorization: "Bearer " + apiKey },
      redirect: "error", cache: "no-store", signal: AbortSignal.timeout(Math.max(1, Math.min(5000, timeoutMs))) });
    if (response.status === 404) return false;
    if (response.ok) return true;
  } catch { /* No provider bodies, addresses or credentials in errors. */ }
  throw new Error("Suppression lookup unavailable");
}
