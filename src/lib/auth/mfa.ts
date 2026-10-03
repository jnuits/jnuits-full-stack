import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";

export type AdminMFAState = {
  currentLevel: string | null;
  enforced: boolean;
  error: string | null;
  nextLevel: string | null;
  ok: boolean;
  redirectTo: "/admin/mfa/challenge" | "/admin/mfa/setup" | null;
};

async function isAdminTotpEnforced(supabase: SupabaseClient<Database>) {
  const { data, error } = await (supabase as never as {
    rpc: (
      fn: "is_admin_totp_enforced"
    ) => Promise<{ data: boolean | null; error: { message?: string } | null }>;
  }).rpc("is_admin_totp_enforced");

  return { enforced: data !== false, error: error || (typeof data !== "boolean" ? { message: "Security policy unavailable." } : null) };
}

export async function checkAdminMFA(
  supabase: SupabaseClient<Database>
): Promise<AdminMFAState> {
  const policy = await isAdminTotpEnforced(supabase);
  const enforced = policy.enforced;

  if (policy.error) {
    return {
      currentLevel: null,
      enforced,
      error: "Admin security policy could not be verified.",
      nextLevel: null,
      ok: false,
      redirectTo: "/admin/mfa/setup",
    };
  }

  const { data, error } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

  if (error) {
    return {
      currentLevel: null,
      enforced,
      error: error.message,
      nextLevel: null,
      ok: false,
      redirectTo: "/admin/mfa/setup",
    };
  }

  const currentLevel = data?.currentLevel ?? null;
  const nextLevel = data?.nextLevel ?? null;

  if (!["aal1", "aal2"].includes(currentLevel || "") || !["aal1", "aal2"].includes(nextLevel || "")) {
    return { currentLevel, nextLevel, enforced, error: "Session assurance could not be verified.", ok: false, redirectTo: "/admin/mfa/setup" };
  }

  // Entry is optional when the setting is off; this is not an action-level MFA proof.
  if (!enforced) return { currentLevel, nextLevel, enforced, error: null, ok: true, redirectTo: null };

  if (currentLevel === "aal2" && nextLevel === "aal2") {
    return {
      currentLevel,
      enforced,
      error: null,
      nextLevel,
      ok: true,
      redirectTo: null,
    };
  }

  return {
    currentLevel,
    enforced,
    error: null,
    nextLevel,
    ok: false,
    redirectTo:
      nextLevel === "aal2" ? "/admin/mfa/challenge" : "/admin/mfa/setup",
  };
}
