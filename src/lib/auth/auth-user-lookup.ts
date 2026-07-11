import "server-only";

import type { User } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { asFlexibleClient } from "@/lib/supabase/flexible";

type AdminClient = ReturnType<typeof createAdminClient>;

type AuthUserLookupError = {
  message?: string;
};

function normalizeEmail(value: null | string | undefined) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export async function findAuthUserByEmail(
  admin: AdminClient,
  email: string,
): Promise<User | null> {
  const targetEmail = normalizeEmail(email);

  if (!targetEmail) {
    return null;
  }

  const { data: userId, error: lookupError } = await asFlexibleClient(admin).rpc(
    "find_auth_user_id_by_email",
    { target_email: targetEmail },
  ) as {
    data: string | null;
    error: AuthUserLookupError | null;
  };

  if (lookupError) {
    throw new Error(lookupError.message || "Auth email lookup failed.");
  }

  if (typeof userId !== "string" || !userId) {
    return null;
  }

  const { data, error } = await admin.auth.admin.getUserById(userId);

  if (error) {
    throw error;
  }

  return data.user || null;
}