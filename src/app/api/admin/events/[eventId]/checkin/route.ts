import { withApiGuard } from "@/lib/security/with-api-guard";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { RATE_LIMITS } from "@/lib/security/rate-limit";

const CheckInSchema = z.object({
  code: z.string().min(4).max(20).transform((v) => v.toUpperCase().trim()),
});

export const POST = withApiGuard(
  async (req) => {
    const url = new URL(req.url);
    const segments = url.pathname.split("/");
    const eventId = segments[segments.indexOf("events") + 1];

    if (!eventId || eventId.length < 10) {
      return NextResponse.json({ error: "Invalid event identifier." }, { status: 400 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const parsed = CheckInSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Please provide a valid registration code." },
        { status: 422 }
      );
    }

    const { code } = parsed.data;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = createAdminClient() as any;

    // Find registration by code, scoped to event
    const { data: registration, error: regError } = await admin
      .from("event_registrations")
      .select("id, registrant_name, registrant_email, member_id, checked_in_at, cancelled_at, members(jnuits_id, member_type)")
      .eq("event_post_id", eventId)
      .eq("registration_code", code)
      .maybeSingle();

    if (regError || !registration) {
      return NextResponse.json(
        { error: "No registration found for that code at this event." },
        { status: 404 }
      );
    }

    if (registration.cancelled_at) {
      return NextResponse.json(
        { error: "This registration has been cancelled.", cancelled: true },
        { status: 409 }
      );
    }

    if (registration.checked_in_at) {
      return NextResponse.json({
        alreadyCheckedIn: true,
        checkedInAt: registration.checked_in_at,
        name: registration.registrant_name,
        email: registration.registrant_email,
      });
    }

    // Stamp check-in
    const { error: updateError } = await admin
      .from("event_registrations")
      .update({ checked_in_at: new Date().toISOString() })
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
      success: true,
      name: registration.registrant_name,
      email: registration.registrant_email,
      jnuitsId: member?.jnuits_id ?? null,
      memberType: member?.member_type ?? null,
      checkedInAt: new Date().toISOString(),
    });
  },
  {
    rateLimit: RATE_LIMITS.eventCheckin,
    requireAuth: true,
  }
);
