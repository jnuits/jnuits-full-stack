import type { FormDefinition, FormField } from "@/lib/forms/definition";

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
