import "server-only";
import { getAuthContext, hasPermission, type AuthContext } from "@/lib/auth/session";
import { loadAdminVerificationActor } from "./actor";
import { adminOperationRegistry, parseAdminOperationIntent } from "./operations";
import { evaluateAdminVerification } from "./policy";
import { AdminVerificationStore } from "./store";
import type { AdminOperationIntent, PreparedIntent, VerificationResult } from "./types";

/** Preflight only. Mutations must consume/reserve again at their write boundary. */
export async function authorizeAdminOperation(
  intent: AdminOperationIntent, proofToken?: string
): Promise<VerificationResult<{ auth: AuthContext; prepared: PreparedIntent }>> {
  const parsed = parseAdminOperationIntent(intent);
  if (!parsed.ok) return parsed;
  const actor = await loadAdminVerificationActor();
  if (!actor.ok) return actor;
  const auth = await getAuthContext();
  if (auth.user?.id !== actor.value.userId) return { ok: false, code: "session_invalid" };
  const definition = adminOperationRegistry[parsed.value.operation];
  if (!await hasPermission(definition.permission)) return { ok: false, code: "permission_denied" };
  const decision = evaluateAdminVerification(actor.value, definition.kind);
  if (decision.status === "denied") return { ok: false, code: decision.code };
  const store = new AdminVerificationStore();
  if (decision.status === "required") {
    if (!proofToken || (!decision.methods.includes("email") && !decision.methods.includes("password"))) {
      return { ok: false, code: "verification_required" };
    }
    const checked = definition.kind === "protected_read"
      ? await store.checkRead(actor.value, parsed.value, proofToken)
      : await store.checkWrite(actor.value, parsed.value, proofToken);
    if (!checked.ok) return checked;
  }
  const prepared = await store.prepare(actor.value, parsed.value);
  return prepared.ok ? { ok: true, value: { auth, prepared: prepared.value } } : prepared;
}

export function adminVerificationFailureMessage(code: string): string {
  if (code === "permission_denied") return "You do not have permission for this operation.";
  if (code === "session_invalid" || code === "role_version_stale") return "Your session is out of date. Log out and sign in again before verifying your account.";
  if (code === "verification_required") return "Verify your account before completing this operation.";
  if (code === "verification_invalid" || code === "verification_expired") return "Verification expired or the details changed. Verify again.";
  return "Your account could not be verified. Refresh and try again.";
}
