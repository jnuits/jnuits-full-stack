import { NextResponse } from "next/server";
import { z } from "zod";
import { buildEventConfirmationEmail } from "@/lib/notifications/email-builders";
import { sendEmail } from "@/lib/notifications/send-email";
import { resolvePublishedEventForMutation } from "@/lib/content/events";
import { withApiGuard } from "@/lib/security/with-api-guard";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { asFlexibleClient } from "@/lib/supabase/flexible";
import { createClient } from "@/lib/supabase/server";

type EventRegistrationRpcResult = {
  registration_code: null | string;
  result_status: string;
};

const registerSchema = z.object({
  email: z.string().trim().email(),
  name: z.string().trim().min(2).max(100),
  phone: z.string().trim().max(20).optional(),
  website: z.string().trim().max(200).optional().or(z.literal("")),
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

    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          details: parsed.error.flatten().fieldErrors,
          error: "Please check your name, email, and phone number.",
        },
        { status: 422 }
      );
    }

    if (parsed.data.website && parsed.data.website.length > 0) {
      return NextResponse.json({ code: "RECEIVED", success: true });
    }

    const event = await resolvePublishedEventForMutation(eventIdentifier);

    if (!event) {
      return NextResponse.json({ error: "Event not found." }, { status: 404 });
    }

    if (event.registrationMode !== "internal") {
      return NextResponse.json(
        { error: "This event does not use internal registration." },
        { status: 409 }
      );
    }

    if (!event.registrationOpen) {
      return NextResponse.json(
        { error: "Registration is not open for this event." },
        { status: 409 }
      );
    }

    if (event.registrationClosed) {
      return NextResponse.json(
        { error: "Registration has closed for this event." },
        { status: 409 }
      );
    }

    const admin = createAdminClient();
    const email = parsed.data.email.toLowerCase();
    let memberId: string | null = null;

    try {
      const supabase = await createClient();
      const { data: authData } = await supabase.auth.getUser();

      if (authData.user?.id) {
        const { data: member } = await admin
          .from("members")
          .select("id")
          .eq("user_id", authData.user.id)
          .maybeSingle();

        memberId = member?.id || null;
      }
    } catch {
      // Best-effort member lookup only.
    }

    const { data: rpcData, error: rpcError } = await asFlexibleClient(admin).rpc(
      "register_for_event_atomic",
      {
        p_event_id: event.id,
        p_legacy_event_post_id: event.legacyContentPostId,
        p_member_id: memberId,
        p_registrant_email: email,
        p_registrant_name: parsed.data.name,
        p_registrant_phone: parsed.data.phone || null,
      }
    );
    const result = (Array.isArray(rpcData) ? rpcData[0] : rpcData) as
      | EventRegistrationRpcResult
      | null;

    if (rpcError || !result) {
      return NextResponse.json(
        { error: "Unable to complete registration. Please try again." },
        { status: 500 }
      );
    }

    if (result.result_status === "duplicate") {
      return NextResponse.json(
        {
          code: result.registration_code,
          error: "You are already registered for this event.",
        },
        { status: 409 }
      );
    }

    if (result.result_status === "full") {
      return NextResponse.json(
        { error: "This event has reached capacity." },
        { status: 409 }
      );
    }

    if (result.result_status === "closed") {
      return NextResponse.json(
        { error: "Registration has closed for this event." },
        { status: 409 }
      );
    }

    if (result.result_status !== "created" || !result.registration_code) {
      return NextResponse.json(
        { error: "Unable to complete registration. Please try again." },
        { status: 409 }
      );
    }

    void sendEmail({
      html: buildEventConfirmationEmail({
        eventLocation: event.locationLabel,
        eventStart: event.startsAt,
        eventTitle: event.title,
        registrantName: parsed.data.name,
        registrationCode: result.registration_code,
      }),
      subject: `You're registered: ${event.title}`,
      to: email,
    });

    return NextResponse.json({
      code: result.registration_code,
      eventTitle: event.title,
      success: true,
    });
  },
  {
    rateLimit: RATE_LIMITS.eventRegister,
    requireAuth: false,
  }
);
