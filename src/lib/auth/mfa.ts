import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";

export type AdminMFAState = {
  currentLevel: string | null;
  error: string | null;
  nextLevel: string | null;
  ok: boolean;
  redirectTo: "/admin/mfa/challenge" | "/admin/mfa/setup" | null;
};

export async function checkAdminMFA(
  supabase: SupabaseClient<Database>
): Promise<AdminMFAState> {
  const { data, error } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

  if (error) {
    return {
      currentLevel: null,
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
      error: null,
      nextLevel,
      ok: true,
      redirectTo: null,
    };
  }

  return {
    currentLevel,
    error: null,
    nextLevel,
    ok: false,
    redirectTo:
      nextLevel === "aal2" ? "/admin/mfa/challenge" : "/admin/mfa/setup",
  };
}
