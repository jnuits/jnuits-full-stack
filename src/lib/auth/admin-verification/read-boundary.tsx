import "server-only";
import { cookies } from "next/headers";
import { authorizeAdminOperation, adminVerificationFailureMessage } from "./guard";
import { getAdminReadProofCookieName } from "./read-cookie";
import type { AdminReadOperation } from "./types";

const returnPaths: Record<AdminReadOperation, string> = {
  "admin.security.read": "/admin/settings/security",
  "admin.system_health.read": "/admin/system-health",
  "admin.retention.read": "/admin/retention",
};

/** Call before fetching data; a parent layout cannot protect child rendering. */
export async function authorizeAdminRead(operation: AdminReadOperation) {
  const name = getAdminReadProofCookieName(operation);
  if (!name) return { ok: false as const, code: "operation_invalid" };
  try {
    return await authorizeAdminOperation({operation, payload: {}}, (await cookies()).get(name)?.value);
  } catch { return {ok: false as const, code: "verification_unavailable"}; }
}

// Safe server-only shell. Task 5 adds the shared interactive email/dialog flow;
// no protected screen or data is rendered while that authorization is missing.
export function adminReadVerificationNotice(operation: AdminReadOperation, code: string) {
  const next = encodeURIComponent(returnPaths[operation]);
  return <section className="flash-panel grid gap-3" data-tone="warning" role="alert">
    <h1 className="text-lg font-semibold">Account verification required</h1>
    <p>{adminVerificationFailureMessage(code)}</p>
    <p className="section-copy">Protected information is hidden until your account is verified.</p>
    {code === "verification_required" || code === "verification_invalid" || code === "verification_expired" ? <div className="flex flex-wrap gap-3">
      <a className="admin-btn admin-btn--secondary" href={`/admin/mfa/setup?next=${next}`}>Set up authenticator</a>
      <a className="admin-btn admin-btn--primary" href={`/admin/mfa/challenge?next=${next}`}>Verify authenticator</a>
    </div> : null}
  </section>;
}
