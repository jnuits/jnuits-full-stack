import "server-only";
import { createClient } from "@supabase/supabase-js";
import { isCaptchaConfigured, isCaptchaRequired } from "@/lib/security/captcha";
import { buildPasswordSignInPayload } from "@/lib/auth/password-sign-in";
import { getSupabasePublishableKey, getSupabaseUrl } from "@/lib/supabase/config";
import { loadAdminVerificationActor } from "./actor";
import { adminOperationRegistry, parseAdminOperationIntent } from "./operations";
import { AdminVerificationStore } from "./store";
import { createProofSecret, hashVerificationIp } from "./tokens";
import type { AdminOperationIntent, VerificationProof, VerificationResult } from "./types";

export async function verifyAdminRolePassword(intent: AdminOperationIntent, password: string, captchaToken: string, ip: string): Promise<VerificationResult<VerificationProof>> {
  try {
    const parsed = parseAdminOperationIntent(intent);
    if (!parsed.ok || adminOperationRegistry[parsed.value.operation].kind !== "admin_role" || !password || password.length > 4096) return { ok: false, code: "invalid_input" };
    const actor = await loadAdminVerificationActor();
    if (!actor.ok) return actor;
    if (actor.value.currentLevel !== "aal2") return { ok: false, code: "verification_required" };
    if (isCaptchaRequired()) {
      if (!isCaptchaConfigured()) return { ok: false, code: "verification_unavailable" };
      if (!captchaToken.trim()) return { ok: false, code: "captcha_required" };
    }
    const store = new AdminVerificationStore();
    const prepared = await store.prepare(actor.value, parsed.value);
    if (!prepared.ok) return prepared;
    const attempt = await store.reservePasswordAttempt(prepared.value, hashVerificationIp(ip));
    if (!attempt.ok) return attempt;
    const temporary = createClient(getSupabaseUrl(), getSupabasePublishableKey(), {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    });
    let verified = false;
    let cleaned = false;
    try {
      const result = await temporary.auth.signInWithPassword(buildPasswordSignInPayload({ email: actor.value.email, password, captchaToken }));
      verified = !result.error && result.data.user?.id === actor.value.userId;
    } catch { verified = false; }
    finally {
      try { cleaned = !(await temporary.auth.signOut({ scope: "local" })).error; }
      catch { cleaned = false; }
    }
    if (!verified) return { ok: false, code: "password_invalid" };
    if (!cleaned) return { ok: false, code: "verification_unavailable" };
    const secret = createProofSecret();
    // Fresh policy/permission/session are checked by issuance again after the
    // external password check; no original cookie/session is replaced here.
    const issued = await store.issuePassword(prepared.value, secret.hash);
    return issued.ok ? { ok: true, value: { token: `${issued.value.proofId}.${secret.secret}`, expiresAt: issued.value.expiresAt } } : issued;
  } catch { return { ok: false, code: "verification_unavailable" }; }
}
