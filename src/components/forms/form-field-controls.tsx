import type { FormDefinition, FormField } from "@/lib/forms/definition";
import { groupFormFields } from "@/lib/forms/public-form-presentation";

/**
 * Shared field renderer for the public form and the Form Studio preview.
 *
 * The preview must show what a respondent actually sees; rendering a separate
 * simplified summary means the preview cannot reveal a wrong field type, a
 * missing choice list, or an upload constraint. In preview mode the controls
 * are inert: disabled, unnamed, and not required, so nothing can be entered or
 * submitted.
 *
 * Presentation follows decision 7 in #86: the contact page's treatment, on
 * semantic tokens only. No `var(--brand-*)` or `var(--line)` here, so a theme
 * change cannot leave a control behind.
 */
export type FormFieldControlOptions = {
  /**
   * Validation messages keyed by field id. Task 2.1.
   *
   * Absent for the Studio preview, and ignored there even if passed: preview
   * controls are disabled and unnamed, so an error on one would describe a
   * failure nobody could have caused.
   */
  errors?: Record<string, string>;
  idPrefix: string;
  preview?: boolean;
};

/**
 * One base for every control, because the focus ring is what drifts.
 *
 * Before this, three controls carried subtly different variants of the same
 * intent. Composing from a single string means a change to the ring reaches all
 * of them or none.
 */
const FIELD_BASE_CLASS =
  "w-full rounded-xl border border-border bg-background text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20";

/**
 * Invalid controls take a destructive border and ring, replacing the base pair.
 *
 * Colour is not the only signal: the message below the control carries the
 * text, and `aria-invalid` carries the state. This is the redundant third cue,
 * which is why it can safely be a colour at all.
 */
const FIELD_INVALID_CLASS =
  "border-destructive focus:border-destructive focus:ring-destructive/20";

function fieldClass(base: string, invalid: boolean) {
  return invalid ? `${base} ${FIELD_INVALID_CLASS}` : base;
}

const TEXT_INPUT_CLASS = `${FIELD_BASE_CLASS} h-12 px-3`;
const TEXTAREA_CLASS = `${FIELD_BASE_CLASS} min-h-32 resize-y px-3 py-3`;
const SELECT_CLASS = `${FIELD_BASE_CLASS} h-12 px-3`;

/**
 * `multi_select` sets `size`, so its height is the option count. A fixed `h-12`
 * would crop the list to a single row and remove the whole point of rendering
 * it as a list box.
 */
const MULTI_SELECT_CLASS = `${FIELD_BASE_CLASS} px-3 py-2`;

/**
 * The visible part of a file input is the browser's own button, which no class
 * on the input element can reach. `file:` targets `::file-selector-button`.
 *
 * `min-h-12` rather than `h-12`: the button needs vertical room inside the
 * border, and a fixed height clips it.
 *
 * Not replaced with a custom widget on purpose. Doing that means a visually
 * hidden input, a button, and JS to relay the click and mirror the chosen
 * filename, which reimplements keyboard focus, drag-and-drop, and the
 * assistive-technology mapping the native control already handles. Task 2.8
 * adds upload progress around this control rather than instead of it.
 *
 * `file:text-white` stays a literal: the primary is a dark brand blue in both
 * themes, so the button's label does not flip with the theme.
 */
const FILE_INPUT_CLASS =
  `${FIELD_BASE_CLASS} min-h-12 cursor-pointer px-3 py-2 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white`;

const LABEL_CLASS = "mb-1 block text-sm font-medium text-foreground";
const HELP_TEXT_CLASS = "mt-1 text-sm leading-6 text-muted-foreground";

/**
 * Validation message beneath a control. Semantic token, per 13.1c.
 */
const ERROR_TEXT_CLASS = "mt-1 text-sm font-medium leading-6 text-destructive";

/** Grouping container for a section and the questions it introduces. */
const SECTION_CLASS = "rounded-xl border border-border bg-muted/30 p-5";

/** A checkbox is one tappable row, so the whole row gets the surface. */
const CHECKBOX_ROW_CLASS = "rounded-xl border border-border bg-muted/30 px-4 py-3";

function controlName(field: FormField, preview: boolean | undefined) {
  return preview ? undefined : field.id;
}

/**
 * Composes `aria-describedby` from the ids that actually exist for a control.
 *
 * Order is announcement order, so the error comes first: a respondent who has
 * just been told the field is invalid needs to know why before being told how.
 *
 * Returns `undefined` rather than an empty string when nothing describes the
 * control, because `aria-describedby=""` is a dangling reference.
 */
function describedBy(...ids: (false | null | string | undefined)[]) {
  const present = ids.filter((id): id is string => typeof id === "string" && id.length > 0);

  return present.length ? present.join(" ") : undefined;
}

/**
 * Descriptive ids for one control.
 *
 * Derived from the control id, which derives from the form slug. The slug
 * contract in `src/app/api/admin/forms/route.ts` guarantees no whitespace, so
 * these cannot break an id reference when an author renames a form (task 5.4).
 */
function fieldDescriptionIds({
  error,
  field,
  inputId,
}: {
  error: string | undefined;
  field: FormField;
  inputId: string;
}) {
  return {
    errorId: error ? `${inputId}-error` : undefined,
    helpId: field.helpText ? `${inputId}-help` : undefined,
  };
}

export function FieldHelp({ field, id }: { field: FormField; id?: string }) {
  return field.helpText ? (
    <p className={HELP_TEXT_CLASS} id={id}>
      {field.helpText}
    </p>
  ) : null;
}

/**
 * Validation message for one field. Task 2.1.
 *
 * No `role="alert"`, deliberately. A twelve-field form failing validation would
 * fire twelve simultaneous announcements, which is worse than silence. The
 * message reaches assistive technology through `aria-describedby` when focus
 * lands on the control, and the screen moves focus to the first invalid control
 * on a failed submit.
 */
function FieldError({ id, message }: { id: string | undefined; message: string | undefined }) {
  return id && message ? (
    <p className={ERROR_TEXT_CLASS} id={id}>
      {message}
    </p>
  ) : null;
}

/**
 * `<input type="date">` renders in the browser's locale and accepts no display
 * format, so this site cannot show dd/mm/yyyy to a Bangladeshi respondent even
 * though that is what they expect.
 *
 * No data is at risk: the submitted value is ISO `yyyy-mm-dd` whatever the
 * display shows, and the server parses it as ISO. The risk is a respondent
 * misreading which box is the month, so the note says where the format comes
 * from and points at the calendar, which is unambiguous.
 *
 * Carries an id and is referenced by the control. Before task 2.1 this was
 * visible text explaining a control that never pointed at it.
 */
function DateFormatNote({ id }: { id: string }) {
  return (
    <p className={HELP_TEXT_CLASS} id={id}>
      Shown in your browser&apos;s date format. Use the calendar button if you are unsure.
    </p>
  );
}

/**
 * The marker and the caption must share one inline box.
 *
 * The label stacks its children, because everywhere else it wraps a caption and
 * its input together. A bare sibling span therefore landed on its own line, so
 * every required field rendered as a label followed by a lone asterisk.
 *
 * The asterisk is decorative and carries the visual weight; the `sr-only` text
 * beside it is what a screen reader announces. Previously the marker was
 * `aria-hidden` with no replacement, leaving the `required` attribute as the
 * only signal.
 */
export function RequiredMarker() {
  return (
    <>
      <span aria-hidden="true" className="text-destructive">
        *
      </span>
      <span className="sr-only">(required)</span>
    </>
  );
}

export function FieldLabel({
  field,
  inputId,
}: {
  field: Exclude<FormField, { type: "section" }>;
  inputId: string;
}) {
  return (
    <label className={LABEL_CLASS} htmlFor={inputId}>
      <span className="inline-flex flex-wrap items-baseline gap-1">
        {field.label}
        {field.required ? <RequiredMarker /> : null}
      </span>
    </label>
  );
}

function TextField({
  error,
  field,
  inputId,
  preview,
}: {
  error?: string;
  field: Extract<FormField, { type: "email" | "telephone" | "text" | "textarea" }>;
  inputId: string;
  preview?: boolean;
}) {
  const inputType = field.type === "email" ? "email" : field.type === "telephone" ? "tel" : "text";
  const maxLength = "maxLength" in field ? field.maxLength : undefined;
  const { errorId, helpId } = fieldDescriptionIds({ error, field, inputId });
  const described = describedBy(errorId, helpId);
  const invalid = Boolean(error);

  return (
    <div>
      <FieldLabel field={field} inputId={inputId} />
      {field.type === "textarea" ? (
        <textarea
          aria-describedby={described}
          aria-invalid={invalid || undefined}
          className={fieldClass(TEXTAREA_CLASS, invalid)}
          disabled={preview}
          id={inputId}
          maxLength={maxLength}
          name={controlName(field, preview)}
          required={!preview && field.required}
        />
      ) : (
        <input
          aria-describedby={described}
          aria-invalid={invalid || undefined}
          autoComplete={field.type === "email" ? "email" : field.type === "telephone" ? "tel" : "off"}
          className={fieldClass(TEXT_INPUT_CLASS, invalid)}
          disabled={preview}
          id={inputId}
          maxLength={maxLength}
          name={controlName(field, preview)}
          required={!preview && field.required}
          type={inputType}
        />
      )}
      <FieldError id={errorId} message={error} />
      <FieldHelp field={field} id={helpId} />
    </div>
  );
}

function SelectField({
  error,
  field,
  inputId,
  preview,
}: {
  error?: string;
  field: Extract<FormField, { type: "multi_select" | "select" }>;
  inputId: string;
  preview?: boolean;
}) {
  const multiple = field.type === "multi_select";
  const { errorId, helpId } = fieldDescriptionIds({ error, field, inputId });
  const invalid = Boolean(error);

  return (
    <div>
      <FieldLabel field={field} inputId={inputId} />
      <select
        aria-describedby={describedBy(errorId, helpId)}
        aria-invalid={invalid || undefined}
        className={fieldClass(multiple ? MULTI_SELECT_CLASS : SELECT_CLASS, invalid)}
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
      <FieldError id={errorId} message={error} />
      <FieldHelp field={field} id={helpId} />
    </div>
  );
}

export function FormFieldControl({
  error,
  field,
  idPrefix,
  preview,
}: { error?: string; field: FormField } & Omit<FormFieldControlOptions, "errors">) {
  const inputId = `${idPrefix}-${field.id}`;
  // A preview control is disabled and unnamed, so it cannot hold a value and
  // cannot have failed validation. Showing an error on one would be fiction.
  const fieldError = preview ? undefined : error;

  if (field.type === "section") {
    // Fallback for a direct caller rendering one field at a time.
    // `FormFieldControls` no longer reaches this branch: it groups sections with
    // the questions they introduce, which a single-field renderer cannot do.
    return (
      <section aria-labelledby={inputId} className={SECTION_CLASS}>
        <h2 className="text-lg font-bold text-foreground" id={inputId}>
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
    return <TextField error={fieldError} field={field} inputId={inputId} preview={preview} />;
  }

  if (field.type === "select" || field.type === "multi_select") {
    return <SelectField error={fieldError} field={field} inputId={inputId} preview={preview} />;
  }

  if (field.type === "number" || field.type === "date") {
    const { errorId, helpId } = fieldDescriptionIds({ error: fieldError, field, inputId });
    const dateNoteId = field.type === "date" ? `${inputId}-date-format` : undefined;
    const invalid = Boolean(fieldError);

    return (
      <div>
        <FieldLabel field={field} inputId={inputId} />
        <input
          aria-describedby={describedBy(errorId, helpId, dateNoteId)}
          aria-invalid={invalid || undefined}
          className={fieldClass(TEXT_INPUT_CLASS, invalid)}
          disabled={preview}
          id={inputId}
          max={field.type === "number" ? field.max : undefined}
          min={field.type === "number" ? field.min : undefined}
          name={controlName(field, preview)}
          required={!preview && field.required}
          type={field.type}
        />
        <FieldError id={errorId} message={fieldError} />
        <FieldHelp field={field} id={helpId} />
        {dateNoteId ? <DateFormatNote id={dateNoteId} /> : null}
      </div>
    );
  }

  if (field.type === "checkbox" || field.type === "consent") {
    const { errorId, helpId } = fieldDescriptionIds({ error: fieldError, field, inputId });
    const invalid = Boolean(fieldError);

    return (
      <div className={CHECKBOX_ROW_CLASS}>
        <label className="flex cursor-pointer items-start gap-3" htmlFor={inputId}>
          <input
            aria-describedby={describedBy(errorId, helpId)}
            aria-invalid={invalid || undefined}
            className="mt-1 size-4 accent-primary"
            disabled={preview}
            id={inputId}
            name={controlName(field, preview)}
            required={!preview && (field.type === "consent" || field.required)}
            type="checkbox"
          />
          <span className="text-sm font-medium leading-6 text-foreground">
            {field.label}
            {field.type === "consent" || field.required ? (
              <>
                {" "}
                <RequiredMarker />
              </>
            ) : null}
          </span>
        </label>
        <FieldError id={errorId} message={fieldError} />
        <FieldHelp field={field} id={helpId} />
      </div>
    );
  }

  const { errorId, helpId } = fieldDescriptionIds({ error: fieldError, field, inputId });
  const constraintsId = `${inputId}-upload-constraints`;
  const invalid = Boolean(fieldError);

  return (
    <div>
      <FieldLabel field={field} inputId={inputId} />
      <input
        accept={field.type === "pdf" ? "application/pdf" : "image/jpeg,image/png,image/webp"}
        aria-describedby={describedBy(errorId, helpId, constraintsId)}
        aria-invalid={invalid || undefined}
        className={fieldClass(FILE_INPUT_CLASS, invalid)}
        disabled={preview}
        id={inputId}
        multiple={field.maxFiles > 1}
        name={controlName(field, preview)}
        required={!preview && field.required}
        type="file"
      />
      <FieldError id={errorId} message={fieldError} />
      {/*
       * Referenced by the control rather than left as adjacent text. These are
       * the rules the server enforces, so a respondent who cannot see them is
       * being held to constraints nobody told them about.
       */}
      <p className={HELP_TEXT_CLASS} id={constraintsId}>
        PDF, JPEG, PNG, or WebP only. Maximum 10 MB per file. Files are stored privately.
      </p>
      <FieldHelp field={field} id={helpId} />
    </div>
  );
}

/**
 * Renders the definition as heading-owned groups.
 *
 * Previously every field was emitted as a flat sibling list, so a `section`
 * produced a labelled region containing nothing and the questions it introduced
 * belonged to no region at all. Grouping fixes both the semantics and the
 * visual reading order.
 */
export function FormFieldControls({
  definition,
  errors,
  idPrefix,
  preview,
}: { definition: FormDefinition } & FormFieldControlOptions) {
  const groups = groupFormFields(definition);

  return (
    <>
      {groups.map((group, index) => {
        const questions = group.fields.map((field) => (
          <FormFieldControl
            error={errors?.[field.id]}
            field={field}
            idPrefix={idPrefix}
            key={field.id}
            preview={preview}
          />
        ));

        if (!group.section) {
          return (
            <div className="grid gap-5" key={group.fields[0]?.id || `group-${index}`}>
              {questions}
            </div>
          );
        }

        const headingId = `${idPrefix}-${group.section.id}`;

        return (
          <section aria-labelledby={headingId} className={SECTION_CLASS} key={group.section.id}>
            <h2 className="text-lg font-bold text-foreground" id={headingId}>
              {group.section.label}
            </h2>
            <FieldHelp field={group.section} />
            {group.fields.length ? (
              <div className="mt-5 grid gap-5">{questions}</div>
            ) : null}
          </section>
        );
      })}
    </>
  );
}
