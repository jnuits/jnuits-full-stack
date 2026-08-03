"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";

import { TurnstileField } from "@/components/auth/turnstile-field";
import { FormFieldControls } from "@/components/forms/form-field-controls";
import {
  PUBLIC_FORM_CAPTCHA_CONTROL_NAME,
  PUBLIC_FORM_HONEYPOT_CONTROL_NAME,
} from "@/lib/forms/control-names";
import type { FormDefinition, FormField, FormKind } from "@/lib/forms/definition";
import { getEventRegistrationSuccessContent } from "@/lib/forms/event-registration-result";
import {
  collectNativeFieldErrors,
  firstFieldWithError,
} from "@/lib/forms/field-validation";
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
  "rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive";

/**
 * Affirmative counterpart to the error notice.
 *
 * Deliberately `primary` rather than contact's emerald. Emerald works there only
 * because four call sites hand-pair a `dark:` variant, and the guard added in
 * #89 bans bare colour literals precisely because three of those pairs had
 * drifted. A semantic `success` token would be better and is a design-system
 * decision (13.3a in #86); until it exists, the check icon carries the meaning
 * and the colour cannot be wrong in either theme.
 */
const NOTICE_SUCCESS_CLASS =
  "flex items-center gap-2 rounded-xl border border-border bg-primary/10 px-4 py-2.5 text-sm font-medium text-primary";

/**
 * Centring lives on the wrapper, not the card, because the header block above
 * the card has to share the same measure. `max-w-2xl` on the card alone used to
 * pin it to the left edge.
 */
const PAGE_WRAPPER_CLASS = "mx-auto w-full max-w-2xl";

/**
 * Decision 7 in #86: the contact card idiom, replacing `glass-card`.
 *
 * `overflow-hidden` rather than rounding the accent bar's own top corners, so
 * the bar cannot bleed past the radius at any width.
 */
const FORM_CARD_CLASS = "overflow-hidden rounded-2xl border border-border bg-card shadow-sm";
const FORM_CARD_ACCENT_CLASS = "h-[3px] bg-primary";
const FORM_CARD_BODY_CLASS = "p-6 sm:p-8";

/**
 * Moves focus to an element and brings it into view. Task 2.2, both halves.
 *
 * One function rather than one copy per effect. The failed-submit half shipped
 * this inline in #112, and the success half needs the identical treatment; two
 * copies would eventually disagree about the scroll, and the one nobody re-read
 * would be the one that was wrong.
 *
 * `preventScroll` followed by an explicit `scrollIntoView` rather than letting
 * the focus scroll happen: the default puts the element hard against the edge of
 * the viewport, which on a phone can leave the message beside it off screen.
 *
 * The `scrollIntoView` guard is not defensive noise. jsdom does not implement
 * the method, so without the check every component test of this screen throws
 * where it should have failed an assertion, and the throw reads like a broken
 * test rather than a broken screen.
 */
function focusAndReveal(element: HTMLElement | null) {
  if (!element) {
    return;
  }

  element.focus({ preventScroll: true });

  if (typeof element.scrollIntoView === "function") {
    element.scrollIntoView({ block: "center" });
  }
}

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

export async function collectPendingPublicFormUploads(
  formData: FormData,
  definition: FormDefinition
) {
  const honeypot = String(formData.get(PUBLIC_FORM_HONEYPOT_CONTROL_NAME) || "");

  return {
    honeypot,
    uploads: honeypot ? [] : await collectFormUploads(formData, definition),
  };
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
 * The title is the page's only top-level heading. Section headings inside the
 * card and the success heading sit one level below it, so the document has one
 * heading root rather than one per card.
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
        <p className="mt-3 text-sm text-muted-foreground">{lengthSummary}</p>
      ) : null}
    </header>
  );
}

/**
 * The challenge widget, collapsed once it is satisfied and replaced by a themed
 * confirmation. Task 2.11.
 *
 * Collapsed with `hidden`, not contact's `h-0 opacity-0 overflow-hidden`. That
 * approach keeps the challenge iframe focusable while invisible, so a keyboard
 * user can tab into a widget nobody can see. `display: none` removes it from
 * both the tab order and the accessibility tree, and a hidden input still
 * submits under it, so nothing is lost.
 *
 * The field stays mounted rather than being swapped out, because it owns the
 * hidden `captchaToken` input. Unmounting it would discard the token that the
 * chip is claiming to celebrate.
 *
 * Re-expands on expiry: the field reports an empty token when a challenge
 * lapses, which is the case that would otherwise leave a respondent unable to
 * retry something they cannot see.
 */
function VerifiedTurnstileField({ siteKey }: { siteKey: string }) {
  const [verified, setVerified] = useState(false);

  return (
    <div>
      <div className={verified ? "hidden" : undefined}>
        <TurnstileField
          name={PUBLIC_FORM_CAPTCHA_CONTROL_NAME}
          onTokenChange={(token) => setVerified(Boolean(token))}
          siteKey={siteKey}
        />
      </div>
      {verified ? (
        <p className={NOTICE_SUCCESS_CLASS} role="status">
          <CheckCircle2 aria-hidden="true" className="shrink-0" size={15} />
          Human verification complete
        </p>
      ) : null}
    </div>
  );
}

export function PublicFormScreen({ captcha, form, kind, linkedEventId }: PublicFormScreenProps) {
  const [state, setState] = useState<SubmissionState>({ status: "idle" });
  const [confirmationEmail, setConfirmationEmail] = useState("");
  /**
   * Per-field validation messages, keyed by field id. Task 2.1.
   *
   * Cleared at the start of every submit attempt and per field on input, so a
   * message cannot outlive the problem it describes.
   */
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  /**
   * Set on a failed submit, consumed by the effect below. Task 2.2.
   *
   * Focus cannot move inside the submit handler: the message element it should
   * describe does not exist until React commits, and focusing a control whose
   * `aria-describedby` target is not yet in the document means the description
   * is not announced. That is the same class of defect as the one 2.1 fixes.
   */
  const [pendingFocusFieldId, setPendingFocusFieldId] = useState<null | string>(null);
  /**
   * The success heading, so focus can be moved to it. Task 2.2, success half.
   *
   * A ref rather than an id lookup, which is what the failed-submit half has to
   * use: that one resolves a control chosen at runtime from the definition,
   * while this is one known element the component renders itself.
   */
  const successHeadingRef = useRef<HTMLHeadingElement>(null);
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
  const idPrefix = `form-${form.slug}`;
  const header = (
    <PublicFormHeader
      description={form.description}
      eyebrow={resolveFormEyebrow(kind, form.title)}
      lengthSummary={resolveFormLengthSummary(form.definition)}
      title={form.title}
    />
  );

  useEffect(() => {
    if (!pendingFocusFieldId) {
      return;
    }

    focusAndReveal(document.getElementById(`${idPrefix}-${pendingFocusFieldId}`));
    setPendingFocusFieldId(null);
  }, [idPrefix, pendingFocusFieldId]);

  /**
   * Moves focus to the success heading once the success card is committed. The
   * other half of task 2.2.
   *
   * Success replaces the entire form, including the submit button that had
   * focus. A removed element cannot keep it, so the browser hands focus back to
   * `<body>` and a keyboard or screen-reader user is returned to the top of the
   * document with no statement of what just happened. They then have to go and
   * find out whether a form they can no longer see was submitted.
   *
   * The live region that used to wrap this heading was never the answer, and the
   * comment in the success branch has said so since #112: it mounts with its
   * content already inside it, and several screen readers announce only
   * mutations to a region that already existed.
   *
   * Keyed on `state.status` alone, deliberately. The resend form below re-renders
   * this branch on every one of its own state changes, and a dependency that
   * moved with those would drag focus back up to the heading while the
   * respondent was working in the form underneath it.
   */
  useEffect(() => {
    if (state.status !== "success") {
      return;
    }

    focusAndReveal(successHeadingRef.current);
  }, [state.status]);

  /**
   * Clears one field's message as soon as its value changes.
   *
   * One handler on the form rather than a change handler per control: the
   * controls are uncontrolled by design, and wiring twelve of them would make
   * every field type carry state it does not otherwise need.
   *
   * Returns the existing object when there is nothing to clear, so typing in a
   * valid field does not re-render the form.
   */
  function handleFieldInput(event: FormEvent<HTMLFormElement>) {
    const target = event.target;

    if (
      !(target instanceof HTMLInputElement) &&
      !(target instanceof HTMLSelectElement) &&
      !(target instanceof HTMLTextAreaElement)
    ) {
      return;
    }

    const fieldId = target.name;

    setFieldErrors((current) => {
      if (!fieldId || !current[fieldId]) {
        return current;
      }

      const next = { ...current };
      delete next[fieldId];

      return next;
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!submissionTarget || cannotSubmit) {
      return;
    }

    // Captured once. `event.currentTarget` is null by the time an await below
    // resumes; the previous code only avoided that by reading it before the
    // first await, which was true then and fragile as this handler grows.
    const formElement = event.currentTarget;
    const nativeErrors = collectNativeFieldErrors(formElement, form.definition);

    if (Object.keys(nativeErrors).length > 0) {
      // Replaces `reportValidity()`. That showed one transient native bubble on
      // the first invalid control, in the browser's language rather than the
      // page's, and it vanished on the next interaction.
      setFieldErrors(nativeErrors);
      setPendingFocusFieldId(firstFieldWithError(form.definition, nativeErrors));

      return;
    }

    setFieldErrors({});
    setState({ status: "submitting" });
    const formData = new FormData(formElement);
    const mappedEmail = String(formData.get(form.emailFieldId) || "").trim().toLowerCase();

    try {
      const captchaToken = String(formData.get(PUBLIC_FORM_CAPTCHA_CONTROL_NAME) || "");
      const { honeypot: website, uploads: pendingUploads } =
        await collectPendingPublicFormUploads(formData, form.definition);
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
        [PUBLIC_FORM_HONEYPOT_CONTROL_NAME]: website,
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
            captchaToken: String(formData.get(PUBLIC_FORM_CAPTCHA_CONTROL_NAME) || ""),
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
        <section className={FORM_CARD_CLASS}>
          <div aria-hidden="true" className={FORM_CARD_ACCENT_CLASS} />
          <div className={FORM_CARD_BODY_CLASS}>
            {/*
             * No live region here any more, on purpose.
             *
             * It never worked: success replaces the form wholesale, so the region
             * mounted with its content already inside it, and several screen
             * readers announce only mutations to a region that already existed.
             * Focus now moves to the heading instead, which is the reliable
             * mechanism and is what #112 said the fix would be.
             *
             * Keeping the region as well would not be belt and braces. Focus
             * lands inside it, and an element focused inside a live region is the
             * standard way to have the same sentence read out twice. The two
             * chips that report a change within a view that stays put keep their
             * own `role="status"`; this heading is not a change within a view, it
             * is the new view.
             */}
            <div className="text-center">
              <span className="mb-4 inline-flex size-11 items-center justify-center rounded-full border border-border bg-primary/10 text-primary">
                <CheckCircle2 aria-hidden="true" size={22} />
              </span>
              {/*
               * `tabIndex={-1}` makes the heading a focus target without putting
               * it in the tab order, so nobody tabs onto a heading later.
               *
               * The focus ring is deliberately not suppressed. Programmatic focus
               * only matches `:focus-visible` when the browser judges the user to
               * be driving by keyboard, which is exactly the person who benefits
               * from seeing where they have been placed.
               */}
              <h2
                className="text-2xl font-bold tracking-tight text-foreground"
                ref={successHeadingRef}
                tabIndex={-1}
              >
                {eventSuccessContent ? eventSuccessContent.heading : "Check your email"}
              </h2>
              <p className="section-copy mt-3">
                {eventSuccessContent
                  ? eventSuccessContent.message
                  : "We sent a confirmation link to your email address. Open it to send your submission to the JnUITS review team."}
              </p>
            </div>
            {!eventSuccessContent && confirmationEmail ? (
              <form className="mt-6 grid gap-3" onSubmit={handleConfirmationResend}>
                <p className="text-sm leading-6 text-muted-foreground">
                  Did not receive it? Complete a new verification challenge to request another link.
                </p>
                {captchaRequired ? <VerifiedTurnstileField siteKey={captcha.siteKey} /> : null}
                {resendState.status === "sent" ? (
                  <p className={NOTICE_SUCCESS_CLASS} role="status">
                    <CheckCircle2 aria-hidden="true" className="shrink-0" size={15} />
                    If this email has a pending application, another confirmation link is on its way.
                  </p>
                ) : null}
                {resendState.status === "error" ? (
                  <p className={NOTICE_ERROR_CLASS} role="alert">
                    {resendState.message}
                  </p>
                ) : null}
                <button
                  aria-busy={resendState.status === "sending"}
                  className="secondary-button inline-flex w-full items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={resendState.status === "sending"}
                  type="submit"
                >
                  {resendState.status === "sending" ? (
                    <>
                      <Loader2 aria-hidden="true" className="animate-spin" size={15} />
                      Requesting…
                    </>
                  ) : (
                    "Resend confirmation email"
                  )}
                </button>
              </form>
            ) : null}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className={PAGE_WRAPPER_CLASS}>
      {header}
      <section className={FORM_CARD_CLASS}>
        <div aria-hidden="true" className={FORM_CARD_ACCENT_CLASS} />
        <div className={FORM_CARD_BODY_CLASS}>
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

          <form className="grid gap-6" noValidate onInput={handleFieldInput} onSubmit={handleSubmit}>
            <FormFieldControls
              definition={form.definition}
              errors={fieldErrors}
              idPrefix={idPrefix}
            />

            <div className="contact-honeypot" aria-hidden="true">
              <label htmlFor="form-honeypot">Website</label>
              <input
                autoComplete="off"
                id="form-honeypot"
                name={PUBLIC_FORM_HONEYPOT_CONTROL_NAME}
                tabIndex={-1}
              />
            </div>

            {captchaRequired ? <VerifiedTurnstileField siteKey={captcha.siteKey} /> : null}

            {state.status === "error" ? (
              <p className={NOTICE_ERROR_CLASS} role="alert">
                {state.message}
              </p>
            ) : null}

            <button
              aria-busy={state.status === "submitting"}
              className="primary-button inline-flex w-full items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={state.status === "submitting" || cannotSubmit}
              type="submit"
            >
              {state.status === "submitting" ? (
                <>
                  <Loader2 aria-hidden="true" className="animate-spin" size={15} />
                  Submitting…
                </>
              ) : isEventRegistration ? (
                "Complete registration"
              ) : (
                "Submit and confirm email"
              )}
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
