import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { asFlexibleClient } from "@/lib/supabase/flexible";

export async function recordEventRegistrationDelivery(options: {
  eventId: string;
  idempotencyKey: string;
  providerMessageId?: string;
  registrationCode: string;
  status: "failed" | "sent";
}) {
  const admin = asFlexibleClient(createAdminClient());
  const { error } = await admin.from("event_registration_deliveries").upsert(
    {
      error_message: options.status === "failed" ? "provider_send_failed" : null,
      event_id: options.eventId,
      idempotency_key: options.idempotencyKey,
      provider_message_id: options.providerMessageId || null,
      registration_code: options.registrationCode,
      sent_at: options.status === "sent" ? new Date().toISOString() : null,
      status: options.status,
    },
    { onConflict: "idempotency_key" }
  );

  if (error) {
    throw error;
  }
}
