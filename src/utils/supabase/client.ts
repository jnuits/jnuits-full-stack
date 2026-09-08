import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/db/types";
import { getSupabasePublishableKey, getSupabaseUrl } from "@/lib/supabase/config";

export function createClient() {
  return createBrowserClient<Database>(
    getSupabaseUrl(),
    getSupabasePublishableKey(),
    {
      cookieOptions: {
        // Keep browser-side auth cookies off plaintext HTTP in production.
        secure: process.env.NODE_ENV === "production",
      },
    }
  );
}
