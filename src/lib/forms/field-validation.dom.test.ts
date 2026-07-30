import { describe, expect, it } from "vitest";

import { parseFormDefinition } from "@/lib/forms/definition";
import {
  collectNativeFieldErrors,
  firstFieldWithError,
  resolveValidatableControls,
} from "@/lib/forms/field-validation";

/**
 * Task 2.1. Reads real constraint validity from real controls, so the fixtures
 * are hand-built form elements rather than the React renderer: the point is
 * what the DOM reports, not what the renderer emits.
 */

function formWith(html: string) {
  const form = document.createElement("form");
  form.noValidate = true;
  form.innerHTML = html;
  document.body.append(form);

  return form;
}

const definitionOf = (fields: unknown[]) =>
  parseFormDefinition({ fields, payment: { enabled: false } });

describe("resolving a control name to validatable controls", () => {
  it("resolves a single named control", () => {
    const form = formWith('<input name="full_name" required />');

    expect(resolveValidatableControls(form.elements.namedItem("full_name"))).toHaveLength(1);
  });

  it("resolves every member of a group sharing one name", () => {
    // This is the shape `namedItem` returns for a repeated name: a
    // RadioNodeList, not an Element. Tasks 3.2 and 3.3 introduce exactly this,
    // and a resolver that only understood the single-element shape would skip
    // the whole group without reporting anything.
    const form = formWith(`
      <input name="track" type="radio" value="web" required />
      <input name="track" type="radio" value="mobile" required />
    `);

    expect(resolveValidatableControls(form.elements.namedItem("track"))).toHaveLength(2);
  });

  it("drops disabled members, which cannot participate in validation", () => {
    const form = formWith(`
      <input name="track" type="radio" value="web" required />
      <input disabled name="track" type="radio" value="mobile" required />
    `);

    expect(resolveValidatableControls(form.elements.namedItem("track"))).toHaveLength(1);
  });

  it("resolves nothing for a disabled single control", () => {
    const form = formWith('<input disabled name="full_name" required />');

    expect(resolveValidatableControls(form.elements.namedItem("full_name"))).toEqual([]);
  });

  it("resolves nothing for a name that is absent", () => {
    const form = formWith('<input name="full_name" />');

    expect(resolveValidatableControls(form.elements.namedItem("missing"))).toEqual([]);
  });
});

describe("collecting field errors from constraint validity", () => {
  it("reports a missing required answer with a message written for the field type", () => {
    const form = formWith(`
      <input name="full_name" required />
      <input name="reminders" required type="checkbox" />
      <input name="born_on" required type="date" />
    `);
    const definition = definitionOf([
      { id: "full_name", label: "Full name", required: true, type: "text" },
      { id: "reminders", label: "Send me reminders", required: true, type: "checkbox" },
      { id: "born_on", label: "Date of birth", required: true, type: "date" },
    ]);

    // The browser's own valueMissing text is "Please fill out this field",
    // which is wrong for a checkbox and wrong for a date.
    expect(collectNativeFieldErrors(form, definition)).toEqual({
      born_on: "Please enter a date.",
      full_name: "Please answer this question.",
      reminders: "Please tick this box to continue.",
    });
  });

  it("reports nothing when every answer satisfies its constraints", () => {
    const form = formWith('<input name="full_name" required value="Redwan" />');
    const definition = definitionOf([
      { id: "full_name", label: "Full name", required: true, type: "text" },
    ]);

    expect(collectNativeFieldErrors(form, definition)).toEqual({});
  });

  it("never reports the honeypot or the challenge token", () => {
    // Both are present in the form element and neither is a question. The
    // honeypot is aria-hidden, so reporting it would tell a respondent to fix a
    // field built to be invisible.
    const form = formWith(`
      <input name="full_name" required />
      <input name="website" required />
      <input name="captchaToken" required type="hidden" />
    `);
    const definition = definitionOf([
      { id: "full_name", label: "Full name", required: true, type: "text" },
    ]);

    expect(Object.keys(collectNativeFieldErrors(form, definition))).toEqual(["full_name"]);
  });

  it("keeps the browser's own message for a failure other than a missing value", () => {
    const form = formWith('<input name="email" required type="email" value="not-an-email" />');
    const definition = definitionOf([
      { id: "email", label: "Email address", required: true, type: "email" },
    ]);
    const errors = collectNativeFieldErrors(form, definition);

    // The browser localises these and this application does not, so the native
    // text is kept rather than replaced with English.
    expect(errors.email).toBeTruthy();
    expect(errors.email).not.toBe("Please answer this question.");
  });

  it("skips a field with no control in the form", () => {
    const form = formWith('<input name="full_name" required />');
    const definition = definitionOf([
      { id: "full_name", label: "Full name", required: true, type: "text" },
      { id: "absent", label: "Not rendered", required: true, type: "text" },
    ]);

    expect(Object.keys(collectNativeFieldErrors(form, definition))).toEqual(["full_name"]);
  });
});

describe("choosing the field to focus", () => {
  it("returns the earliest failing question in definition order", () => {
    const definition = definitionOf([
      { id: "full_name", label: "Full name", required: true, type: "text" },
      { id: "email", label: "Email address", required: true, type: "email" },
    ]);

    // Key insertion order is deliberately reversed here. Object order is not
    // the order a respondent reads the form in.
    expect(
      firstFieldWithError(definition, {
        email: "Please answer this question.",
        full_name: "Please answer this question.",
      })
    ).toBe("full_name");
  });

  it("skips section headings, which hold no answer", () => {
    const definition = definitionOf([
      { id: "personal", label: "Personal details", type: "section" },
      { id: "full_name", label: "Full name", required: true, type: "text" },
    ]);

    expect(
      firstFieldWithError(definition, { full_name: "Please answer this question." })
    ).toBe("full_name");
  });

  it("returns null when nothing failed", () => {
    const definition = definitionOf([
      { id: "full_name", label: "Full name", required: true, type: "text" },
    ]);

    expect(firstFieldWithError(definition, {})).toBeNull();
  });
});
