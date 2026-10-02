import "server-only";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { adminVerificationActorSchema } from "./actor";
import { parseAdminOperationIntent } from "./operations";
import { parseProofToken } from "./tokens";
import type { AdminOperationIntent, AdminVerificationActor, PreparedIntent, VerificationResult } from "./types";

type RpcClient = { rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }> };
const preparedSchema = z.strictObject({
  id: z.uuid(), actor: adminVerificationActorSchema,
  intent: z.custom<AdminOperationIntent>(value => parseAdminOperationIntent(value).ok),
  targetRef: z.string().min(1), payloadDigest: z.string().regex(/^[a-f0-9]{64}$/), policyRevision: z.string().min(1),
});
const proofSchema = z.strictObject({ proofId: z.uuid(), expiresAt: z.iso.datetime({ offset: true }) });

export class AdminVerificationStore {
  constructor(private readonly client: RpcClient = createAdminClient() as unknown as RpcClient) {}

  private async invoke<T>(command: string, input: Record<string, unknown>, schema: z.ZodType<T>): Promise<VerificationResult<T>> {
    try {
      const result = await this.client.rpc(`admin_verification_${command}`, { p_input: input });
      if (result.error) return { ok: false, code: "verification_unavailable" };
      const denied = z.object({ ok: z.literal(false), code: z.string().min(1) }).safeParse(result.data);
      if (denied.success) return denied.data;
      const parsed = z.object({ ok: z.literal(true), value: schema }).safeParse(result.data);
      return parsed.success ? parsed.data : { ok: false, code: "verification_unavailable" };
    } catch { return { ok: false, code: "verification_unavailable" }; }
  }

  async prepare(actor: AdminVerificationActor, intent: AdminOperationIntent): Promise<VerificationResult<PreparedIntent>> {
    const parsed = parseAdminOperationIntent(intent);
    if (!parsed.ok || !adminVerificationActorSchema.safeParse(actor).success) return { ok: false, code: "invalid_input" };
    return this.invoke("prepare", { actor, intent: parsed.value }, preparedSchema);
  }

  beginEmail(prepared: PreparedIntent, input: { challengeId: string; codeMac: string; keyId: string; ipHash: string }) {
    return this.invoke("begin_email", { prepared, ...input }, z.strictObject({ challengeId: z.uuid(), expiresAt: z.iso.datetime({ offset: true }) }));
  }

  async markEmailDelivery(challengeId: string, delivered: boolean): Promise<void> {
    const result = await this.invoke("mark_email_delivery", { challengeId, delivered }, z.null());
    if (!result.ok) throw new Error("Email delivery state could not be recorded.");
  }

  loadEmailChallenge(actor: AdminVerificationActor, challengeId: string): Promise<VerificationResult<PreparedIntent>> {
    return this.invoke("load_email_challenge", { actor, challengeId }, preparedSchema);
  }

  redeemEmail(actor: AdminVerificationActor, input: { challengeId: string; candidateMacs: string[]; tokenHash: string; ipHash: string }) {
    return this.invoke("redeem_email", { actor, ...input }, proofSchema);
  }

  reservePasswordAttempt(prepared: PreparedIntent, ipHash: string) {
    return this.invoke("reserve_password_attempt", { prepared, ipHash }, z.null());
  }

  issuePassword(prepared: PreparedIntent, tokenHash: string) {
    return this.invoke("issue_password", { prepared, tokenHash }, proofSchema);
  }

  reserve(actor: AdminVerificationActor, intent: AdminOperationIntent, token?: string) {
    const parsed = token ? parseProofToken(token) : undefined;
    if (token && !parsed) return Promise.resolve({ ok: false as const, code: "verification_invalid" });
    return this.invoke("reserve", { actor, intent, ...parsed }, z.strictObject({ attemptId: z.uuid() }));
  }

  checkRead(actor: AdminVerificationActor, intent: AdminOperationIntent, token: string) {
    const parsed = parseProofToken(token);
    return parsed ? this.invoke("check_read", { actor, intent, ...parsed }, z.null()) : Promise.resolve({ ok: false as const, code: "verification_invalid" });
  }

  checkWrite(actor: AdminVerificationActor, intent: AdminOperationIntent, token: string) {
    const parsed = parseProofToken(token);
    return parsed ? this.invoke("check_write", { actor, intent, ...parsed }, z.null()) : Promise.resolve({ ok: false as const, code: "verification_invalid" });
  }

  async recordEnrollment(userId: string, evidence: "confirmed_factor" | "trusted_never_history"): Promise<void> {
    const result = await this.invoke("record_enrollment", { userId, evidence }, z.null());
    if (!result.ok) throw new Error("Enrollment history could not be recorded.");
  }
}
