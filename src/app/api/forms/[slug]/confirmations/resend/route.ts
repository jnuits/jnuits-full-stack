import { NextResponse } from "next/server";
import { z } from "zod";

import { enforceAuthActionProtection } from "@/lib/auth/action-protection";
import { getAppBaseUrl } from "@/lib/env";
import { logServerError } from "@/lib/errors/api-error";
import { createFormConfirmation } from "@/lib/forms/confirmation";
import {
  loadPublishedForm,
  markFormConfirmationSent,
  recordFormConfirmationDelivery,
  refreshFormSubmissionConfirmation,
} from "@/lib/forms/repository";
import { buildFormConfirmationEmail } from "@/lib/notifications/email-builders";
import { sendEmail } from "@/lib/notifications/send-email";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import { withApiGuard } from "@/lib/security/with-api-guard";

const slugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

const resendRequestSchema = z
  .object({
    captchaToken: z.string().trim().max(4_096).optional().default(""),
    email: z.string().trim().email().max(320),
    website: z.string().trim().max(200).optional().default(""),
  })
  .strict();

function acceptedResponse() {
  return NextResponse.json({ success: true }, { status: 202 });
}

function buildConfirmationUrl(submissionId: string, token: string) {
  const url = new URL("/forms/confirm", getAppBaseUrl());
  url.searchParams.set("submission", submissionId);
  url.searchParams.set("token", token);
  return url.toString();
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
      return NextResponse.json({ error: "Invalid resend request." }, { status: 400 });
    }

    const parsed = resendRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid resend request." }, { status: 400 });
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
        { error: "Event registration does not use email confirmation links." },
        { status: 409 }
      );
    }

    const email = parsed.data.email.toLowerCase();
    const protectionError = await enforceAuthActionProtection({
      captchaToken: parsed.data.captchaToken,
      captchaValidation: "turnstile",
      email,
      rateLimit: RATE_LIMITS.formConfirmationResend,
      rateLimitPrefix: `form-confirmation-resend:${form.id}`,
      requestHeaders: request.headers,
    });

    if (protectionError) {
      return NextResponse.json({ error: protectionError }, { status: 422 });
    }

    const confirmation = createFormConfirmation();
    const refreshed = await refreshFormSubmissionConfirmation({
      confirmationExpiresAt: confirmation.expiresAt,
      confirmationTokenHash: confirmation.tokenHash,
      formDefinitionId: form.id,
      submitterEmail: email,
    });

    if (refreshed.resultStatus !== "resent" || !refreshed.formSubmissionId) {
      return acceptedResponse();
    }

    const deliveryIdempotencyKey =
      `form-confirmation-resend/${refreshed.formSubmissionId}/${confirmation.tokenHash}`;
    const delivery = await sendEmail({
      html: buildFormConfirmationEmail({
        applicantName: refreshed.applicantName || "JnUITS applicant",
        confirmationUrl: buildConfirmationUrl(refreshed.formSubmissionId, confirmation.token),
        expiresAt: confirmation.expiresAt.toISOString(),
        formTitle: form.title,
      }),
      idempotencyKey: deliveryIdempotencyKey,
      subject: `Confirm your email for ${form.title}`,
      to: email,
    });

    try {
      await recordFormConfirmationDelivery({
        formSubmissionId: refreshed.formSubmissionId,
        idempotencyKey: deliveryIdempotencyKey,
        providerMessageId: delivery.messageId,
        status: delivery.success ? "sent" : "failed",
      });
    } catch {
      logServerError(
        "forms.confirmation_resend.record_delivery",
        new Error("Form confirmation resend delivery ledger write failed.")
      );
    }

    if (!delivery.success) {
      logServerError(
        "forms.confirmation_resend.delivery",
        new Error("Form confirmation resend delivery failed.")
      );
      return acceptedResponse();
    }

    try {
      await markFormConfirmationSent(refreshed.formSubmissionId, confirmation.tokenHash);
    } catch {
      logServerError(
        "forms.confirmation_resend.mark_sent",
        new Error("Form confirmation resend sent marker failed.")
      );
    }

    return acceptedResponse();
  },
  {
    rateLimit: RATE_LIMITS.formConfirmationResend,
    requireAuth: false,
  }
);
