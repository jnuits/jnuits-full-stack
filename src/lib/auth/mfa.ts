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

  if (error) {
    return true;
  }

  return data !== false;
}

export async function checkAdminMFA(
  supabase: SupabaseClient<Database>
): Promise<AdminMFAState> {
  const enforced = await isAdminTotpEnforced(supabase);

  if (!enforced) {
    return {
      currentLevel: null,
      enforced,
      error: null,
      nextLevel: null,
      ok: true,
      redirectTo: null,
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
