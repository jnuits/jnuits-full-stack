import "server-only";
import { createHash, randomInt, randomUUID } from "node:crypto";
import { z } from "zod";
import { buildAdminVerificationEmail } from "@/lib/notifications/email-builders";
import { sendEmail } from "@/lib/notifications/send-email";
import { getApplicationMacKey, getApplicationMacKeys } from "@/lib/supabase/config";
import { loadAdminVerificationActor } from "./actor";
import { adminOperationRegistry, parseAdminOperationIntent } from "./operations";
import { evaluateAdminVerification } from "./policy";
import { AdminVerificationStore } from "./store";
import { createEmailCodeMac, createProofSecret, hashVerificationIp } from "./tokens";
import type { AdminOperation, AdminOperationIntent, VerificationDecision, VerificationProof, VerificationResult } from "./types";

export async function prepareAdminVerification(intent: AdminOperationIntent): Promise<VerificationResult<{ decision: VerificationDecision }>> {
  try {
    const parsed = parseAdminOperationIntent(intent);
    if (!parsed.ok) return parsed;
    const actor = await loadAdminVerificationActor();
    if (!actor.ok) return actor;
    const prepared = await new AdminVerificationStore().prepare(actor.value, parsed.value);
    if (!prepared.ok) return prepared;
    return { ok: true, value: { decision: evaluateAdminVerification(prepared.value.actor, adminOperationRegistry[parsed.value.operation].kind) } };
  } catch { return { ok: false, code: "verification_unavailable" }; }
}

export async function requestAdminEmailVerification(intent: AdminOperationIntent, ip: string): Promise<VerificationResult<{ challengeId: string; expiresAt: string }>> {
  try {
    const parsed = parseAdminOperationIntent(intent);
    if (!parsed.ok) return parsed;
    const actor = await loadAdminVerificationActor();
    if (!actor.ok) return actor;
    const store = new AdminVerificationStore();
    const prepared = await store.prepare(actor.value, parsed.value);
    if (!prepared.ok) return prepared;
    const definition = adminOperationRegistry[parsed.value.operation];
    const decision = evaluateAdminVerification(prepared.value.actor, definition.kind);
    if (decision.status !== "required" || !decision.methods.includes("email")) return { ok: false, code: "verification_required" };
    const challengeId = randomUUID();
    const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
    const key = getApplicationMacKey();
    const started = await store.beginEmail(prepared.value, {
      challengeId, codeMac: createEmailCodeMac(prepared.value, challengeId, code, key),
      keyId: createHash("sha256").update(key).digest("hex").slice(0, 16), ipHash: hashVerificationIp(ip),
    });
    if (!started.ok) return started;
    const delivery = await sendEmail({
      to: prepared.value.actor.email, subject: "Verify your JnUITS admin action",
      html: buildAdminVerificationEmail({ code, operationLabel: definition.label, expiresInMinutes: 5 }),
      idempotencyKey: `admin-verification/${challengeId}`, redactProviderErrors: true,
    });
    await store.markEmailDelivery(challengeId, delivery.success);
    return delivery.success ? started : { ok: false, code: "delivery_failed" };
  } catch { return { ok: false, code: "verification_unavailable" }; }
}

// The API uses this immutable server-resolved read scope to set an HttpOnly
// cookie. It never accepts a scope from the browser or puts scope in the proof.
export async function verifyAdminEmailCodeWithScope(challengeId: string, code: string, ip: string): Promise<VerificationResult<{ proof: VerificationProof; readOperation?: AdminOperation }>> {
  if (!z.uuid().safeParse(challengeId).success || !/^\d{6}$/.test(code)) return { ok: false, code: "invalid_input" };
  try {
    const actor = await loadAdminVerificationActor();
    if (!actor.ok) return actor;
    const store = new AdminVerificationStore();
    const prepared = await store.loadEmailChallenge(actor.value, challengeId);
    if (!prepared.ok) return prepared;
    const secret = createProofSecret();
    const redeemed = await store.redeemEmail(actor.value, {
      challengeId, candidateMacs: getApplicationMacKeys().map(key => createEmailCodeMac(prepared.value, challengeId, code, key)),
      tokenHash: secret.hash, ipHash: hashVerificationIp(ip),
    });
    if (!redeemed.ok) return redeemed;
    const operation = prepared.value.intent.operation;
    return { ok: true, value: {
      proof: { token: `${redeemed.value.proofId}.${secret.secret}`, expiresAt: redeemed.value.expiresAt },
      ...(adminOperationRegistry[operation].kind === "protected_read" ? { readOperation: operation } : {}),
    } };
  } catch { return { ok: false, code: "verification_unavailable" }; }
}

export async function verifyAdminEmailCode(challengeId: string, code: string, ip: string): Promise<VerificationResult<VerificationProof>> {
  const result = await verifyAdminEmailCodeWithScope(challengeId, code, ip);
  return result.ok ? { ok: true, value: result.value.proof } : result;
}
