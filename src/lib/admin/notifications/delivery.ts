import type { SendEmailResult } from "@/lib/notifications/send-email";
import type { AdminDeliveryState } from "./model";

export type FrozenAdminEmail = { from: string; replyTo: string; to: string; subject: string; html: string; text: string };
export type DeliveryClaim = { id: string; claimToken: string; idempotencyKey: string; payload: FrozenAdminEmail };
export type DeliveryOutcome = { state: Extract<AdminDeliveryState, "accepted" | "suppressed" | "failed" | "uncertain">; messageId?: string; failureKind?: SendEmailResult["failureKind"] };
export type DeliveryDependencies = {
  now: () => number;
  sleep: (ms: number) => Promise<void>;
  candidates: (leaseId: string, limit: number) => Promise<string[]>;
  claim: (leaseId: string, id: string) => Promise<DeliveryClaim | null>;
  validate: (claim: DeliveryClaim) => Promise<boolean>;
  inspectSuppression: (email: string, timeoutMs: number) => Promise<boolean>;
  senderMatches: (payload: FrozenAdminEmail) => boolean;
  send: (input: FrozenAdminEmail & {idempotencyKey: string; timeoutMs: number; redactProviderErrors: true}) => Promise<SendEmailResult>;
  finish: (claim: DeliveryClaim, outcome: DeliveryOutcome) => Promise<boolean>;
};

/** Claims/retry eligibility are atomic in the store; this layer never retries business actions. */
export async function deliverAdminNotifications({leaseId, maxSends = 10, deadline, pacing = {nextProviderCall:0}}: {leaseId: string; maxSends?: number; deadline: Date; pacing?: {nextProviderCall:number}}, deps: DeliveryDependencies) {
  const result = { attempted: 0, accepted: 0, suppressed: 0, failed: 0, uncertain: 0, errors: [] as string[] };
  const end = deadline.getTime();
  const limit = Number.isFinite(maxSends) ? Math.max(0, Math.min(10, Math.trunc(maxSends))) : 0;
  if (!Number.isFinite(end) || end <= deps.now() || limit === 0) return result;
  const pace = async () => {
    const delay = Math.max(0, pacing.nextProviderCall - deps.now());
    if (deps.now() + delay >= end) throw new Error("deadline_reached");
    if (delay) await deps.sleep(delay);
    if (deps.now() >= end) throw new Error("deadline_reached");
    pacing.nextProviderCall = deps.now() + 1000;
  };
  try {
    const ids = [...new Set(await deps.candidates(leaseId, limit))].slice(0, limit);
    for (const id of ids) {
      if (deps.now() >= end) break;
      const claim = await deps.claim(leaseId, id);
      if (!claim) continue;
      let outcome: DeliveryOutcome;
      let sendStarted = false;
      try {
        if (!deps.senderMatches(claim.payload)) outcome = { state: "failed", failureKind: "rejected" };
        else {
          await pace();
          const suppressed = await deps.inspectSuppression(claim.payload.to, Math.max(1, Math.min(5000, end - deps.now())));
          if (suppressed) outcome = { state: "suppressed" };
          else {
            await pace();
            if (!await deps.validate(claim)) outcome = { state: "suppressed" };
            else {
              if (deps.now() >= end) throw new Error("deadline_reached");
              sendStarted = true;
              result.attempted++;
              const response = await deps.send({ ...claim.payload, idempotencyKey: claim.idempotencyKey, redactProviderErrors: true,
                timeoutMs: Math.max(1, Math.min(5000, end - deps.now())) });
              outcome = response.success && response.messageId ? { state: "accepted", messageId: response.messageId }
                : response.failureKind === "uncertain" || response.success ? { state: "uncertain", failureKind: "uncertain" }
                : { state: "failed", failureKind: response.failureKind || "uncertain" };
              if (outcome.failureKind === "uncertain") outcome.state = "uncertain";
            }
          }
        }
      } catch {
        outcome = sendStarted ? { state: "uncertain", failureKind: "uncertain" } : { state: "failed", failureKind: "configuration" };
      }
      let persisted = false;
      try { persisted = await deps.finish(claim, outcome); } catch { /* The leased durable row remains uncertain. */ }
      if (!persisted) { result.uncertain++; result.errors.push("receipt_unavailable"); break; }
      result[outcome.state]++;
    }
  } catch { result.errors.push("delivery_unavailable"); }
  return result;
}
