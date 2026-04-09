import { withApiGuard } from "@/lib/security/with-api-guard";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/notifications/send-email";
import { buildEventConfirmationEmail } from "@/lib/notifications/email-builders";
import { RATE_LIMITS } from "@/lib/security/rate-limit";

const RegisterSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  phone: z.string().max(20).optional(),
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

    const parsed = RegisterSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Please check your name, email, and phone number.",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 422 }
      );
    }

    const { name, email, phone } = parsed.data;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = createAdminClient() as any;

    // Fetch the event post with new registration columns
    const { data: eventPost, error: eventError } = await admin
      .from("content_posts")
      .select("id, title, starts_at, ends_at, location, event_capacity, registration_open, registration_closes_at")
      .eq("id", eventId)
      .eq("content_type", "event")
      .eq("status", "published")
      .maybeSingle();

    if (eventError || !eventPost) {
      return NextResponse.json({ error: "Event not found." }, { status: 404 });
    }

    if (!eventPost.registration_open) {
      return NextResponse.json(
        { error: "Registration is not open for this event." },
        { status: 409 }
      );
    }

    if (
      eventPost.registration_closes_at &&
      new Date(eventPost.registration_closes_at) < new Date()
    ) {
      return NextResponse.json(
        { error: "Registration has closed for this event." },
        { status: 409 }
      );
    }

    // Check capacity if set
    if (eventPost.event_capacity) {
      const { count } = await admin
        .from("event_registrations")
        .select("id", { count: "exact", head: true })
        .eq("event_post_id", eventId)
        .is("cancelled_at", null);

      if ((count ?? 0) >= eventPost.event_capacity) {
        return NextResponse.json(
          { error: "This event has reached capacity." },
          { status: 409 }
        );
      }
    }

    // Check for duplicate registration
    const { data: existing } = await admin
      .from("event_registrations")
      .select("registration_code")
      .eq("event_post_id", eventId)
      .eq("registrant_email", email.toLowerCase())
      .is("cancelled_at", null)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: "You are already registered for this event.", code: existing.registration_code },
        { status: 409 }
      );
    }

    // Resolve member_id if logged in
    let memberId: string | null = null;
    try {
      const supabase = await createClient();
      const { data: authData } = await supabase.auth.getUser();
      if (authData?.user?.id) {
        const { data: member } = await admin
          .from("members")
          .select("id")
          .eq("user_id", authData.user.id)
          .maybeSingle();
        memberId = member?.id ?? null;
      }
    } catch {
      // not critical
    }

    // Insert registration
    const { data: registration, error: insertError } = await admin
      .from("event_registrations")
      .insert({
        event_post_id: eventId,
        member_id: memberId,
        registrant_name: name,
        registrant_email: email.toLowerCase(),
        registrant_phone: phone ?? null,
      })
      .select("registration_code")
      .single();

    if (insertError || !registration) {
      return NextResponse.json(
        { error: "Unable to complete registration. Please try again." },
        { status: 500 }
      );
    }

    // Non-blocking confirmation email
    void sendEmail({
      to: email,
      subject: `You're registered: ${eventPost.title}`,
      html: buildEventConfirmationEmail({
        registrantName: name,
        eventTitle: eventPost.title,
        eventStart: eventPost.starts_at ?? new Date().toISOString(),
        eventLocation: eventPost.location ?? "Location to be confirmed",
        registrationCode: registration.registration_code,
      }),
    });

    return NextResponse.json({
      success: true,
      code: registration.registration_code,
      eventTitle: eventPost.title,
    });
  },
  {
    rateLimit: RATE_LIMITS.eventRegister,
    requireAuth: false,
  }
);
