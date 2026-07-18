import { NextResponse } from "next/server";
import { z } from "zod";

import { enforceAuthActionProtection } from "@/lib/auth/action-protection";
import { getCloudinaryConfig } from "@/lib/cloudinary/config";
import { loadPublishedForm } from "@/lib/forms/repository";
import { buildFormUploadInstructions, FORM_UPLOAD_MAX_BYTES } from "@/lib/forms/upload-signing";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import { withApiGuard } from "@/lib/security/with-api-guard";

const slugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

const requestSchema = z
  .object({
    captchaToken: z.string().trim().max(4_096).optional().default(""),
    uploads: z
      .array(
        z
          .object({
            fieldId: z.string().regex(/^[a-z][a-z0-9_]{0,63}$/),
            mimeType: z.enum([
              "application/pdf",
              "image/jpeg",
              "image/png",
              "image/webp",
            ]),
            sha256: z.string().regex(/^[a-f0-9]{64}$/),
            size: z.number().int().positive().max(FORM_UPLOAD_MAX_BYTES),
          })
          .strict()
      )
      .min(1)
      .max(25),
  })
  .strict();

export const POST = withApiGuard(async (request, context) => {
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

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Please check the selected files." }, { status: 422 });
  }

  const form = await loadPublishedForm(slug.data);
  if (!form) {
    return NextResponse.json({ error: "Form not found." }, { status: 404 });
  }

  if (form.kind === "event_registration") {
    return NextResponse.json(
      { error: "Event registrations do not accept file uploads yet." },
      { status: 409 }
    );
  }

  const protectionError = await enforceAuthActionProtection({
    captchaToken: parsed.data.captchaToken,
    captchaValidation: "turnstile",
    rateLimit: RATE_LIMITS.formSubmit,
    rateLimitPrefix: `form-upload:${form.id}`,
    requestHeaders: request.headers,
  });

  if (protectionError) {
    return NextResponse.json({ error: protectionError }, { status: 422 });
  }

  let config;
  try {
    config = getCloudinaryConfig();
  } catch {
    return NextResponse.json({ error: "File uploads are not configured." }, { status: 503 });
  }

  try {
    const signed = buildFormUploadInstructions({
      config,
      definition: form.definition,
      formDefinitionId: form.id,
      uploads: parsed.data.uploads,
    });

    return NextResponse.json({
      cloudName: config.cloudName,
      expiresAt: signed.expiresAt,
      proof: signed.proof,
      uploads: signed.uploads,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Could not prepare secure file uploads.",
      },
      { status: 422 }
    );
  }
});
