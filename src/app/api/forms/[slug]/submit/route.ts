import { NextResponse } from "next/server";
import { z } from "zod";
import { enforceAuthActionProtection } from "@/lib/auth/action-protection";
import { getCloudinaryConfig } from "@/lib/cloudinary/config";
import { getAppBaseUrl } from "@/lib/env";
import { logServerError } from "@/lib/errors/api-error";
import { extractApplicationIdentity } from "@/lib/forms/application-behavior";
import { buildFormConfirmationUrl, createFormConfirmation } from "@/lib/forms/confirmation";
import { verifyCloudinaryFormAssets } from "@/lib/forms/cloudinary-assets";
import { type FormAnswers, type FormDefinition, validateFormAnswers } from "@/lib/forms/definition";
import { createFormSubmissionAssets, createPendingFormSubmission, loadPublishedForm, markFormConfirmationSent, recordFormConfirmationDelivery } from "@/lib/forms/repository";
import { type FormSubmissionAsset, hashFormUploadManifest, validateProofBoundFormAssets, verifyFormUploadProof } from "@/lib/forms/upload-proof";
import { consumeFormUploadSession } from "@/lib/forms/upload-sessions";
import { buildFormConfirmationEmail } from "@/lib/notifications/email-builders";
import { sendEmail } from "@/lib/notifications/send-email";
import { withApiGuard } from "@/lib/security/with-api-guard";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
const slugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const submissionRequestSchema = z.object({ answers: z.unknown(), assets: z.array(z.unknown()).max(25).optional().default([]),
  captchaToken: z.string().trim().max(4096).optional().default(""), uploadProof: z.string().trim().max(20000).optional().default(""),
  website: z.string().trim().max(200).optional().default("") }).strict();
function verifyAssetAnswerBindings(definition: FormDefinition, answers: FormAnswers, assets: FormSubmissionAsset[]) {
  const fields = definition.fields.filter((field) => field.type === "image" || field.type === "pdf");
  if (!fields.length && assets.length) throw new Error("This form does not accept file uploads.");
  for (const field of fields) {
    const answer = answers[field.id]; const ids = assets.filter((asset) => asset.fieldId === field.id).map((asset) => asset.uploadId);
    if (!ids.length) { if (Array.isArray(answer) && answer.length) throw new Error("A form upload is missing."); continue; }
    if (!Array.isArray(answer) || answer.length !== ids.length || answer.some((id) => !ids.includes(id))) throw new Error("Form upload answers do not match uploaded files.");
  }
}
function acceptedResponse() { return NextResponse.json({ confirmationRequired: true, success: true }, { status: 202 }); }
export const POST = withApiGuard(async (request, context) => {
  const { slug: rawSlug } = await context.params; const slug = typeof rawSlug === "string" ? slugSchema.safeParse(rawSlug) : null;
  if (!slug?.success) return NextResponse.json({ error: "Form not found." }, { status: 404 });
  let body: unknown; try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400 }); }
  const parsed = submissionRequestSchema.safeParse(body); if (!parsed.success) return NextResponse.json({ error: "Please check the submitted form." }, { status: 422 });
  if (parsed.data.website) return acceptedResponse();
  const form = await loadPublishedForm(slug.data); if (!form) return NextResponse.json({ error: "Form not found." }, { status: 404 });
  if (form.kind === "event_registration") return NextResponse.json({ error: "Use the event registration page to register for this event." }, { status: 409 });
  let answers; try { answers = validateFormAnswers(form.definition, parsed.data.answers); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Please check the submitted form." }, { status: 422 }); }
  if (!form.applicationBehavior) { logServerError("forms.submit.missing_application_behavior", { formId: form.id }); return NextResponse.json({ error: "This form is not configured for public submission." }, { status: 409 }); }
  let identity; try { identity = extractApplicationIdentity(form.applicationBehavior, answers); }
  catch (error) { logServerError("forms.submit.invalid_application_behavior", error); return NextResponse.json({ error: "This form is not configured for public submission." }, { status: 409 }); }
  const protectionError = await enforceAuthActionProtection({ captchaToken: parsed.data.captchaToken, captchaValidation: "turnstile", email: identity.email,
    rateLimit: RATE_LIMITS.formSubmit, rateLimitPrefix: `form-submit:${form.id}`, requestHeaders: request.headers });
  if (protectionError) return NextResponse.json({ error: protectionError }, { status: 422 });
  let submissionAssets: FormSubmissionAsset[] = [];
  if (parsed.data.assets.length || parsed.data.uploadProof) {
    if (!parsed.data.assets.length || !parsed.data.uploadProof) return NextResponse.json({ error: "Please upload files again before submitting." }, { status: 422 });
    const proof = (() => { try { return verifyFormUploadProof({ expectedFormDefinitionId: form.id, expectedFormVersionId: form.versionId,
      proof: parsed.data.uploadProof, secret: getCloudinaryConfig().apiSecret }); } catch { return "unavailable" as const; } })();
    if (proof === "unavailable") return NextResponse.json({ error: "File upload verification is unavailable." }, { status: 503 });
    if (!proof) return NextResponse.json({ error: "Please upload files again before submitting." }, { status: 422 });
    try {
      submissionAssets = validateProofBoundFormAssets({ assets: parsed.data.assets, uploads: proof.uploads });
      verifyAssetAnswerBindings(form.definition, answers, submissionAssets);
      await verifyCloudinaryFormAssets(submissionAssets, { expectedFormDefinitionId: form.id, expectedFormVersionId: form.versionId });
      const consumed = await consumeFormUploadSession({ formDefinitionId: form.id, formVersionId: form.versionId,
        manifestSha256: hashFormUploadManifest(proof.uploads), sessionId: proof.sessionId });
      if (!consumed) return NextResponse.json({ error: "Please upload files again before submitting." }, { status: 422 });
    } catch (error) {
      logServerError("forms.submit.consume_upload_session", error);
      return NextResponse.json({ error: "File upload verification is unavailable." }, { status: 503 });
    }
  }
  const confirmation = createFormConfirmation();
  const submissionId = await createPendingFormSubmission({ answers, confirmationExpiresAt: confirmation.expiresAt,
    confirmationTokenHash: confirmation.tokenHash, formDefinitionId: form.id, formVersionId: form.versionId, submitterEmail: identity.email });
  try { await createFormSubmissionAssets(submissionId, submissionAssets); }
  catch (error) { logServerError("forms.submit.persist_uploads", error); return NextResponse.json({ error: "We could not securely save uploaded files. Please try again." }, { status: 503 }); }
  const idempotencyKey = `form-confirmation/${submissionId}`;
  const delivery = await sendEmail({ html: buildFormConfirmationEmail({ applicantName: identity.fullName,
    confirmationUrl: buildFormConfirmationUrl({ baseUrl: getAppBaseUrl(), formSlug: form.slug, submissionId, token: confirmation.token }),
    expiresAt: confirmation.expiresAt.toISOString(), formTitle: form.title }), idempotencyKey, subject: `Confirm your email for ${form.title}`, to: identity.email });
  try { await recordFormConfirmationDelivery({ formSubmissionId: submissionId, idempotencyKey, providerMessageId: delivery.messageId, status: delivery.success ? "sent" : "failed" }); }
  catch { logServerError("forms.submit.record_confirmation_delivery", new Error("Form confirmation delivery ledger write failed.")); }
  if (!delivery.success) { logServerError("forms.submit.confirmation_delivery", delivery.error); return NextResponse.json({ error: "We could not send your confirmation email. Please try again later." }, { status: 503 }); }
  try { await markFormConfirmationSent(submissionId); } catch (error) { logServerError("forms.submit.mark_confirmation_sent", error); }
  return acceptedResponse();
}, { rateLimit: RATE_LIMITS.formSubmit, requireAuth: false });
