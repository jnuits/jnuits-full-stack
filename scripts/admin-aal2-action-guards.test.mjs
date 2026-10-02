import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Server actions run as standalone POST endpoints: Next.js does not execute
 * page layouts during an action invocation, so an AAL2 requirement declared on
 * a layout (src/lib/admin/access.ts) protects only the rendered page. Any
 * privileged server action must therefore enforce its explicit operation policy
 * at its own mutation boundary, independent of a page/layout check.
 *
 * This suite is a source-scan regression guard for exactly that rule. It
 * cannot prove completeness by itself (a new privileged action needs a new
 * assertion here), but it makes silent removal of an existing guard fail CI.
 */

const readSource = (relativePath) =>
  readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("Admin server actions enforce operation verification at the action boundary", () => {
  it("saveAdminSecuritySettings requires step-up before touching global MFA enforcement", () => {
    const source = readSource("src/app/admin/settings/actions.ts");

    const fnStart = source.indexOf(
      "export async function saveAdminSecuritySettings"
    );
    expect(fnStart).toBeGreaterThanOrEqual(0);

    const fnEnd = source.indexOf("export async function", fnStart + 1);
    const fnBody = source.slice(
      fnStart,
      fnEnd === -1 ? source.length : fnEnd
    );

    expect(fnBody).toMatch(/authorizeAdminOperation\(\{\s*operation:\s*"admin.security.update"/);
    expect(fnBody).toContain('rpc("update_admin_security_verified"');
  });

  it("keeps every privileged admin-profiles lifecycle action behind step-up", () => {
    const source = readSource("src/app/admin/admin-profiles/actions.ts");

    for (const name of ["changeAdminRoleAction", "inviteAdminAction", "updateAdminLifecycleAction", "revokeAdminInvitationAction"]) {
      const start = source.indexOf(`export async function ${name}`);
      const end = source.indexOf("export async function", start + 1);
      const body = source.slice(start, end === -1 ? source.length : end);
      expect(start).toBeGreaterThanOrEqual(0);
      expect(body).toContain("authorizeAdminOperation(");
      if (name === "updateAdminLifecycleAction") {
        expect(body).toContain(".reserve(");
        expect(body).toContain('rpc("complete_admin_lifecycle_operation"');
        expect(body).toContain('rpc("apply_admin_role_operation"');
      } else {
        expect(body).toContain(name === "revokeAdminInvitationAction" ? 'rpc("revoke_admin_invitation_verified"' : 'rpc("apply_admin_role_operation"');
      }
    }
  });

  it("keeps the retention API behind step-up", () => {
    const source = readSource("src/app/api/admin/retention/route.ts");

    expect(source).toContain('operation: "admin.retention.read"');
    expect(source).toContain("authorizeAdminOperation(intent, verificationProof)");
    expect(source).toContain(".reserve(verified.value.prepared.actor, intent, verificationProof)");
    expect(readSource("src/lib/retention/operations.ts")).toContain('rpc("complete_admin_retention_operation"');
  });
});
