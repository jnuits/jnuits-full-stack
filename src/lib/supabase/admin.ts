import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";
import { getSupabaseAdminKey, getSupabaseUrl } from "@/lib/supabase/config";

export function createAdminClient() {
  return createClient<Database>(getSupabaseUrl(), getSupabaseAdminKey(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
