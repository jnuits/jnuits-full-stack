import { NextResponse } from "next/server";
import { z } from "zod";
import {
  buildEventConfirmationEmail,
  buildEventWaitlistEmail,
} from "@/lib/notifications/email-builders";
import { extractApplicationIdentity } from "@/lib/forms/application-behavior";
import { validateFormAnswers } from "@/lib/forms/definition";
import { loadPublishedFormByVersionId } from "@/lib/forms/repository";
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

const registrationRequestSchema = z.object({
  answers: z.unknown().optional(),
  email: z.string().trim().email().optional(),
  name: z.string().trim().min(2).max(100).optional(),
  phone: z.string().trim().max(20).optional(),
  website: z.string().trim().max(200).optional().or(z.literal("")),
}).strict();

const legacyRegistrationSchema = z.object({
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

    const parsed = registrationRequestSchema.safeParse(body);

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

    let email: string;
    let formAnswers: unknown = null;
    let formDefinitionId: string | null = null;
    let formVersionId: string | null = null;
    let registrantName: string;
    let registrantPhone: null | string;

    if (event.registrationFormVersionId) {
      const form = await loadPublishedFormByVersionId(event.registrationFormVersionId);
      if (!form || form.kind !== "event_registration") {
        return NextResponse.json({ error: "This event registration form is unavailable." }, { status: 409 });
      }

      if (form.definition.fields.some((field) => field.type === "image" || field.type === "pdf")) {
        return NextResponse.json({ error: "This event registration form is unavailable." }, { status: 409 });
      }

      if (parsed.data.answers === undefined) {
        return NextResponse.json({ error: "Please complete the registration form." }, { status: 422 });
      }

      try {
        const answers = validateFormAnswers(form.definition, parsed.data.answers);
        const identity = extractApplicationIdentity(form.applicationBehavior, answers);
        email = identity.email;
        formAnswers = answers;
        formDefinitionId = form.id;
        formVersionId = form.versionId;
        registrantName = identity.fullName;
        registrantPhone = identity.phone || null;
      } catch {
        return NextResponse.json({ error: "Please check the registration form." }, { status: 422 });
      }
    } else {
      const legacy = legacyRegistrationSchema.safeParse({
        email: parsed.data.email,
        name: parsed.data.name,
        phone: parsed.data.phone,
        website: parsed.data.website,
      });
      if (!legacy.success) {
        return NextResponse.json(
          { error: "Please check your name, email, and phone number." },
          { status: 422 }
        );
      }

      email = legacy.data.email.toLowerCase();
      registrantName = legacy.data.name;
      registrantPhone = legacy.data.phone || null;
    }

    const admin = createAdminClient();
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

    const isLinkedFormRegistration = Boolean(formDefinitionId && formVersionId && formAnswers);
    const rpcName = isLinkedFormRegistration
      ? "register_for_event_with_form_atomic"
      : "register_for_event_atomic";
    const rpcArguments = isLinkedFormRegistration
      ? {
          p_answers: formAnswers,
          p_event_id: event.id,
          p_form_definition_id: formDefinitionId,
          p_form_version_id: formVersionId,
          p_legacy_event_post_id: event.legacyContentPostId,
          p_member_id: memberId,
          p_registrant_email: email,
          p_registrant_name: registrantName,
          p_registrant_phone: registrantPhone,
        }
      : {
          p_event_id: event.id,
          p_legacy_event_post_id: event.legacyContentPostId,
          p_member_id: memberId,
          p_registrant_email: email,
          p_registrant_name: registrantName,
          p_registrant_phone: registrantPhone,
        };
    const { data: rpcData, error: rpcError } = await asFlexibleClient(admin).rpc(
      rpcName,
      rpcArguments
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

    if (result.result_status === "waitlisted" && result.registration_code) {
      void sendEmail({
        html: buildEventWaitlistEmail({
          eventLocation: event.locationLabel,
          eventStart: event.startsAt,
          eventTitle: event.title,
          registrantName,
          registrationCode: result.registration_code,
        }),
        subject: `You're on the waitlist: ${event.title}`,
        to: email,
      });

      return NextResponse.json({
        code: result.registration_code,
        eventTitle: event.title,
        success: true,
        waitlisted: true,
      });
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
        registrantName,
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
