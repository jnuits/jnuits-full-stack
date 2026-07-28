import type { FormDefinition, FormField, FormKind } from "@/lib/forms/definition";

/**
 * Presentation logic for the public form, kept out of the client component so
 * it can be tested as plain functions.
 *
 * This repository has no jsdom or Testing Library setup (#52), so anything left
 * inside the component can only be asserted as source text. Moving the parts
 * that can actually be wrong out here buys real tests instead.
 */

export type FormSectionField = Extract<FormField, { type: "section" }>;
export type FormQuestionField = Exclude<FormField, { type: "section" }>;

/**
 * A section heading and the questions it introduces.
 *
 * `section` is null for questions that appear before any heading, which the
 * schema permits and which most short forms consist entirely of.
 */
export type FormFieldGroup = {
  fields: FormQuestionField[];
  section: FormSectionField | null;
};

/**
 * Partitions a flat field list into heading-owned groups.
 *
 * The schema stores fields as one ordered array with `section` entries acting
 * as delimiters, so the grouping is implied by position and has to be derived.
 *
 * Deliberate about the awkward cases, all of which are valid schema:
 *
 *   - Questions before the first heading become one group with no section.
 *   - Two consecutive headings mean the first owns no questions. It is still
 *     emitted, because the author wrote a heading and expects to see it.
 *   - A trailing heading with nothing after it is emitted for the same reason.
 *   - An empty leading group is never emitted, so a form that opens with a
 *     heading does not render a stray empty container above it.
 */
export function groupFormFields(definition: FormDefinition): FormFieldGroup[] {
  const groups: FormFieldGroup[] = [];
  let current: FormFieldGroup = { fields: [], section: null };

  for (const field of definition.fields) {
    if (field.type === "section") {
      if (current.section || current.fields.length) {
        groups.push(current);
      }
      current = { fields: [], section: field };
      continue;
    }

    current.fields.push(field);
  }

  if (current.section || current.fields.length) {
    groups.push(current);
  }

  return groups;
}

/**
 * Category label shown above the form title, matching the eyebrow pattern used
 * by every other public page.
 */
export const FORM_KIND_EYEBROWS: Record<FormKind, string> = {
  alumni_onboarding: "Alumni onboarding",
  event_registration: "Event registration",
  membership_application: "Membership application",
};

/**
 * @returns the eyebrow, or null when it would merely repeat the title.
 *
 * Both published forms are currently titled exactly after their kind, so an
 * unguarded eyebrow would render the same words twice, one above the other.
 * That reads as a template mistake rather than as framing.
 */
export function resolveFormEyebrow(kind: FormKind, title: string): null | string {
  const eyebrow = FORM_KIND_EYEBROWS[kind];
  if (!eyebrow) {
    return null;
  }

  return eyebrow.trim().toLowerCase() === title.trim().toLowerCase() ? null : eyebrow;
}

/**
 * Below this, a count is noise rather than an affordance: nobody needs warning
 * that a four-question form is four questions long.
 */
export const LENGTH_SUMMARY_MIN_QUESTIONS = 7;

/**
 * @returns a short "how long is this" line, or null when the form is short and
 * flat enough that stating its size tells the respondent nothing.
 *
 * Two or more sections qualify regardless of question count, because structure
 * is worth previewing even when the form is brief.
 */
export function resolveFormLengthSummary(definition: FormDefinition): null | string {
  const sections = groupFormFields(definition).filter((group) => group.section).length;
  const questions = definition.fields.filter((field) => field.type !== "section").length;

  if (questions < LENGTH_SUMMARY_MIN_QUESTIONS && sections < 2) {
    return null;
  }

  const questionText = `${questions} question${questions === 1 ? "" : "s"}`;

  return sections >= 2 ? `${questionText} in ${sections} sections` : questionText;
}
