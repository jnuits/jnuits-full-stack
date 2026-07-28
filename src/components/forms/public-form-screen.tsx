"use client";

import { type FormEvent, useState } from "react";

import { TurnstileField } from "@/components/auth/turnstile-field";
import { FormFieldControls } from "@/components/forms/form-field-controls";
import type { FormDefinition, FormField, FormKind } from "@/lib/forms/definition";
import { getEventRegistrationSuccessContent } from "@/lib/forms/event-registration-result";
import {
  resolveFormEyebrow,
  resolveFormLengthSummary,
} from "@/lib/forms/public-form-presentation";
import { resolvePublicFormSubmissionTarget } from "@/lib/forms/submission-target";

/**
 * Every status surface on this screen previously hardcoded `red-500`/`red-700`
 * with no dark variant, while the site header ships a theme toggle. The
 * `destructive` semantic token resolves per theme and is what
 * contact-form-card.tsx already uses.
 *
 * Kept as one constant rather than repeated inline: there are four of these,
 * and repetition is how three of them drifted apart.
 */
const NOTICE_ERROR_CLASS =
  "rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive";

/**
 * Centring lives on the wrapper, not the card, because the header block above
 * the card has to share the same measure. `max-w-2xl` on the card alone used to
 * pin it to the left edge.
 */
const PAGE_WRAPPER_CLASS = "mx-auto w-full max-w-2xl";
const FORM_CARD_CLASS = "glass-card px-6 py-8 sm:px-8";

type PublicFormScreenProps = {
  captcha: {
    required: boolean;
    siteKey: string;
  };
  kind: FormKind;
  linkedEventId?: null | string;
  form: {
    definition: FormDefinition;
    description: null | string;
    emailFieldId: string;
    slug: string;
    title: string;
  };
};

type SubmissionState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "success"; waitlisted: boolean }
  | { message: string; status: "error" };

type PendingFormUpload = {
  fieldId: string;
  file: File;
  mimeType: "application/pdf" | "image/jpeg" | "image/png" | "image/webp";
  sha256: string;
  size: number;
};

type FormUploadInstruction = Omit<PendingFormUpload, "file"> & {
  allowedFormats: string;
  apiKey: string;
  assetFolder: string;
  context: string;
  publicId: string;
  resourceType: "image" | "raw";
  signature: string;
  timestamp: number;
  uploadId: string;
  uploadUrl: string;
};

type StoredFormUploadAsset = {
  bytes: number;
  cloudinaryAssetId: string;
  cloudinaryFolder: string;
  cloudinaryPublicId: string;
  cloudinaryVersion: string;
  contentType: PendingFormUpload["mimeType"];
  fieldId: string;
  resourceType: "image" | "raw";
  sha256: string;
  uploadId: string;
};

const MAX_FORM_UPLOAD_BYTES = 10 * 1024 * 1024;

function supportedUploadMimeType(field: Extract<FormField, { type: "image" | "pdf" }>, mimeType: string): mimeType is PendingFormUpload["mimeType"] {
  return field.type === "pdf"
    ? mimeType === "application/pdf"
    : mimeType === "image/jpeg" || mimeType === "image/png" || mimeType === "image/webp";
}

async function sha256(file: File) {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function collectFormUploads(formData: FormData, definition: FormDefinition) {
  const uploads: PendingFormUpload[] = [];

  for (const field of definition.fields) {
    if (field.type !== "image" && field.type !== "pdf") {
      continue;
    }

    const files = formData
      .getAll(field.id)
      .filter((value): value is File => value instanceof File && value.size > 0);

    if (field.required && !files.length) {
      throw new Error(`${field.label} is required.`);
    }

    if (files.length > field.maxFiles) {
      throw new Error(`${field.label} accepts at most ${field.maxFiles} file(s).`);
    }

    for (const file of files) {
      if (file.size > MAX_FORM_UPLOAD_BYTES) {
        throw new Error(`${field.label} must be 10 MB or smaller.`);
      }

      if (!supportedUploadMimeType(field, file.type)) {
        throw new Error(`${field.label} has an unsupported file type.`);
      }

      uploads.push({
        fieldId: field.id,
        file,
        mimeType: file.type,
        sha256: await sha256(file),
        size: file.size,
      });
    }
  }

  return uploads;
}

function assertUploadInstruction(upload: PendingFormUpload, instruction: FormUploadInstruction) {
  if (
    instruction.fieldId !== upload.fieldId ||
    instruction.mimeType !== upload.mimeType ||
    instruction.sha256 !== upload.sha256 ||
    instruction.size !== upload.size
  ) {
    throw new Error("Secure upload preparation failed. Please try again.");
  }
}

async function uploadToCloudinary(upload: PendingFormUpload, instruction: FormUploadInstruction): Promise<StoredFormUploadAsset> {
  const body = new FormData();
  body.set("file", upload.file);
  body.set("api_key", instruction.apiKey);
  body.set("allowed_formats", instruction.allowedFormats);
  body.set("asset_folder", instruction.assetFolder);
  body.set("context", instruction.context);
  body.set("discard_original_filename", "true");
  body.set("overwrite", "false");
  body.set("public_id", instruction.publicId);
  body.set("signature", instruction.signature);
  body.set("timestamp", String(instruction.timestamp));
  body.set("unique_filename", "false");
  body.set("use_filename", "false");

  const response = await fetch(instruction.uploadUrl, { body, method: "POST" });
  const result = (await response.json().catch(() => null)) as
    | {
        asset_id?: unknown;
        bytes?: unknown;
        public_id?: unknown;
        resource_type?: unknown;
        version?: unknown;
      }
    | null;
  const assetId = typeof result?.asset_id === "string" ? result.asset_id.toLowerCase() : "";
  const version = typeof result?.version === "number" || typeof result?.version === "string"
    ? String(result.version)
    : "";

  if (
    !response.ok ||
    !/^[a-f0-9]{32}$/.test(assetId) ||
    !/^\d+$/.test(version) ||
    result?.bytes !== upload.size ||
    result?.public_id !== instruction.publicId ||
    result?.resource_type !== instruction.resourceType
  ) {
    throw new Error("Secure file upload failed. Please try again.");
  }

  return {
    bytes: upload.size,
    cloudinaryAssetId: assetId,
    cloudinaryFolder: instruction.assetFolder,
    cloudinaryPublicId: instruction.publicId,
    cloudinaryVersion: version,
    contentType: upload.mimeType,
    fieldId: upload.fieldId,
    resourceType: instruction.resourceType,
    sha256: upload.sha256,
    uploadId: instruction.uploadId,
  };
}

function toAnswers(
  formData: FormData,
  definition: FormDefinition,
  uploadedIdsByField: Record<string, string[]> = {}
) {
  const answers: Record<string, boolean | string | string[]> = {};

  for (const field of definition.fields) {
    if (field.type === "section") {
      continue;
    }

    if (field.type === "image" || field.type === "pdf") {
      const assetIds = uploadedIdsByField[field.id];
      if (assetIds?.length) {
        answers[field.id] = assetIds;
      }
      continue;
    }

    if (field.type === "checkbox" || field.type === "consent") {
      answers[field.id] = formData.get(field.id) === "on";
      continue;
    }

    if (field.type === "multi_select") {
      answers[field.id] = formData.getAll(field.id).map(String);
      continue;
    }

    const value = formData.get(field.id);
    if (typeof value === "string") {
      answers[field.id] = value;
    }
  }

  return answers;
}

/**
 * Eyebrow, title, description, and length affordance above the card.
 *
 * The title is the page's only `<h1>`. Section headings inside the card and the
 * success heading are `<h2>`, so the document has one heading root rather than
 * an `<h1>` per card.
 */
function PublicFormHeader({
  description,
  eyebrow,
  lengthSummary,
  title,
}: {
  description: null | string;
  eyebrow: null | string;
  lengthSummary: null | string;
  title: string;
}) {
  return (
    <header className="mb-6 text-center sm:mb-8">
      {eyebrow ? (
        <span className="inline-flex items-center rounded-full border border-border bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
          {eyebrow}
        </span>
      ) : null}
      <h1 className={eyebrow ? "section-title mt-4" : "section-title"}>{title}</h1>
      {description ? (
        <p className="section-copy mx-auto mt-3 max-w-xl">{description}</p>
      ) : null}
      {lengthSummary ? (
        <p className="mt-3 text-sm text-[var(--muted-foreground)]">{lengthSummary}</p>
      ) : null}
    </header>
  );
}

export function PublicFormScreen({ captcha, form, kind, linkedEventId }: PublicFormScreenProps) {
  const [state, setState] = useState<SubmissionState>({ status: "idle" });
  const [confirmationEmail, setConfirmationEmail] = useState("");
  const [resendState, setResendState] = useState<
    | { status: "idle" }
    | { status: "sending" }
    | { status: "sent" }
    | { message: string; status: "error" }
  >({ status: "idle" });
  const submissionTarget = resolvePublicFormSubmissionTarget({ kind, linkedEventId, slug: form.slug });
  const isEventRegistration = kind === "event_registration";
  const captchaRequired = captcha.required;
  const captchaUnavailable = captchaRequired && !captcha.siteKey;
  const cannotSubmit = !submissionTarget || captchaUnavailable;
  const header = (
    <PublicFormHeader
      description={form.description}
      eyebrow={resolveFormEyebrow(kind, form.title)}
      lengthSummary={resolveFormLengthSummary(form.definition)}
      title={form.title}
    />
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!submissionTarget || cannotSubmit || !event.currentTarget.reportValidity()) {
      return;
    }

    setState({ status: "submitting" });
    const formData = new FormData(event.currentTarget);
    const mappedEmail = String(formData.get(form.emailFieldId) || "").trim().toLowerCase();

    try {
      const captchaToken = String(formData.get("captchaToken") || "");
      const website = String(formData.get("website") || "");
      const pendingUploads = website ? [] : await collectFormUploads(formData, form.definition);
      const storedAssets: StoredFormUploadAsset[] = [];
      const uploadedIdsByField: Record<string, string[]> = {};
      let uploadProof = "";

      if (pendingUploads.length) {
        const signerResponse = await fetch(`/api/forms/${encodeURIComponent(form.slug)}/uploads/sign`, {
          body: JSON.stringify({
            captchaToken,
            uploads: pendingUploads.map(({ fieldId, mimeType, sha256: checksum, size }) => ({
              fieldId,
              mimeType,
              sha256: checksum,
              size,
            })),
          }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        });
        const signerPayload = (await signerResponse.json().catch(() => null)) as
          | { error?: string; proof?: string; uploads?: FormUploadInstruction[] }
          | null;

        if (
          !signerResponse.ok ||
          !signerPayload?.proof ||
          !Array.isArray(signerPayload.uploads) ||
          signerPayload.uploads.length !== pendingUploads.length
        ) {
          throw new Error(signerPayload?.error || "We could not prepare secure file uploads. Please try again.");
        }

        for (const [index, pendingUpload] of pendingUploads.entries()) {
          const instruction = signerPayload.uploads[index];
          assertUploadInstruction(pendingUpload, instruction);
          const storedAsset = await uploadToCloudinary(pendingUpload, instruction);
          storedAssets.push(storedAsset);
          (uploadedIdsByField[storedAsset.fieldId] ||= []).push(storedAsset.uploadId);
        }

        uploadProof = signerPayload.proof;
      }

      const requestBody = {
        answers: toAnswers(formData, form.definition, uploadedIdsByField),
        captchaToken: storedAssets.length ? "" : captchaToken,
        ...(storedAssets.length ? { assets: storedAssets, uploadProof } : {}),
        website,
      };
      const response = await fetch(submissionTarget.endpoint, {
        body: JSON.stringify(requestBody),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as
        | { error?: string; success?: boolean; waitlisted?: boolean }
        | null;

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || "We could not submit this form. Please try again.");
      }

      setConfirmationEmail(isEventRegistration ? "" : mappedEmail);
      setResendState({ status: "idle" });
      setState({ status: "success", waitlisted: Boolean(payload.waitlisted) });
    } catch (error) {
      setState({
        message: error instanceof Error ? error.message : "We could not submit this form. Please try again.",
        status: "error",
      });
    }
  }

  async function handleConfirmationResend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!confirmationEmail || isEventRegistration) return;

    setResendState({ status: "sending" });
    const formData = new FormData(event.currentTarget);

    try {
      const response = await fetch(
        `/api/forms/${encodeURIComponent(form.slug)}/confirmations/resend`,
        {
          body: JSON.stringify({
            captchaToken: String(formData.get("captchaToken") || ""),
            email: confirmationEmail,
          }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        }
      );
      const payload = (await response.json().catch(() => null)) as
        | { error?: string; success?: boolean }
        | null;

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || "We could not resend the confirmation email.");
      }

      setResendState({ status: "sent" });
    } catch (error) {
      setResendState({
        message:
          error instanceof Error ? error.message : "We could not resend the confirmation email.",
        status: "error",
      });
    }
  }

  if (state.status === "success") {
    const eventSuccessContent = isEventRegistration
      ? getEventRegistrationSuccessContent(state.waitlisted)
      : null;

    return (
      <div className={PAGE_WRAPPER_CLASS}>
        {header}
        <section className={FORM_CARD_CLASS} role="status" aria-live="polite">
          <h2 className="text-2xl font-bold text-[var(--brand-ink)]">
            {eventSuccessContent ? eventSuccessContent.heading : "Check your email"}
          </h2>
          <p className="section-copy mt-4">
            {eventSuccessContent
              ? eventSuccessContent.message
              : "We sent a confirmation link to your email address. Open it to send your submission to the JnUITS review team."}
          </p>
          {!eventSuccessContent && confirmationEmail ? (
            <form className="mt-6 grid gap-3" onSubmit={handleConfirmationResend}>
              <p className="text-sm leading-6 text-[var(--muted-foreground)]">
                Did not receive it? Complete a new verification challenge to request another link.
              </p>
              {captchaRequired ? <TurnstileField siteKey={captcha.siteKey} /> : null}
              {resendState.status === "sent" ? (
                <p className="text-sm font-semibold text-[var(--brand-green)]" role="status">
                  If this email has a pending application, another confirmation link is on its way.
                </p>
              ) : null}
              {resendState.status === "error" ? (
                <p className="text-sm font-semibold text-destructive" role="alert">
                  {resendState.message}
                </p>
              ) : null}
              <button
                aria-busy={resendState.status === "sending"}
                className="secondary-button w-full"
                disabled={resendState.status === "sending"}
                type="submit"
              >
                {resendState.status === "sending" ? "Requesting…" : "Resend confirmation email"}
              </button>
            </form>
          ) : null}
        </section>
      </div>
    );
  }

  return (
    <div className={PAGE_WRAPPER_CLASS}>
      {header}
      <section className={FORM_CARD_CLASS}>
        {!submissionTarget ? (
          <p className={`mb-6 ${NOTICE_ERROR_CLASS}`} role="alert">
            This event registration form is unavailable. Please return to the event page.
          </p>
        ) : null}
        {captchaUnavailable ? (
          <p className={`mb-6 ${NOTICE_ERROR_CLASS}`} role="alert">
            Verification is temporarily unavailable. Please try again later.
          </p>
        ) : null}

        <form className="grid gap-6" noValidate onSubmit={handleSubmit}>
          <FormFieldControls definition={form.definition} idPrefix={`form-${form.slug}`} />

          <div className="contact-honeypot" aria-hidden="true">
            <label htmlFor="form-website">Website</label>
            <input autoComplete="off" id="form-website" name="website" tabIndex={-1} />
          </div>

          {captchaRequired ? <TurnstileField siteKey={captcha.siteKey} /> : null}

          {state.status === "error" ? (
            <p className={NOTICE_ERROR_CLASS} role="alert" aria-live="polite">
              {state.message}
            </p>
          ) : null}

          <button
            aria-busy={state.status === "submitting"}
            className="primary-button w-full"
            disabled={state.status === "submitting" || cannotSubmit}
            type="submit"
          >
            {state.status === "submitting" ? "Submitting…" : isEventRegistration ? "Complete registration" : "Submit and confirm email"}
          </button>
        </form>
      </section>
    </div>
  );
}
