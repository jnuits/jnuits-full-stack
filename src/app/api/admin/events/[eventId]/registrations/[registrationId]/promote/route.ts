import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApiPermission } from "@/lib/admin/api-auth";
import { resolveEventForAdminMutation } from "@/lib/content/events";
import { recordEventRegistrationDelivery } from "@/lib/events/delivery";
import { buildEventConfirmationEmail } from "@/lib/notifications/email-builders";
import { logServerError } from "@/lib/errors/api-error";
import { sendEmail } from "@/lib/notifications/send-email";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import { withApiGuard } from "@/lib/security/with-api-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { asFlexibleClient } from "@/lib/supabase/flexible";

const registrationIdSchema = z.string().uuid();

type PromotionResult = {
  registration_code: null | string;
  result_status: string;
};

function getRouteIdentifiers(request: Request) {
  const segments = new URL(request.url).pathname.split("/");
  const eventIndex = segments.indexOf("events");
  const registrationIndex = segments.indexOf("registrations");

  return {
    eventIdentifier: segments[eventIndex + 1] || "",
    registrationId: segments[registrationIndex + 1] || "",
  };
}

export const POST = withApiGuard(
  async (request) => {
    const permission = await requireAdminApiPermission("cms.events.manage", {
      forbiddenMessage: "Only event managers can promote waitlisted registrations.",
      unauthenticatedMessage: "Sign in before managing event registrations.",
    });

    if (permission.response) {
      return permission.response;
    }

    const { eventIdentifier, registrationId } = getRouteIdentifiers(request);
    const parsedRegistrationId = registrationIdSchema.safeParse(registrationId);

    if (!eventIdentifier || !parsedRegistrationId.success) {
      return NextResponse.json(
        { error: "Invalid event registration identifier." },
        { status: 400 }
      );
    }

    const event = await resolveEventForAdminMutation(eventIdentifier);

    if (!event) {
      return NextResponse.json({ error: "Event not found." }, { status: 404 });
    }

    const admin = asFlexibleClient(createAdminClient());
    const { data, error } = await admin.rpc(
      "promote_event_waitlist_registration",
      {
        p_actor_user_id: permission.auth.user.id,
        p_event_id: event.id,
        p_registration_id: parsedRegistrationId.data,
      }
    );
    const result = (Array.isArray(data) ? data[0] : data) as PromotionResult | null;

    if (error || !result) {
      return NextResponse.json(
        { error: "Unable to promote the waitlisted registration." },
        { status: 500 }
      );
    }

    if (result.result_status === "not_found") {
      return NextResponse.json({ error: "Registration not found." }, { status: 404 });
    }

    if (result.result_status === "not_waitlisted") {
      return NextResponse.json(
        { error: "This registration is not eligible for waitlist promotion." },
        { status: 409 }
      );
    }

    if (result.result_status === "full") {
      return NextResponse.json(
        { error: "The event is at capacity. Free a confirmed place before promoting." },
        { status: 409 }
      );
    }

    if (result.result_status !== "promoted" || !result.registration_code) {
      return NextResponse.json(
        { error: "Unable to promote the waitlisted registration." },
        { status: 500 }
      );
    }

    const [registrationResult, eventResult, auditResult] = await Promise.all([
      admin
        .from("event_registrations")
        .select("registrant_name, registrant_email")
        .eq("id", parsedRegistrationId.data)
        .eq("event_id", event.id)
        .maybeSingle(),
      admin
        .from("events")
        .select("title, starts_at, location_label")
        .eq("id", event.id)
        .maybeSingle(),
      admin.from("audit_events").insert({
        action: "event.waitlist_promoted",
        actor_user_id: permission.auth.user.id,
        entity_id: parsedRegistrationId.data,
        entity_type: "event_registration",
        metadata: { event_id: event.id },
      }),
    ]);

    const registration = registrationResult.data as
      | { registrant_email: string; registrant_name: string }
      | null;
    const eventDetails = eventResult.data as
      | { location_label: string; starts_at: string; title: string }
      | null;

    if (registration && eventDetails) {
      const idempotencyKey = `event-registration/${event.id}/${result.registration_code}/promoted`;
      const delivery = await sendEmail({
        html: buildEventConfirmationEmail({
          eventLocation: eventDetails.location_label,
          eventStart: eventDetails.starts_at,
          eventTitle: eventDetails.title,
          registrantName: registration.registrant_name,
          registrationCode: result.registration_code,
        }),
        idempotencyKey,
        subject: `You're registered: ${eventDetails.title}`,
        to: registration.registrant_email,
      });

      try {
        await recordEventRegistrationDelivery({
          eventId: event.id,
          idempotencyKey,
          providerMessageId: delivery.messageId,
          registrationCode: result.registration_code,
          status: delivery.success ? "sent" : "failed",
        });
      } catch {
        logServerError(
          "events.promote.record_delivery",
          new Error("Promoted-attendee delivery ledger write failed.")
        );
      }

      if (!delivery.success) {
        logServerError(
          "events.promote.delivery",
          new Error("Promoted-attendee confirmation delivery failed.")
        );
      }
    }
    return NextResponse.json({
      auditRecorded: !auditResult.error,
      code: result.registration_code,
      success: true,
    });
  },
  {
    rateLimit: RATE_LIMITS.eventCheckin,
    requireAuth: true,
  }
);
