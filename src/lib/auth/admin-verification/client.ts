import { z } from "zod";
import { parseAdminOperationIntent } from "./operations";
import type { AdminOperationIntent, VerificationResult } from "./types";

export const verificationDecisionResponse = z.object({
  decision: z.discriminatedUnion("status", [
    z.object({ status: z.literal("allowed") }),
    z.object({ status: z.literal("denied"), code: z.string() }),
    z.object({ status: z.literal("required"), methods: z.array(z.enum(["totp", "email", "password"])).min(1) }),
  ]),
  captcha: z.object({ required: z.boolean(), siteKey: z.string() }).optional(),
});
export const verificationProofResponse = z.object({ token: z.string().regex(/^[0-9a-f-]{36}\.[A-Za-z0-9_-]{43}$/i), expiresAt: z.iso.datetime({ offset: true }) });
export const emailChallengeResponse = z.object({ challengeId: z.uuid(), expiresAt: z.iso.datetime({ offset: true }) });

export async function requestAdminVerification<T>(body: Record<string, unknown>, schema: z.ZodType<T>): Promise<VerificationResult<T>> {
  try {
    const response = await fetch("/api/admin/verification", { method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store", body: JSON.stringify(body) });
    const data: unknown = await response.json();
    const denied = z.object({ ok: z.literal(false), code: z.string() }).safeParse(data);
    if (denied.success) return denied.data;
    const result = z.object({ ok: z.literal(true), value: schema }).safeParse(data);
    return response.ok && result.success ? result.data : { ok: false, code: "verification_unavailable" };
  } catch { return { ok: false, code: "verification_unavailable" }; }
}

export function adminVerificationUiMessage(code: string) {
  if (code === "delivery_failed") return "We could not send the email code. Try again later or use your authenticator.";
  if (code === "rate_limited") return "Too many attempts. Please wait before trying again.";
  if (code === "permission_denied") return "You do not have permission for this operation.";
  if (code === "password_invalid") return "Your password was not accepted. Check it and try again.";
  if (["verification_invalid", "verification_expired", "code_invalid"].includes(code)) return "The code expired or was not accepted. Check it or request a new code.";
  if (code === "invalid_input" || code === "operation_invalid") return "Check the form details and confirmation before continuing.";
  return "Your account could not be verified. Refresh or try again later.";
}

/** Bind verification to the immutable submitted values, not an earlier render. */
export function captureAdminFormIntent(intent: AdminOperationIntent, form: FormData) {
  const payload = { ...intent.payload };
  for (const key of Object.keys(payload)) {
    const value = form.get(key);
    if (typeof value === "string") payload[key] = value;
  }
  if (intent.operation === "admin.security.update") payload.adminTotpEnforced = form.get("adminTotpEnforced") === "true";
  return parseAdminOperationIntent({ operation: intent.operation, payload });
}
