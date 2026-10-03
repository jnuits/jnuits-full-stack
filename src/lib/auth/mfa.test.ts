import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";
import { checkAdminMFA } from "./mfa";

function client(enforced: boolean | null, currentLevel: string | null, nextLevel: string | null, failure?: "policy" | "assurance") {
  return {
    rpc: async () => ({ data: enforced, error: failure === "policy" ? { message: "unavailable" } : null }),
    auth: { mfa: { getAuthenticatorAssuranceLevel: async () => ({
      data: { currentLevel, nextLevel, currentAuthenticationMethods: [] },
      error: failure === "assurance" ? { message: "unavailable" } : null,
    }) } },
  } as unknown as SupabaseClient<Database>;
}

describe("admin workspace entry and actual assurance", () => {
  it("reports voluntary verified MFA even when enforcement is disabled", async () => {
    expect(await checkAdminMFA(client(false, "aal2", "aal2"))).toMatchObject({ ok: true, enforced: false, currentLevel: "aal2", nextLevel: "aal2" });
  });
  it("permits ordinary workspace entry without pretending AAL1 is MFA", async () => {
    expect(await checkAdminMFA(client(false, "aal1", "aal1"))).toMatchObject({ ok: true, currentLevel: "aal1", redirectTo: null });
  });
  it("requires a challenge when mandatory MFA is enabled for an enrolled AAL1 session", async () => {
    expect(await checkAdminMFA(client(true, "aal1", "aal2"))).toMatchObject({ ok: false, redirectTo: "/admin/mfa/challenge" });
  });
  it("requires setup when mandatory MFA is enabled without enrollment", async () => {
    expect(await checkAdminMFA(client(true, "aal1", "aal1"))).toMatchObject({ ok: false, redirectTo: "/admin/mfa/setup" });
  });
  it.each(["policy", "assurance"] as const)("fails closed for %s outage even when enforcement was disabled", async (failure) => {
    expect(await checkAdminMFA(client(false, "aal2", "aal2", failure))).toMatchObject({ ok: false });
  });
  it("does not authorize when policy or session assurance is absent", async () => {
    expect((await checkAdminMFA(client(null, "aal2", "aal2"))).ok).toBe(false);
    expect((await checkAdminMFA(client(false, null, null))).ok).toBe(false);
  });
  it("accepts a genuinely verified mandatory MFA session", async () => {
    expect((await checkAdminMFA(client(true, "aal2", "aal2"))).ok).toBe(true);
  });
});
