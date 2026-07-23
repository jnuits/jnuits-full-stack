import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApiPermission } from "@/lib/admin/api-auth";
import { resolveEventForAdminMutation } from "@/lib/content/events";
import { withApiGuard } from "@/lib/security/with-api-guard";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { asFlexibleClient } from "@/lib/supabase/flexible";

const checkInSchema = z.object({
  code: z.string().trim().min(4).max(20).regex(/^[a-z0-9]+$/i).transform((value) => value.toUpperCase()),
}).strict();

type CheckInResult = {
  checked_in_at: null | string;
  registration_id: null | string;
  result_status: string;
};

type RegistrationIdentity = {
  members: { jnuits_id: null | string; member_type: null | string } | Array<{ jnuits_id: null | string; member_type: null | string }> | null;
  registrant_email: string;
  registrant_name: string;
};

function getEventIdentifier(request: Request) {
  const segments = new URL(request.url).pathname.split("/");
  return segments[segments.indexOf("events") + 1] || "";
}

export const POST = withApiGuard(
  async (request) => {
    const permission = await requireAdminApiPermission("cms.events.manage", {
      forbiddenMessage: "Only event managers can check in event registrations.",
      unauthenticatedMessage: "Sign in before checking in event registrations.",
    });
    if (permission.response) return permission.response;

    const eventIdentifier = getEventIdentifier(request);
    if (!eventIdentifier) return NextResponse.json({ error: "Invalid event identifier." }, { status: 400 });

    const body = await request.json().catch(() => null);
    const parsed = checkInSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Please provide a valid registration code." }, { status: 422 });
    }

    const event = await resolveEventForAdminMutation(eventIdentifier);
    if (!event) return NextResponse.json({ error: "Event not found." }, { status: 404 });

    const admin = asFlexibleClient(createAdminClient());
    const { data, error } = await admin.rpc("check_in_event_registration", {
      p_actor_user_id: permission.auth.user.id,
      p_event_id: event.id,
      p_registration_code: parsed.data.code,
    });
    const result = (Array.isArray(data) ? data[0] : data) as CheckInResult | null;
    if (error || !result) {
      return NextResponse.json({ error: "Unable to record check-in. Please try again." }, { status: 500 });
    }
    if (result.result_status === "not_found") {
      return NextResponse.json({ error: "No registration found for that code at this event." }, { status: 404 });
    }
    if (result.result_status === "cancelled") {
      return NextResponse.json({ cancelled: true, error: "This registration has been cancelled." }, { status: 409 });
    }
    if (result.result_status === "waitlisted") {
      return NextResponse.json({ error: "This registration is still on the waitlist.", waitlisted: true }, { status: 409 });
    }
    if (!result.registration_id || !result.checked_in_at || !["checked_in", "already_checked_in"].includes(result.result_status)) {
      return NextResponse.json({ error: "Unable to record check-in. Please try again." }, { status: 500 });
    }

    const identityResult = await admin
      .from("event_registrations")
      .select("registrant_name, registrant_email, members(jnuits_id, member_type)")
      .eq("id", result.registration_id)
      .eq("event_id", event.id)
      .maybeSingle();
    const registration = identityResult.data as RegistrationIdentity | null;
    if (identityResult.error || !registration) {
      return NextResponse.json({ error: "Check-in was recorded, but attendee details could not be loaded." }, { status: 500 });
    }
    const member = Array.isArray(registration.members) ? registration.members[0] : registration.members;

    return NextResponse.json({
      alreadyCheckedIn: result.result_status === "already_checked_in",
      checkedInAt: result.checked_in_at,
      email: registration.registrant_email,
      jnuitsId: member?.jnuits_id ?? null,
      memberType: member?.member_type ?? null,
      name: registration.registrant_name,
      success: true,
    });
  },
  { rateLimit: RATE_LIMITS.eventCheckin, requireAuth: true }
);
