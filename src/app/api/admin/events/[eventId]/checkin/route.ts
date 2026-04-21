import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveEventForAdminMutation } from "@/lib/content/events";
import { withApiGuard } from "@/lib/security/with-api-guard";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

const checkInSchema = z.object({
  code: z.string().min(4).max(20).transform((value) => value.toUpperCase().trim()),
});

function getEventIdentifier(request: Request) {
  const segments = new URL(request.url).pathname.split("/");

  return segments[segments.indexOf("events") + 1] || "";
}

export const POST = withApiGuard(
  async (request) => {
    const eventIdentifier = getEventIdentifier(request);

    if (!eventIdentifier) {
      return NextResponse.json(
        { error: "Invalid event identifier." },
        { status: 400 }
      );
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const parsed = checkInSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Please provide a valid registration code." },
        { status: 422 }
      );
    }

    const event = await resolveEventForAdminMutation(eventIdentifier);

    if (!event) {
      return NextResponse.json({ error: "Event not found." }, { status: 404 });
    }

    const admin = createAdminClient();
    let registrationQuery = admin
      .from("event_registrations")
      .select(
        "id, registrant_name, registrant_email, member_id, checked_in_at, cancelled_at, members(jnuits_id, member_type)"
      )
      .eq("registration_code", parsed.data.code)
      .limit(1);

    if (event.legacyContentPostId) {
      registrationQuery = registrationQuery.or(
        `event_id.eq.${event.id},event_post_id.eq.${event.legacyContentPostId}`
      );
    } else {
      registrationQuery = registrationQuery.eq("event_id", event.id);
    }

    const { data: registration, error: registrationError } =
      await registrationQuery.maybeSingle();

    if (registrationError || !registration) {
      return NextResponse.json(
        { error: "No registration found for that code at this event." },
        { status: 404 }
      );
    }

    if (registration.cancelled_at) {
      return NextResponse.json(
        { cancelled: true, error: "This registration has been cancelled." },
        { status: 409 }
      );
    }

    if (registration.checked_in_at) {
      return NextResponse.json({
        alreadyCheckedIn: true,
        checkedInAt: registration.checked_in_at,
        email: registration.registrant_email,
        name: registration.registrant_name,
      });
    }

    const checkedInAt = new Date().toISOString();
    const { error: updateError } = await admin
      .from("event_registrations")
      .update({ checked_in_at: checkedInAt })
      .eq("id", registration.id);

    if (updateError) {
      return NextResponse.json(
        { error: "Unable to record check-in. Please try again." },
        { status: 500 }
      );
    }

    const member = Array.isArray(registration.members)
      ? registration.members[0]
      : registration.members;

    return NextResponse.json({
      checkedInAt,
      email: registration.registrant_email,
      jnuitsId: member?.jnuits_id ?? null,
      memberType: member?.member_type ?? null,
      name: registration.registrant_name,
      success: true,
    });
  },
  {
    rateLimit: RATE_LIMITS.eventCheckin,
    requireAuth: true,
  }
);
