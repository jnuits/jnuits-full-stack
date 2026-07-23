import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApiPermission } from "@/lib/admin/api-auth";
import { resolveEventForAdminMutation } from "@/lib/content/events";
import { recordEventRegistrationDelivery } from "@/lib/events/delivery";
import { buildEventConfirmationEmail, buildEventWaitlistEmail } from "@/lib/notifications/email-builders";
import { sendEmail } from "@/lib/notifications/send-email";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import { withApiGuard } from "@/lib/security/with-api-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { asFlexibleClient } from "@/lib/supabase/flexible";

const registrationIdSchema = z.string().uuid();
const resendSchema = z.object({ idempotencyKey: z.string().uuid() }).strict();

function identifiers(request: Request) {
  const segments = new URL(request.url).pathname.split("/");
  return {
    eventIdentifier: segments[segments.indexOf("events") + 1] || "",
    registrationId: segments[segments.indexOf("registrations") + 1] || "",
  };
}

export const POST = withApiGuard(async (request) => {
  const permission = await requireAdminApiPermission("cms.events.manage", {
    forbiddenMessage: "Only event managers can resend registration notices.",
    unauthenticatedMessage: "Sign in before resending registration notices.",
  });
  if (permission.response) return permission.response;

  const route = identifiers(request);
  const registrationId = registrationIdSchema.safeParse(route.registrationId);
  const body = resendSchema.safeParse(await request.json().catch(() => null));
  if (!route.eventIdentifier || !registrationId.success || !body.success) {
    return NextResponse.json({ error: "Invalid resend request." }, { status: 422 });
  }

  const event = await resolveEventForAdminMutation(route.eventIdentifier);
  if (!event) return NextResponse.json({ error: "Event not found." }, { status: 404 });

  const admin = asFlexibleClient(createAdminClient());
  const registrationResult = await admin.from("event_registrations")
    .select("registration_code, registration_status, registrant_email, registrant_name, cancelled_at")
    .eq("id", registrationId.data).eq("event_id", event.id).maybeSingle();
  const eventResult = await admin.from("events").select("title, starts_at, location_label").eq("id", event.id).maybeSingle();
  const registration = registrationResult.data as { cancelled_at: null | string; registration_code: string; registration_status: string; registrant_email: string; registrant_name: string } | null;
  const eventDetails = eventResult.data as { location_label: string; starts_at: string; title: string } | null;
  if (registrationResult.error || eventResult.error || !registration || !eventDetails) {
    return NextResponse.json({ error: "Registration notice could not be loaded." }, { status: 404 });
  }
  if (registration.cancelled_at || registration.registration_status === "cancelled") {
    return NextResponse.json({ error: "Cancelled registrations cannot receive notices." }, { status: 409 });
  }

  const waitlisted = registration.registration_status === "waitlisted";
  const deliveryKind = waitlisted ? "waitlisted" : "confirmed";
  const idempotencyKey = `event-registration/${event.id}/${registration.registration_code}/resend/${body.data.idempotencyKey}`;
  const common = {
    eventLocation: eventDetails.location_label,
    eventStart: eventDetails.starts_at,
    eventTitle: eventDetails.title,
    registrantName: registration.registrant_name,
    registrationCode: registration.registration_code,
  };
  const delivery = await sendEmail({
    html: waitlisted ? buildEventWaitlistEmail(common) : buildEventConfirmationEmail(common),
    idempotencyKey,
    subject: waitlisted ? `You're on the waitlist: ${eventDetails.title}` : `You're registered: ${eventDetails.title}`,
    to: registration.registrant_email,
  });
  await recordEventRegistrationDelivery({
    eventId: event.id,
    idempotencyKey,
    providerMessageId: delivery.messageId,
    registrationCode: registration.registration_code,
    status: delivery.success ? "sent" : "failed",
  });
  if (!delivery.success) {
    return NextResponse.json({ error: "The registration notice could not be delivered." }, { status: 502 });
  }

  await admin.from("audit_events").insert({
    action: "event.registration_notice_resent",
    actor_user_id: permission.auth.user.id,
    entity_id: registrationId.data,
    entity_type: "event_registration",
    metadata: { delivery_kind: deliveryKind, event_id: event.id },
  });
  return NextResponse.json({ deliveryKind, success: true });
}, { rateLimit: RATE_LIMITS.eventCheckin, requireAuth: true });
