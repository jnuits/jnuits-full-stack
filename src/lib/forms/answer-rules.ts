import type { FormField } from "@/lib/forms/definition";
import { normalizePhoneAnswer, PHONE_ANSWER_MESSAGE } from "@/lib/phone";

/**
 * The rules an answer must satisfy, in one place. Tasks 2.3, 2.5, 2.6 and 2.7.
 *
 * `validateFormAnswers` is authoritative and stays authoritative: nothing here
 * runs instead of it. This module exists so that the client can enforce the
 * *same* rules rather than a second set written to resemble them. A mirror
 * built by hand drifts, and the drift is invisible until a respondent gets a
 * clean submit followed by a server rejection.
 *
 * Deliberately free of DOM APIs and of anything Next-specific. It is imported
 * by `definition.ts` (node) and by `field-validation.ts` (jsdom), so it has to
 * run in both Vitest projects.
 *
 * ## Messages carry no field label
 *
 * The client renders one of these beside a control whose label has just been
 * announced, so repeating the label is noise. The server prefixes it, because a
 * top-level banner has no field context. One rule, one sentence, two framings.
 *
 * ## What is deliberately not here
 *
 * Requiredness. An empty answer is the business of `required`, which the
 * browser reports natively and `validateFormAnswers` checks through
 * `requiredValue`. Every rule below returns `undefined` for an empty value, so
 * a blank optional question is never reported as malformed.
 */

export type FormQuestionField = Exclude<FormField, { type: "section" }>;

/** A respondent's answer before canonicalisation. */
export type RawAnswerValue = boolean | string | string[];

/**
 * The same check the server has always run, now shared.
 *
 * Stricter than `<input type="email">`, which follows the HTML spec and accepts
 * a bare domain label: `someone@localhost` is valid to the browser and invalid
 * here. That difference is the whole reason task 2.5 exists — the browser was
 * letting through addresses the server then rejected, so a respondent got a
 * clean submit and a top-level failure.
 */
const EMAIL_PATTERN =
  /^(?!\.)(?!.*\.\.)([A-Za-z0-9_'+\-\.]*)[A-Za-z0-9_+-]@([A-Za-z0-9][A-Za-z0-9\-]*\.)+[A-Za-z]{2,}$/;

const CHOICE_NOT_LISTED = "Choose one of the listed options.";

export function tooLongMessage(maxLength: number) {
  return `Shorten this to ${maxLength} characters or fewer.`;
}

/**
 * Whether a `yyyy-mm-dd` string names a date that exists.
 *
 * The shape test alone accepts 2026-02-30. Round-tripping through `Date.UTC`
 * and comparing the parts back is what catches a day the month does not have.
 */
export function isRealIsoDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return false;
  }

  const [year, month, day] = match.slice(1).map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

/**
 * The range a number question accepts, as a sentence. Task 2.7.
 *
 * The schema has supported `min` and `max` since the beginning and the renderer
 * has always set both attributes, so the browser enforces the range — but
 * nothing ever *told* a respondent what it was. They discovered the limit by
 * violating it. This is the affordance half of 2.7; the enforcement half was
 * already working.
 *
 * @returns undefined when the question is unbounded, so no empty note renders.
 */
export function describeAnswerConstraint(field: FormQuestionField): string | undefined {
  if (field.type !== "number") {
    return undefined;
  }

  const { max, min } = field;

  if (min !== undefined && max !== undefined) {
    return `Enter a number between ${min} and ${max}.`;
  }

  if (min !== undefined) {
    return `Enter ${min} or more.`;
  }

  if (max !== undefined) {
    return `Enter ${max} or less.`;
  }

  return undefined;
}

function checkNumber(field: Extract<FormField, { type: "number" }>, answer: string) {
  const numeric = Number(answer);

  if (!Number.isFinite(numeric)) {
    return "Enter a number.";
  }

  if (field.min !== undefined && numeric < field.min) {
    return `Enter ${field.min} or more.`;
  }

  if (field.max !== undefined && numeric > field.max) {
    return `Enter ${field.max} or less.`;
  }

  return undefined;
}

/**
 * Telephone shape, then the author's length cap. Task 2.6.
 *
 * Two orderings matter here and both are deliberate.
 *
 * **Format before length.** Thirty characters of prose in a phone field should
 * be told to include a country code, not told to shorten itself.
 *
 * **Length against the canonical value, not what was typed.** The canonical
 * value is what gets stored: `+880 1712-345678` is sixteen characters typed and
 * fourteen stored, so measuring the typed string would reject an answer that
 * fits comfortably.
 */
function checkPhone(field: Extract<FormField, { type: "telephone" }>, answer: string) {
  const canonical = normalizePhoneAnswer(answer);

  if (!canonical) {
    return PHONE_ANSWER_MESSAGE;
  }

  return canonical.length > field.maxLength ? tooLongMessage(field.maxLength) : undefined;
}

function checkChoices(
  field: Extract<FormField, { type: "multi_select" }>,
  choices: string[]
) {
  if (new Set(choices).size !== choices.length) {
    return "Each option can only be chosen once.";
  }

  if (choices.some((choice) => !field.options.some((option) => option.value === choice))) {
    return CHOICE_NOT_LISTED;
  }

  return undefined;
}

/**
 * The rule failure for one answer, or `undefined` when it satisfies them all.
 *
 * @param value the raw answer: a string for most questions, `string[]` for a
 * checkbox group, `boolean` for a checkbox or consent. Empty in any of those
 * shapes yields `undefined` — see the note on requiredness above.
 */
export function checkAnswerRule(
  field: FormQuestionField,
  value: RawAnswerValue
): string | undefined {
  // A checkbox carries no rule beyond being ticked, which is requiredness.
  if (typeof value === "boolean") {
    return undefined;
  }

  if (Array.isArray(value)) {
    return field.type === "multi_select" && value.length ? checkChoices(field, value) : undefined;
  }

  const answer = value.trim();

  if (!answer) {
    return undefined;
  }

  switch (field.type) {
    case "email":
      return EMAIL_PATTERN.test(answer)
        ? undefined
        : "Enter an email address in the form name@example.com.";
    case "number":
      return checkNumber(field, answer);
    case "date":
      return isRealIsoDate(answer) ? undefined : "Enter a real date, for example 2026-08-01.";
    case "radio":
    case "select":
      return field.options.some((option) => option.value === answer)
        ? undefined
        : CHOICE_NOT_LISTED;
    case "telephone":
      return checkPhone(field, answer);
    case "text":
    case "textarea":
      return answer.length > field.maxLength ? tooLongMessage(field.maxLength) : undefined;
    // image and pdf hold asset ids the client cannot verify, and the server
    // checks them against the upload proof rather than against a rule.
    default:
      return undefined;
  }
}
