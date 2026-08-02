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
 * is what task 3.2 (radio) and task 3.3 (a real checkbox group) produce.
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

  // Distinct from the single-choice message on purpose. "Please choose an
  // option" beside a checkbox group reads as though only one is permitted,
  // which is the opposite of what the control does.
  if (field.type === "multi_select") {
    return "Please choose at least one option.";
  }

  if (field.type === "select" || field.type === "radio") {
    return "Please choose an option.";
  }

  if (field.type === "date") {
    return "Please enter a date.";
  }

  return "Please answer this question.";
}

/**
 * Whether any member of a group is ticked.
 *
 * Narrowed to `HTMLInputElement` because `checked` does not exist on a select
 * or a textarea, and `resolveValidatableControls` returns all three.
 */
function isAnyControlChecked(controls: ValidatableControl[]) {
  return controls.some((control) => control instanceof HTMLInputElement && control.checked);
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
    if (field.type === "section") {
      continue;
    }

    const controls = resolveValidatableControls(formElement.elements.namedItem(field.id));

    if (!controls.length) {
      continue;
    }

    const invalid = controls.find((control) => !control.checkValidity());

    if (invalid) {
      errors[field.id] = invalid.validity.valueMissing
        ? missingValueMessage(field)
        : invalid.validationMessage || missingValueMessage(field);

      continue;
    }

    /**
     * Group cardinality for a required checkbox group. Task 3.3.
     *
     * This is the limitation the earlier version of this file recorded and
     * deferred. Native `required` on a checkbox means *that* box must be
     * ticked, so putting it on every member of a "choose at least one" group
     * would demand all of them. The renderer therefore emits no `required` on
     * the members, constraint validation reports nothing, and the rule has to
     * live here.
     *
     * A radio group needs none of this: native `required` on radios that share
     * a name already means "exactly one of these", which is the correct rule,
     * so the branch above catches it.
     */
    if (field.type === "multi_select" && field.required && !isAnyControlChecked(controls)) {
      errors[field.id] = missingValueMessage(field);
    }
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
