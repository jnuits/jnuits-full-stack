import type { AdminDeliveryState } from "./model";

type RetryInputs = {
  state: AdminDeliveryState;
  firstAttemptAt: string | null;
  leaseUntil: string | null;
  lastFailureKind: "configuration" | "rejected" | "rate_limited" | "uncertain" | null;
  hasUncertainOutcome: boolean;
  recipientEligible: boolean;
  payloadMatches: boolean;
  now: Date;
};

type RetryDecision = { allowed: true } | { allowed: false; reason: string };
const SAFE_RETRY_WINDOW_MS = (24 * 60 - 1) * 60_000;

/** Provider idempotency is bounded; durable application receipts own replay safety. */
export function evaluateDeliveryRetry(input: RetryInputs): RetryDecision {
  if (["accepted", "delivered", "suppressed"].includes(input.state)) {
    return { allowed: false, reason: "terminal" };
  }
  if (!input.recipientEligible) return { allowed: false, reason: "recipient_unavailable" };
  if (!input.payloadMatches) return { allowed: false, reason: "payload_changed" };
  const now = input.now.getTime();
  if (input.state === "sending" && input.leaseUntil && Date.parse(input.leaseUntil) > now) {
    return { allowed: false, reason: "lease_active" };
  }
  const uncertain = input.hasUncertainOutcome || input.state === "uncertain" || input.state === "sending";
  if (uncertain) {
    const first = input.firstAttemptAt === null ? NaN : Date.parse(input.firstAttemptAt);
    if (!Number.isFinite(now) || !Number.isFinite(first) || first > now || now - first >= SAFE_RETRY_WINDOW_MS) {
      return { allowed: false, reason: "reconciliation_required" };
    }
  }
  if (input.state === "failed" && input.lastFailureKind !== "rate_limited" && input.lastFailureKind !== "configuration") {
    return { allowed: false, reason: "permanent_failure" };
  }
  return { allowed: true };
}
