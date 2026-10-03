import "server-only";
import { z } from "zod";
import { checkAdminMFA } from "@/lib/auth/mfa";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AdminVerificationActor, VerificationResult } from "./types";

export const adminVerificationActorSchema = z.strictObject({
  userId: z.uuid(), sessionId: z.uuid(), email: z.email(), emailConfirmed: z.boolean(),
  roleVersion: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER), currentLevel: z.enum(["aal1", "aal2"]),
  enforced: z.boolean(), enrollment: z.enum(["never", "enrolled", "unknown"]),
});

export async function loadAdminVerificationActor(): Promise<VerificationResult<AdminVerificationActor>> {
  try {
    const client = await createClient();
    const userResult = await client.auth.getUser();
    const user = userResult.data.user;
    if (userResult.error || !user?.id || !user.email) return { ok: false, code: "session_invalid" };
    const claimsResult = await client.auth.getClaims();
    const claims = claimsResult.data?.claims;
    if (claimsResult.error || claims?.sub !== user.id || !z.uuid().safeParse(claims?.session_id).success
      || !z.number().int().nonnegative().safeParse(claims?.jnuits_role_version).success) return { ok: false, code: "session_invalid" };
    const mfa = await checkAdminMFA(client);
    if (mfa.error || !mfa.currentLevel || mfa.currentLevel !== claims.aal) return { ok: false, code: "verification_unavailable" };
    const admin = createAdminClient() as unknown as { rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }> };
    const readContext = async (): Promise<VerificationResult<AdminVerificationActor>> => {
      const result = await admin.rpc("admin_verification_context", { p_input: {
        userId: user.id, sessionId: claims.session_id, roleVersion: claims.jnuits_role_version, currentLevel: mfa.currentLevel,
      } });
      if (result.error) return { ok: false, code: "verification_unavailable" };
      const envelope = z.object({ ok: z.literal(false), code: z.string() }).safeParse(result.data);
      if (envelope.success) return envelope.data;
      const parsed = z.object({ ok: z.literal(true), value: adminVerificationActorSchema }).safeParse(result.data);
      if (!parsed.success) return { ok: false, code: "verification_unavailable" };
      const actor = parsed.data.value;
      if (actor.userId !== user.id || actor.sessionId !== claims.session_id || actor.roleVersion !== claims.jnuits_role_version
        || actor.currentLevel !== mfa.currentLevel || actor.enforced !== mfa.enforced || actor.email !== user.email
        || actor.emailConfirmed !== Boolean(user.email_confirmed_at)) return { ok: false, code: "verification_invalid" };
      return { ok: true, value: actor };
    };
    const resolved = await readContext();
    if (!resolved.ok || resolved.value.enrollment !== "unknown") return resolved;
    // Only Postgres may establish never-enrolled evidence: it checks its own
    // cutover timestamp, Auth factor/audit history and sticky prior enrollment.
    // A legacy account's absence of factors is deliberately insufficient.
    const evidence = await admin.rpc("admin_verification_record_enrollment", { p_input: { userId: user.id, evidence: "trusted_never_history" } });
    if (evidence.error) return { ok: false, code: "verification_unavailable" };
    if (z.object({ ok: z.literal(false), code: z.literal("enrollment_evidence_invalid") }).safeParse(evidence.data).success) return resolved;
    if (!z.strictObject({ ok: z.literal(true), value: z.null() }).safeParse(evidence.data).success) return { ok: false, code: "verification_unavailable" };
    return readContext(); // Recheck every actor binding after trusted discovery.
  } catch { return { ok: false, code: "verification_unavailable" }; }
}
