import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";
import { asFlexibleClient } from "@/lib/supabase/flexible";

type SecuritySeverity = "critical" | "info" | "warning";

export async function recordSecurityEvent(
  admin: SupabaseClient<Database>,
  event: {
    actorUserId?: null | string;
    eventType: string;
    payload?: Record<string, unknown>;
    severity?: SecuritySeverity;
    targetUserId?: null | string;
  }
) {
  await asFlexibleClient(admin).from("security_events").insert({
    actor_user_id: event.actorUserId ?? null,
    event_type: event.eventType,
    payload: event.payload ?? {},
    severity: event.severity ?? "info",
    target_user_id: event.targetUserId ?? event.actorUserId ?? null,
  });
}
