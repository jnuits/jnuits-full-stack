import { NextResponse } from "next/server";
import { z } from "zod";

import { enforceAuthActionProtection } from "@/lib/auth/action-protection";
import { getAppBaseUrl } from "@/lib/env";
import { logServerError } from "@/lib/errors/api-error";
import { extractApplicationIdentity } from "@/lib/forms/application-behavior";
import { createFormConfirmation } from "@/lib/forms/confirmation";
import { validateFormAnswers } from "@/lib/forms/definition";
import {
  createPendingFormSubmission,
  loadPublishedForm,
  markFormConfirmationSent,
} from "@/lib/forms/repository";
import { buildFormConfirmationEmail } from "@/lib/notifications/email-builders";
import { sendEmail } from "@/lib/notifications/send-email";
import { withApiGuard } from "@/lib/security/with-api-guard";
import { RATE_LIMITS } from "@/lib/security/rate-limit";

const slugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

const submissionRequestSchema = z
  .object({
    answers: z.unknown(),
    captchaToken: z.string().trim().max(4_096).optional().default(""),
    website: z.string().trim().max(200).optional().default(""),
  })
  .strict();

function buildConfirmationUrl(submissionId: string, token: string) {
  const url = new URL("/forms/confirm", getAppBaseUrl());
  url.searchParams.set("submission", submissionId);
  url.searchParams.set("token", token);
  return url.toString();
}

function acceptedResponse() {
  return NextResponse.json(
    { confirmationRequired: true, success: true },
    { status: 202 }
  );
}

export const POST = withApiGuard(
  async (request, context) => {
    const { slug: rawSlug } = await context.params;
    const slug = typeof rawSlug === "string" ? slugSchema.safeParse(rawSlug) : null;

    if (!slug?.success) {
      return NextResponse.json({ error: "Form not found." }, { status: 404 });
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const parsed = submissionRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Please check the submitted form." },
        { status: 422 }
      );
    }

    if (parsed.data.website) {
      return acceptedResponse();
    }

    const form = await loadPublishedForm(slug.data);
    if (!form) {
      return NextResponse.json({ error: "Form not found." }, { status: 404 });
    }

    if (form.kind === "event_registration") {
      return NextResponse.json(
        { error: "Use the event registration page to register for this event." },
        { status: 409 }
      );
    }

    if (form.definition.fields.some((field) => field.type === "image" || field.type === "pdf")) {
      return NextResponse.json(
        { error: "File uploads are not available for this form yet." },
        { status: 409 }
      );
    }

    let answers;

    try {
      answers = validateFormAnswers(form.definition, parsed.data.answers);
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error ? error.message : "Please check the submitted form.",
        },
        { status: 422 }
      );
    }

    if (!form.applicationBehavior) {
      logServerError("forms.submit.missing_application_behavior", { formId: form.id });
      return NextResponse.json(
        { error: "This form is not configured for public submission." },
        { status: 409 }
      );
    }

    let identity;

    try {
      identity = extractApplicationIdentity(form.applicationBehavior, answers);
    } catch (error) {
      logServerError("forms.submit.invalid_application_behavior", error);
      return NextResponse.json(
        { error: "This form is not configured for public submission." },
        { status: 409 }
      );
    }

    const protectionError = await enforceAuthActionProtection({
      captchaToken: parsed.data.captchaToken,
      captchaValidation: "turnstile",
      email: identity.email,
      rateLimit: RATE_LIMITS.formSubmit,
      rateLimitPrefix: `form-submit:${form.id}`,
      requestHeaders: request.headers,
    });

    if (protectionError) {
      return NextResponse.json({ error: protectionError }, { status: 422 });
    }

    const confirmation = createFormConfirmation();
    const submissionId = await createPendingFormSubmission({
      answers,
      confirmationExpiresAt: confirmation.expiresAt,
      confirmationTokenHash: confirmation.tokenHash,
      formDefinitionId: form.id,
      formVersionId: form.versionId,
      submitterEmail: identity.email,
    });
    const delivery = await sendEmail({
      html: buildFormConfirmationEmail({
        applicantName: identity.fullName,
        confirmationUrl: buildConfirmationUrl(submissionId, confirmation.token),
        expiresAt: confirmation.expiresAt.toISOString(),
        formTitle: form.title,
      }),
      idempotencyKey: `form-confirmation/${submissionId}`,
      subject: `Confirm your email for ${form.title}`,
      to: identity.email,
    });

    if (!delivery.success) {
      logServerError("forms.submit.confirmation_delivery", delivery.error);
      return NextResponse.json(
        { error: "We could not send your confirmation email. Please try again later." },
        { status: 503 }
      );
    }

    try {
      await markFormConfirmationSent(submissionId);
    } catch (error) {
      logServerError("forms.submit.mark_confirmation_sent", error);
    }

    return acceptedResponse();
  },
  {
    rateLimit: RATE_LIMITS.formSubmit,
    requireAuth: false,
  }
);
