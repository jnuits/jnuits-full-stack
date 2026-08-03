import {
  checkAnswerRule,
  type FormQuestionField,
  type RawAnswerValue,
} from "@/lib/forms/answer-rules";
import type { FormDefinition } from "@/lib/forms/definition";

/**
 * Client-side field validation messages for the public form. Tasks 2.1 and 2.3.
 *
 * `validateFormAnswers` on the server is authoritative and stays that way. This
 * exists so a respondent is told what is wrong beside the control rather than
 * in a transient native bubble, and it must never be the only check.
 *
 * Two passes, in this order:
 *
 *   1. **Constraint validity.** The browser's own answer, kept verbatim for
 *      anything other than a missing value, because the browser localises those
 *      messages and this application does not.
 *   2. **Shared answer rules.** `answer-rules.ts`, the same module
 *      `validateFormAnswers` enforces.
 *
 * The order matters and the second pass is deliberately second. It speaks only
 * where the browser is silent or laxer than the server, which is a narrower
 * claim than "mirror the server" sounds and is the honest one: a number outside
 * its range is reported by the browser, in the respondent's language, and
 * overriding that with English would be a regression.
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
function missingValueMessage(field: FormQuestionField) {
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

/** Ticked members of a group, in document order. */
function checkedValues(controls: ValidatableControl[]) {
  return controls
    .filter((control): control is HTMLInputElement => control instanceof HTMLInputElement)
    .filter((control) => control.checked)
    .map((control) => control.value);
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
 * The respondent's current answer, in the shape `checkAnswerRule` expects.
 *
 * A file control yields `""`: its value is a fake path, the real answer is an
 * asset id that does not exist until the upload completes, and the server
 * checks those against the upload proof rather than against a rule.
 */
function readAnswerValue(
  field: FormQuestionField,
  controls: ValidatableControl[]
): RawAnswerValue {
  if (field.type === "multi_select") {
    return checkedValues(controls);
  }

  if (field.type === "checkbox" || field.type === "consent") {
    return isAnyControlChecked(controls);
  }

  if (field.type === "radio") {
    return checkedValues(controls)[0] ?? "";
  }

  if (field.type === "image" || field.type === "pdf") {
    return "";
  }

  return controls[0]?.value ?? "";
}

/**
 * Reads constraint validity, then the shared rules, for every question.
 *
 * Iterates the definition and looks each control up by name, rather than
 * walking the form's elements. A DOM walk would pick up the honeypot and the
 * challenge token, and would report a failure against a control the respondent
 * cannot see.
 *
 * Returns field id to message, at most one per field. An empty object means
 * nothing failed.
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
     * Native `required` on a checkbox means *that* box must be ticked, so
     * putting it on every member of a "choose at least one" group would demand
     * all of them. The renderer therefore emits no `required` on the members,
     * constraint validation reports nothing, and the rule has to live here.
     *
     * A radio group needs none of this: native `required` on radios that share
     * a name already means "exactly one of these", so the branch above catches
     * it.
     */
    if (field.type === "multi_select" && field.required && !isAnyControlChecked(controls)) {
      errors[field.id] = missingValueMessage(field);

      continue;
    }

    /**
     * The shared rules. Task 2.3.
     *
     * Reached only when the browser is satisfied, so this is exactly the set of
     * failures constraint validation cannot express. The motivating one is task
     * 2.5: `someone@localhost` satisfies `<input type="email">`, which follows
     * the HTML spec and permits a bare domain label, and fails the server's
     * `z.string().email()`. Before this, that combination produced a clean
     * submit followed by a top-level rejection naming no field.
     */
    const ruleFailure = checkAnswerRule(field, readAnswerValue(field, controls));

    if (ruleFailure) {
      errors[field.id] = ruleFailure;
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
