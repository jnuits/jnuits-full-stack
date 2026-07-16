"use client";

import { type FormEvent, useMemo, useState } from "react";

import { TurnstileField } from "@/components/auth/turnstile-field";
import type { FormDefinition, FormField, FormKind } from "@/lib/forms/definition";
import { resolvePublicFormSubmissionTarget } from "@/lib/forms/submission-target";

type PublicFormScreenProps = {
  captcha: {
    required: boolean;
    siteKey: string;
  };
  form: {
  kind: FormKind;
  linkedEventId?: null | string;
    definition: FormDefinition;
    description: null | string;
    slug: string;
    title: string;
  };
};

type SubmissionState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "success" }
  | { message: string; status: "error" };

function FieldHelp({ field }: { field: FormField }) {
  return field.helpText ? (
    <p className="mt-1 text-sm leading-6 text-[var(--muted-foreground)]">{field.helpText}</p>
  ) : null;
}

function FieldLabel({ field, inputId }: { field: Exclude<FormField, { type: "section" }>; inputId: string }) {
  return (
    <label className="input-label" htmlFor={inputId}>
      {field.label}
      {field.required ? <span aria-hidden="true"> *</span> : null}
    </label>
  );
}

function TextField({ field, inputId }: { field: Extract<FormField, { type: "email" | "telephone" | "text" | "textarea" }>; inputId: string }) {
  const inputType =
    field.type === "email" ? "email" : field.type === "telephone" ? "tel" : "text";
  const maxLength = "maxLength" in field ? field.maxLength : undefined;

  return (
    <div>
      <FieldLabel field={field} inputId={inputId} />
      {field.type === "textarea" ? (
        <textarea
          className="input-field mt-1 min-h-32 w-full"
          id={inputId}
          maxLength={maxLength}
          name={field.id}
          required={field.required}
        />
      ) : (
        <input
          autoComplete={field.type === "email" ? "email" : field.type === "telephone" ? "tel" : "off"}
          className="input-field mt-1 w-full"
          id={inputId}
          maxLength={maxLength}
          name={field.id}
          required={field.required}
          type={inputType}
        />
      )}
      <FieldHelp field={field} />
    </div>
  );
}

function SelectField({ field, inputId }: { field: Extract<FormField, { type: "multi_select" | "select" }>; inputId: string }) {
  const multiple = field.type === "multi_select";

  return (
    <div>
      <FieldLabel field={field} inputId={inputId} />
      <select
        className="input-field mt-1 w-full"
        id={inputId}
        multiple={multiple}
        name={field.id}
        required={field.required}
        size={multiple ? Math.min(Math.max(field.options.length, 3), 6) : undefined}
      >
        {!multiple ? <option value="">Choose an option</option> : null}
        {field.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <FieldHelp field={field} />
    </div>
  );
}

function FormFieldControl({ field, formSlug }: { field: FormField; formSlug: string }) {
  const inputId = `form-${formSlug}-${field.id}`;

  if (field.type === "section") {
    return (
      <section className="border-t border-[var(--line)] pt-6 first:border-t-0 first:pt-0" aria-labelledby={inputId}>
        <h2 className="text-xl font-bold text-[var(--brand-ink)]" id={inputId}>
          {field.label}
        </h2>
        <FieldHelp field={field} />
      </section>
    );
  }

  if (field.type === "text" || field.type === "textarea" || field.type === "email" || field.type === "telephone") {
    return <TextField field={field} inputId={inputId} />;
  }

  if (field.type === "select" || field.type === "multi_select") {
    return <SelectField field={field} inputId={inputId} />;
  }

  if (field.type === "number" || field.type === "date") {
    return (
      <div>
        <FieldLabel field={field} inputId={inputId} />
        <input
          className="input-field mt-1 w-full"
          id={inputId}
          max={field.type === "number" ? field.max : undefined}
          min={field.type === "number" ? field.min : undefined}
          name={field.id}
          required={field.required}
          type={field.type}
        />
        <FieldHelp field={field} />
      </div>
    );
  }

  if (field.type === "checkbox" || field.type === "consent") {
    return (
      <div className="rounded-lg border border-[var(--line)] bg-[var(--bg)] px-4 py-3">
        <label className="flex cursor-pointer items-start gap-3" htmlFor={inputId}>
          <input
            className="mt-1 size-4 accent-[var(--brand-blue)]"
            id={inputId}
            name={field.id}
            required={field.type === "consent" || field.required}
            type="checkbox"
          />
          <span className="text-sm font-semibold leading-6 text-[var(--brand-ink)]">
            {field.label}
            {field.type === "consent" ? <span aria-hidden="true"> *</span> : null}
          </span>
        </label>
        <FieldHelp field={field} />
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-dashed border-[var(--line)] bg-[var(--bg)] px-4 py-3 text-sm text-[var(--muted-foreground)]">
      <strong className="block text-[var(--brand-ink)]">{field.label}</strong>
      Secure file uploads are not enabled for this form yet.
      <FieldHelp field={field} />
    </div>
  );
}

function toAnswers(formData: FormData, definition: FormDefinition) {
  const answers: Record<string, boolean | string | string[]> = {};

  for (const field of definition.fields) {
    if (field.type === "section" || field.type === "image" || field.type === "pdf") {
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

export function PublicFormScreen({ captcha, form, kind, linkedEventId }: PublicFormScreenProps) {
  const [state, setState] = useState<SubmissionState>({ status: "idle" });
  const hasFileFields = useMemo(
    () => form.definition.fields.some((field) => field.type === "image" || field.type === "pdf"),
    [form.definition.fields]
  );
  const submissionTarget = resolvePublicFormSubmissionTarget({ kind, linkedEventId, slug: form.slug });
  const isEventRegistration = kind === "event_registration";
  const captchaRequired = !isEventRegistration && captcha.required;
  const captchaUnavailable = captchaRequired && !captcha.siteKey;
  const cannotSubmit = !submissionTarget || hasFileFields || captchaUnavailable;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!submissionTarget || cannotSubmit || !event.currentTarget.reportValidity()) {
      return;
    }

    setState({ status: "submitting" });
    const formData = new FormData(event.currentTarget);

    try {
      const requestBody = {
        answers: toAnswers(formData, form.definition),
        ...(submissionTarget.confirmationRequired
          ? { captchaToken: String(formData.get("captchaToken") || "") }
          : {}),
        website: String(formData.get("website") || ""),
      };
      const response = await fetch(submissionTarget.endpoint, {
        body: JSON.stringify(requestBody),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as
        | { error?: string; success?: boolean }
        | null;

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || "We could not submit this form. Please try again.");
      }

      setState({ status: "success" });
    } catch (error) {
      setState({
        message: error instanceof Error ? error.message : "We could not submit this form. Please try again.",
        status: "error",
      });
    }
  }

  if (state.status === "success") {
    return (
      <section className="glass-card max-w-2xl px-6 py-8 sm:px-8" role="status" aria-live="polite">
        <h1 className="section-title">
          {isEventRegistration ? "Registration received" : "Check your email"}
        </h1>
        <p className="section-copy mt-4">
          {isEventRegistration
            ? "Your registration is complete. Check your email for your check-in code."
            : "We sent a confirmation link to your email address. Open it to send your submission to the JnUITS review team."}
        </p>
      </section>
    );
  }

  return (
    <section className="glass-card max-w-2xl px-6 py-8 sm:px-8">
      <h1 className="section-title">{form.title}</h1>
      {form.description ? <p className="section-copy mt-4">{form.description}</p> : null}

      {hasFileFields ? (
        <p className="mt-6 rounded-lg border border-[var(--brand-gold)]/30 bg-[var(--brand-gold)]/10 px-4 py-3 text-sm text-[var(--brand-ink)]" role="alert">
          This form requires secure file uploads, which are not enabled yet. Please contact JnUITS before submitting.
        </p>
      {!submissionTarget ? (
        <p className="mt-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700" role="alert">
          This event registration form is unavailable. Please return to the event page.
        </p>
      ) : null}
      ) : null}
      {captchaUnavailable ? (
        <p className="mt-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700" role="alert">
          Verification is temporarily unavailable. Please try again later.
        </p>
      ) : null}

      <form className="mt-8 grid gap-5" noValidate onSubmit={handleSubmit}>
        {form.definition.fields.map((field) => (
          <FormFieldControl field={field} formSlug={form.slug} key={field.id} />
        ))}

        <div className="contact-honeypot" aria-hidden="true">
          <label htmlFor="form-website">Website</label>
          <input autoComplete="off" id="form-website" name="website" tabIndex={-1} />
        </div>

        {captchaRequired ? <TurnstileField siteKey={captcha.siteKey} /> : null}

        {state.status === "error" ? (
          <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700" role="alert" aria-live="polite">
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
  );
}
