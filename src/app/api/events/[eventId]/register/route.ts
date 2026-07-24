import { NextResponse } from "next/server";
import { z } from "zod";
import { enforceAuthActionProtection } from "@/lib/auth/action-protection";
import { getCloudinaryConfig } from "@/lib/cloudinary/config";
import {
  buildEventConfirmationEmail,
  buildEventWaitlistEmail,
} from "@/lib/notifications/email-builders";
import { extractApplicationIdentity } from "@/lib/forms/application-behavior";
import {
  type FormAnswers,
  type FormDefinition,
  validateFormAnswers,
} from "@/lib/forms/definition";
import { recordEventRegistrationDelivery } from "@/lib/events/delivery";
import { loadPublishedFormByVersionId } from "@/lib/forms/repository";
import { verifyCloudinaryFormAssets } from "@/lib/forms/cloudinary-assets";
import {
  type FormSubmissionAsset,
  hashFormUploadManifest,
  validateProofBoundFormAssets,
  verifyFormUploadProof,
} from "@/lib/forms/upload-proof";
import { consumeFormUploadSession } from "@/lib/forms/upload-sessions";
import { sendEmail } from "@/lib/notifications/send-email";
import { resolvePublishedEventForMutation } from "@/lib/content/events";
import { logServerError } from "@/lib/errors/api-error";
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
  assets: z.array(z.unknown()).max(25).optional().default([]),
  captchaToken: z.string().trim().max(4_096).optional().default(""),
  email: z.string().trim().email().optional(),
  name: z.string().trim().min(2).max(100).optional(),
  phone: z.string().trim().max(20).optional(),
  uploadProof: z.string().trim().max(20_000).optional().default(""),
  website: z.string().trim().max(200).optional().or(z.literal("")),
}).strict();

const legacyRegistrationSchema = z.object({
  email: z.string().trim().email(),
  name: z.string().trim().min(2).max(100),
  phone: z.string().trim().max(20).optional(),
  website: z.string().trim().max(200).optional().or(z.literal("")),
});

function verifyAssetAnswerBindings(
  definition: FormDefinition,
  answers: FormAnswers,
  assets: FormSubmissionAsset[]
) {
  const assetFields = definition.fields.filter(
    (field) => field.type === "image" || field.type === "pdf"
  );

  if (!assetFields.length && assets.length) {
    throw new Error("This form does not accept file uploads.");
  }

  for (const field of assetFields) {
    const answer = answers[field.id];
    const uploadedIds = assets
      .filter((asset) => asset.fieldId === field.id)
      .map((asset) => asset.uploadId);

    if (!uploadedIds.length) {
      if (Array.isArray(answer) && answer.length) {
        throw new Error("A form upload is missing.");
      }
      continue;
    }

    if (
      !Array.isArray(answer) ||
      answer.length !== uploadedIds.length ||
      answer.some((uploadId) => !uploadedIds.includes(uploadId))
    ) {
      throw new Error("Form upload answers do not match uploaded files.");
    }
  }
}
function getEventIdentifier(request: Request) {
  const segments = new URL(request.url).pathname.split("/");

  return segments[segments.indexOf("events") + 1] || "";
}

async function sendEventRegistrationEmail(options: {
  deliveryKind: "confirmed" | "waitlisted";
  eventId: string;
  html: string;
  registrationCode: string;
  subject: string;
  to: string;
}) {
  const idempotencyKey = `event-registration/${options.eventId}/${options.registrationCode}/${options.deliveryKind}`;
  const delivery = await sendEmail({
    html: options.html,
    idempotencyKey,
    subject: options.subject,
    to: options.to,
  });

  try {
    await recordEventRegistrationDelivery({
      eventId: options.eventId,
      idempotencyKey,
      providerMessageId: delivery.messageId,
      registrationCode: options.registrationCode,
      status: delivery.success ? "sent" : "failed",
    });
  } catch {
    logServerError(
      "events.register.record_delivery",
      new Error("Event registration delivery ledger write failed.")
    );
  }

  if (!delivery.success) {
    logServerError(
      "events.register.delivery",
      new Error("Event registration confirmation delivery failed.")
    );
  }
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
    let formAnswers: FormAnswers | null = null;
    let formDefinition: FormDefinition | null = null;
    let formDefinitionId: string | null = null;
    let formVersionId: string | null = null;
    let registrantName: string;
    let registrantPhone: null | string;
    let submissionAssets: FormSubmissionAsset[] = [];

    if (event.registrationFormVersionId) {
      const form = await loadPublishedFormByVersionId(event.registrationFormVersionId);
      if (!form || form.kind !== "event_registration") {
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
        formDefinition = form.definition;
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

    const protectionError = await enforceAuthActionProtection({
      captchaToken: parsed.data.captchaToken,
      captchaValidation: "turnstile",
      email,
      rateLimit: RATE_LIMITS.eventRegister,
      rateLimitPrefix: `event-register:${event.id}`,
      requestHeaders: request.headers,
    });

    if (protectionError) {
      return NextResponse.json({ error: protectionError }, { status: 422 });
    }

    const hasUploadProof = parsed.data.assets.length > 0 || Boolean(parsed.data.uploadProof);

    if (hasUploadProof) {
      if (
        !formDefinition ||
        !formDefinitionId ||
        !formAnswers ||
        !parsed.data.assets.length ||
        !parsed.data.uploadProof
      ) {
        return NextResponse.json(
          { error: "Please upload files again before submitting." },
          { status: 422 }
        );
      }

      let uploadSecret: string;
      try {
        uploadSecret = getCloudinaryConfig().apiSecret;
      } catch {
        return NextResponse.json(
          { error: "File upload verification is unavailable." },
          { status: 503 }
        );
      }

      const proof = verifyFormUploadProof({
        expectedFormDefinitionId: formDefinitionId,
        expectedFormVersionId: formVersionId!,
        proof: parsed.data.uploadProof,
        secret: uploadSecret,
      });
      if (!proof) {
        return NextResponse.json(
          { error: "Please upload files again before submitting." },
          { status: 422 }
        );
      }

      try {
        submissionAssets = validateProofBoundFormAssets({
          assets: parsed.data.assets,
          uploads: proof.uploads,
        });
        verifyAssetAnswerBindings(formDefinition, formAnswers, submissionAssets);
        await verifyCloudinaryFormAssets(submissionAssets, { expectedFormDefinitionId: formDefinitionId, expectedFormVersionId: formVersionId! });
      } catch {
        return NextResponse.json(
          { error: "Please upload files again before submitting." },
          { status: 422 }
        );
      }

      try {
        const consumed = await consumeFormUploadSession({
          formDefinitionId,
          formVersionId: formVersionId!,
          manifestSha256: hashFormUploadManifest(proof.uploads),
          sessionId: proof.sessionId,
        });
        if (!consumed) {
          return NextResponse.json(
            { error: "Please upload files again before submitting." },
            { status: 422 }
          );
        }
      } catch {
        return NextResponse.json(
          { error: "File upload verification is unavailable." },
          { status: 503 }
        );
      }
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
      ? "register_for_event_with_form_assets_atomic"
      : "register_for_event_atomic";
    const rpcArguments = isLinkedFormRegistration
      ? {
          p_answers: formAnswers,
          p_assets: submissionAssets,
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
      await sendEventRegistrationEmail({
        deliveryKind: "waitlisted",
        eventId: event.id,
        html: buildEventWaitlistEmail({
          eventLocation: event.locationLabel,
          eventStart: event.startsAt,
          eventTitle: event.title,
          registrantName,
          registrationCode: result.registration_code,
        }),
        registrationCode: result.registration_code,
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
    if (result.result_status !== "confirmed" || !result.registration_code) {
      return NextResponse.json(
        { error: "Unable to complete registration. Please try again." },
        { status: 409 }
      );
    }

    await sendEventRegistrationEmail({
      deliveryKind: "confirmed",
      eventId: event.id,
      html: buildEventConfirmationEmail({
        eventLocation: event.locationLabel,
        eventStart: event.startsAt,
        eventTitle: event.title,
        registrantName,
        registrationCode: result.registration_code,
      }),
      registrationCode: result.registration_code,
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
