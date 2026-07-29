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

function isValidatableControl(element: Element | null): element is ValidatableControl {
  return (
    element instanceof HTMLInputElement ||
    element instanceof HTMLSelectElement ||
    element instanceof HTMLTextAreaElement
  );
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

    const control = formElement.elements.namedItem(field.id);

    if (!isValidatableControl(control) || control.disabled) {
      continue;
    }

    if (control.checkValidity()) {
      continue;
    }

    errors[field.id] = control.validity.valueMissing
      ? missingValueMessage(field)
      : control.validationMessage || missingValueMessage(field);
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
