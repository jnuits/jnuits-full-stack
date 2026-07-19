import { NextResponse } from "next/server";

import { logServerError } from "@/lib/errors/api-error";
import { verifyResendWebhook } from "@/lib/notifications/resend-webhook";
import { asFlexibleClient } from "@/lib/supabase/flexible";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const DELIVERY_STATUS_BY_EVENT_TYPE: Record<string, null | string> = {
  "email.bounced": "bounced",
  "email.complained": "complained",
  "email.delivered": "delivered",
  "email.delivery_delayed": "delayed",
  "email.failed": "failed",
  "email.sent": "sent",
};

export async function POST(request: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "Delivery webhook is not configured." },
      { status: 503 }
    );
  }

  let event;
  try {
    const payload = await request.text();
    event = verifyResendWebhook({
      headers: {
        "svix-id": request.headers.get("svix-id"),
        "svix-signature": request.headers.get("svix-signature"),
        "svix-timestamp": request.headers.get("svix-timestamp"),
      },
      payload,
      secret,
    });
  } catch {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 400 });
  }

  try {
    const admin = asFlexibleClient(createAdminClient());
    const args = {
      p_delivery_status: DELIVERY_STATUS_BY_EVENT_TYPE[event.type] ?? null,
      p_event_type: event.type,
      p_occurred_at: event.createdAt,
      p_provider_event_id: event.eventId,
      p_provider_message_id: event.providerMessageId,
    };
    const invitation = await admin.rpc(
      "record_invitation_delivery_webhook_event",
      args
    );

    if (invitation.error) {
      throw new Error("Delivery webhook ledger write failed.");
    }

    let result = Array.isArray(invitation.data)
      ? invitation.data[0]
      : invitation.data;

    if (!result?.tracked) {
      const formConfirmation = await admin.rpc(
        "record_form_confirmation_delivery_webhook_event",
        args
      );
      if (formConfirmation.error) {
        throw new Error("Delivery webhook ledger write failed.");
      }
      result = Array.isArray(formConfirmation.data)
        ? formConfirmation.data[0]
        : formConfirmation.data;
    }
    if (!result?.tracked) {
      const eventRegistration = await admin.rpc(
        "record_event_registration_delivery_webhook_event",
        args
      );
      if (eventRegistration.error) {
        throw new Error("Delivery webhook ledger write failed.");
      }
      result = Array.isArray(eventRegistration.data)
        ? eventRegistration.data[0]
        : eventRegistration.data;
    }
    return NextResponse.json({
      duplicate: Boolean(result?.duplicate),
      received: true,
      tracked: Boolean(result?.tracked),
    });
  } catch {
    logServerError(
      "Resend delivery webhook persistence",
      new Error("Delivery webhook ledger write failed.")
    );
    return NextResponse.json(
      { error: "Unable to record delivery event." },
      { status: 500 }
    );
  }
}
