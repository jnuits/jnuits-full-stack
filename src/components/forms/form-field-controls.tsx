import type { FormDefinition, FormField } from "@/lib/forms/definition";

/**
 * Shared field renderer for the public form and the Form Studio preview.
 *
 * The preview must show what a respondent actually sees; rendering a separate
 * simplified summary means the preview cannot reveal a wrong field type, a
 * missing choice list, or an upload constraint. In preview mode the controls
 * are inert: disabled, unnamed, and not required, so nothing can be entered or
 * submitted.
 */
export type FormFieldControlOptions = {
  idPrefix: string;
  preview?: boolean;
};

function controlName(field: FormField, preview: boolean | undefined) {
  return preview ? undefined : field.id;
}

export function FieldHelp({ field }: { field: FormField }) {
  return field.helpText ? (
    <p className="mt-1 text-sm leading-6 text-[var(--muted-foreground)]">{field.helpText}</p>
  ) : null;
}

export function FieldLabel({
  field,
  inputId,
}: {
  field: Exclude<FormField, { type: "section" }>;
  inputId: string;
}) {
  return (
    <label className="input-label" htmlFor={inputId}>
      {field.label}
      {field.required ? <span aria-hidden="true"> *</span> : null}
    </label>
  );
}

function TextField({
  field,
  inputId,
  preview,
}: {
  field: Extract<FormField, { type: "email" | "telephone" | "text" | "textarea" }>;
  inputId: string;
  preview?: boolean;
}) {
  const inputType = field.type === "email" ? "email" : field.type === "telephone" ? "tel" : "text";
  const maxLength = "maxLength" in field ? field.maxLength : undefined;

  return (
    <div>
      <FieldLabel field={field} inputId={inputId} />
      {field.type === "textarea" ? (
        <textarea
          className="input-field mt-1 min-h-32 w-full"
          disabled={preview}
          id={inputId}
          maxLength={maxLength}
          name={controlName(field, preview)}
          required={!preview && field.required}
        />
      ) : (
        <input
          autoComplete={field.type === "email" ? "email" : field.type === "telephone" ? "tel" : "off"}
          className="input-field mt-1 w-full"
          disabled={preview}
          id={inputId}
          maxLength={maxLength}
          name={controlName(field, preview)}
          required={!preview && field.required}
          type={inputType}
        />
      )}
      <FieldHelp field={field} />
    </div>
  );
}

function SelectField({
  field,
  inputId,
  preview,
}: {
  field: Extract<FormField, { type: "multi_select" | "select" }>;
  inputId: string;
  preview?: boolean;
}) {
  const multiple = field.type === "multi_select";

  return (
    <div>
      <FieldLabel field={field} inputId={inputId} />
      <select
        className="input-field mt-1 w-full"
        disabled={preview}
        id={inputId}
        multiple={multiple}
        name={controlName(field, preview)}
        required={!preview && field.required}
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

export function FormFieldControl({
  field,
  idPrefix,
  preview,
}: { field: FormField } & FormFieldControlOptions) {
  const inputId = `${idPrefix}-${field.id}`;

  if (field.type === "section") {
    return (
      <section
        className="border-t border-[var(--line)] pt-6 first:border-t-0 first:pt-0"
        aria-labelledby={inputId}
      >
        <h2 className="text-xl font-bold text-[var(--brand-ink)]" id={inputId}>
          {field.label}
        </h2>
        <FieldHelp field={field} />
      </section>
    );
  }

  if (
    field.type === "text" ||
    field.type === "textarea" ||
    field.type === "email" ||
    field.type === "telephone"
  ) {
    return <TextField field={field} inputId={inputId} preview={preview} />;
  }

  if (field.type === "select" || field.type === "multi_select") {
    return <SelectField field={field} inputId={inputId} preview={preview} />;
  }

  if (field.type === "number" || field.type === "date") {
    return (
      <div>
        <FieldLabel field={field} inputId={inputId} />
        <input
          className="input-field mt-1 w-full"
          disabled={preview}
          id={inputId}
          max={field.type === "number" ? field.max : undefined}
          min={field.type === "number" ? field.min : undefined}
          name={controlName(field, preview)}
          required={!preview && field.required}
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
            disabled={preview}
            id={inputId}
            name={controlName(field, preview)}
            required={!preview && (field.type === "consent" || field.required)}
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
    <div>
      <FieldLabel field={field} inputId={inputId} />
      <input
        accept={field.type === "pdf" ? "application/pdf" : "image/jpeg,image/png,image/webp"}
        className="input-field mt-1 w-full"
        disabled={preview}
        id={inputId}
        multiple={field.maxFiles > 1}
        name={controlName(field, preview)}
        required={!preview && field.required}
        type="file"
      />
      <p className="mt-1 text-sm leading-6 text-[var(--muted-foreground)]">
        PDF, JPEG, PNG, or WebP only. Maximum 10 MB per file. Files are stored privately.
      </p>
      <FieldHelp field={field} />
    </div>
  );
}

export function FormFieldControls({
  definition,
  idPrefix,
  preview,
}: { definition: FormDefinition } & FormFieldControlOptions) {
  return (
    <>
      {definition.fields.map((field) => (
        <FormFieldControl field={field} idPrefix={idPrefix} key={field.id} preview={preview} />
      ))}
    </>
  );
}
