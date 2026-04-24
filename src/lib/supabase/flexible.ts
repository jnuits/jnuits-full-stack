import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";

export type FlexibleSupabaseClient = SupabaseClient<Database> & {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (relation: string) => any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<any>;
};

export function asFlexibleClient<T extends SupabaseClient<Database>>(
  client: T
) {
  return client as unknown as FlexibleSupabaseClient;
}
