import type { FormDefinition, FormField } from "@/lib/forms/definition";

/**
 * Client-side field validation messages for the public form. Task 2.1.
 *
 * `validateFormAnswers` on the server is authoritative and stays that way. This
 * exists so a respondent is told what is wrong beside the control rather than
 * in a transient native bubble, and it must never be the only check.
 *
 * Deliberately thin: it reads the browser's own constraint validation rather
 * than reimplementing rules. Mirroring the server's rules -- email shape, phone
 * format, min/max explanation -- is tasks 2.3, 2.5, 2.6 and 2.7, and each one
 * belongs next to the server rule it mirrors.
 */

/**
 * Names that exist in the form element but are not questions.
 *
 * `website` is the honeypot, which is `aria-hidden` and must never be reported
 * to a respondent. `captchaToken` is a hidden input owned by the challenge
 * field. Keying validation to the definition rather than to the DOM is what
 * keeps both out, but they are named here so the intent survives a refactor.
 */
const NON_QUESTION_CONTROL_NAMES = new Set(["captchaToken", "website"]);

type ValidatableControl = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

function isValidatableControl(value: unknown): value is ValidatableControl {
  return (
    value instanceof HTMLInputElement ||
    value instanceof HTMLSelectElement ||
    value instanceof HTMLTextAreaElement
  );
}

/**
 * Resolves one form-control name to the controls that can be validated under it.
 *
 * `HTMLFormControlsCollection.namedItem` returns `Element | RadioNodeList |
 * null`. The list shape appears whenever several controls share a name, which
 * is what task 3.2 (radio) and task 3.3 (a real checkbox group) will produce.
 * Treating only the single-element shape as valid would silently skip an entire
 * group: no error, no message, and nothing in the source to notice.
 *
 * Disabled members are dropped. A disabled control does not participate in
 * constraint validation, so including one would report a failure a respondent
 * cannot act on.
 */
export function resolveValidatableControls(
  entry: Element | RadioNodeList | null
): ValidatableControl[] {
  if (entry === null) {
    return [];
  }

  if (isValidatableControl(entry)) {
    return entry.disabled ? [] : [entry];
  }

  // Guarded rather than assumed: the node project in this Vitest workspace has
  // no DOM globals, and this module is importable from there.
  if (typeof RadioNodeList !== "undefined" && entry instanceof RadioNodeList) {
    return Array.from(entry)
      .filter(isValidatableControl)
      .filter((control) => !control.disabled);
  }

  // Some other element answered to this name -- a fieldset, or a non-control
  // with a matching id. Nothing to validate.
  return [];
}

/**
 * A message for a missing answer, written for the control rather than generic.
 *
 * The browser's own `valueMissing` text is "Please fill out this field", which
 * is wrong for a checkbox and wrong for a file input. Everything other than
 * `valueMissing` keeps the native message, because the browser localises those
 * and this application does not.
 */
function missingValueMessage(field: Exclude<FormField, { type: "section" }>) {
  if (field.type === "consent") {
    return "Please confirm this to continue.";
  }

  if (field.type === "checkbox") {
    return "Please tick this box to continue.";
  }

  if (field.type === "image" || field.type === "pdf") {
    return "Please choose a file.";
  }

  if (field.type === "select" || field.type === "multi_select") {
    return "Please choose an option.";
  }

  if (field.type === "date") {
    return "Please enter a date.";
  }

  return "Please answer this question.";
}

/**
 * Reads constraint validity for every question in the definition.
 *
 * Iterates the definition and looks each control up by name, rather than
 * walking the form's elements. A DOM walk would pick up the honeypot and the
 * challenge token, and would report a failure against a control the respondent
 * cannot see.
 *
 * Returns field id to message. An empty object means nothing failed.
 *
 * Known limitation, for a grouped control: where the rule is "tick at least one
 * of these", each member reports valid on its own and this therefore reports
 * nothing. Group-level cardinality belongs with task 3.3, where the group
 * control is built.
 */
export function collectNativeFieldErrors(
  formElement: HTMLFormElement,
  definition: FormDefinition
): Record<string, string> {
  const errors: Record<string, string> = {};

  for (const field of definition.fields) {
    if (field.type === "section" || NON_QUESTION_CONTROL_NAMES.has(field.id)) {
      continue;
    }

    const controls = resolveValidatableControls(formElement.elements.namedItem(field.id));

    if (!controls.length) {
      continue;
    }

    const invalid = controls.find((control) => !control.checkValidity());

    if (!invalid) {
      continue;
    }

    errors[field.id] = invalid.validity.valueMissing
      ? missingValueMessage(field)
      : invalid.validationMessage || missingValueMessage(field);
  }

  return errors;
}

/**
 * The first field in definition order that has an error.
 *
 * Definition order, not object key order, so focus lands on the earliest
 * question a respondent would reach rather than wherever the key happened to be
 * inserted.
 */
export function firstFieldWithError(
  definition: FormDefinition,
  errors: Record<string, string>
): null | string {
  for (const field of definition.fields) {
    if (field.type !== "section" && errors[field.id]) {
      return field.id;
    }
  }

  return null;
}
