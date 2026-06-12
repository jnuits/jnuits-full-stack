import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";
import {
  getSupabasePublishableKey,
  getSupabaseUrl,
} from "@/lib/supabase/config";

export function createPublicClient() {
  return createClient<Database>(getSupabaseUrl(), getSupabasePublishableKey(), {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}
