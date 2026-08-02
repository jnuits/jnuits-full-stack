import { describe, expect, it } from "vitest";

import {
  PUBLIC_FORM_CAPTCHA_CONTROL_NAME,
  PUBLIC_FORM_HONEYPOT_CONTROL_NAME,
} from "@/lib/forms/control-names";
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

const TRACK_OPTIONS = [
  { label: "Web", value: "web" },
  { label: "Mobile", value: "mobile" },
];

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

  it("validates a Website question without colliding with non-question controls", () => {
    const form = formWith(`
      <input name="website" required />
      <input name="${PUBLIC_FORM_HONEYPOT_CONTROL_NAME}" />
      <input name="${PUBLIC_FORM_CAPTCHA_CONTROL_NAME}" type="hidden" />
    `);
    const definition = definitionOf([
      { id: "website", label: "Website", required: true, type: "text" },
    ]);

    expect(form.querySelectorAll('[name="website"]')).toHaveLength(1);
    expect(collectNativeFieldErrors(form, definition)).toEqual({
      website: "Please answer this question.",
    });
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

/**
 * Tasks 3.2 and 3.3. The two group controls fail in different ways, and only
 * one of them is the browser's job.
 */
describe("collecting field errors from a group of controls", () => {
  const radioForm = () =>
    formWith(`
      <input name="track" required type="radio" value="web" />
      <input name="track" required type="radio" value="mobile" />
    `);

  const checkboxForm = () =>
    formWith(`
      <input name="tracks" type="checkbox" value="web" />
      <input name="tracks" type="checkbox" value="mobile" />
    `);

  const radioDefinition = (required: boolean) =>
    definitionOf([
      { id: "track", label: "Preferred track", options: TRACK_OPTIONS, required, type: "radio" },
    ]);

  const checkboxDefinition = (required: boolean) =>
    definitionOf([
      { id: "tracks", label: "Interested tracks", options: TRACK_OPTIONS, required, type: "multi_select" },
    ]);

  function check(form: HTMLFormElement, value: string) {
    const control = form.querySelector(`[value="${value}"]`);

    if (!(control instanceof HTMLInputElement)) {
      throw new Error(`The fixture has no control valued "${value}".`);
    }

    control.checked = true;
  }

  it("reports one message for a required radio group with nothing selected", () => {
    // Native validity already means "exactly one of these", so this arrives
    // through checkValidity rather than through the cardinality branch. One
    // message for the group, not one per option.
    expect(collectNativeFieldErrors(radioForm(), radioDefinition(true))).toEqual({
      track: "Please choose an option.",
    });
  });

  it("reports nothing once a radio in the group is selected", () => {
    const form = radioForm();
    check(form, "mobile");

    expect(collectNativeFieldErrors(form, radioDefinition(true))).toEqual({});
  });

  it("reports a required checkbox group with nothing ticked, which the browser will not", () => {
    const form = checkboxForm();
    const controls = resolveValidatableControls(form.elements.namedItem("tracks"));

    // The members carry no `required` attribute, because on a checkbox that
    // would demand every box. Constraint validation therefore reports nothing,
    // which is asserted here rather than assumed: it is the entire reason the
    // cardinality rule has to live in our code.
    expect(controls).toHaveLength(2);
    expect(controls.every((control) => control.checkValidity())).toBe(true);

    expect(collectNativeFieldErrors(form, checkboxDefinition(true))).toEqual({
      tracks: "Please choose at least one option.",
    });
  });

  it("reports nothing once one box is ticked, not once per unticked box", () => {
    const form = checkboxForm();
    check(form, "web");

    expect(collectNativeFieldErrors(form, checkboxDefinition(true))).toEqual({});
  });

  it("leaves an optional checkbox group alone", () => {
    expect(collectNativeFieldErrors(checkboxForm(), checkboxDefinition(false))).toEqual({});
  });

  it("says \"at least one\" for a group and \"an option\" for a single choice", () => {
    // Different instructions. "Please choose an option" beside a checkbox group
    // reads as though only one is permitted.
    const radioErrors = collectNativeFieldErrors(radioForm(), radioDefinition(true));
    const checkboxErrors = collectNativeFieldErrors(checkboxForm(), checkboxDefinition(true));

    expect(radioErrors.track).toBe("Please choose an option.");
    expect(checkboxErrors.tracks).toBe("Please choose at least one option.");
  });
});

/**
 * Task 2.3, and the reason it is a second pass rather than a replacement.
 *
 * Every assertion here states the browser's verdict before the rule's. If a
 * future jsdom or a future browser changes its mind about one of these, the
 * failure should name the reason rather than looking as though the rule broke
 * (finding 14.5: assert the thing, not only the outcome).
 */
describe("the shared rules, where constraint validation cannot reach", () => {
  function control(form: HTMLFormElement, name: string) {
    const found = form.elements.namedItem(name);

    if (!(found instanceof HTMLInputElement)) {
      throw new Error(`The fixture has no single control named "${name}".`);
    }

    return found;
  }

  it("catches an address the browser accepts and the server rejects", () => {
    // Task 2.5. The HTML spec's email syntax permits a bare domain label, so
    // `<input type="email">` is satisfied by someone@localhost while
    // z.string().email() is not. That gap produced a clean submit followed by a
    // top-level rejection naming no field.
    const form = formWith('<input name="email" required type="email" value="someone@localhost" />');
    const definition = definitionOf([
      { id: "email", label: "Email address", required: true, type: "email" },
    ]);

    expect(control(form, "email").checkValidity()).toBe(true);
    expect(collectNativeFieldErrors(form, definition)).toEqual({
      email: "Enter an email address in the form name@example.com.",
    });
  });

  it("leaves a well-formed address alone", () => {
    const form = formWith('<input name="email" required type="email" value="member@example.test" />');
    const definition = definitionOf([
      { id: "email", label: "Email address", required: true, type: "email" },
    ]);

    expect(collectNativeFieldErrors(form, definition)).toEqual({});
  });

  it("defers to the browser on a number out of range, because that message is localised", () => {
    const form = formWith('<input max="5" name="guests" type="number" value="6" />');
    const definition = definitionOf([
      { id: "guests", label: "Guests", max: 5, required: false, type: "number" },
    ]);

    // Task 2.7 surfaces the range as an affordance; it deliberately does not
    // take over the message. Replacing localised native text with English would
    // be a regression for a Bangla-locale respondent.
    const guests = control(form, "guests");

    expect(guests.validity.rangeOverflow).toBe(true);
    expect(guests.validationMessage).not.toBe("");
    expect(collectNativeFieldErrors(form, definition).guests).toBe(
      guests.validationMessage
    );
  });

  it("reads the selected radio, not the first one", () => {
    // A crafted or replayed value. Neither control can produce it by hand, but
    // the server has always rejected it and now the client says so first.
    const form = formWith(`
      <input name="track" type="radio" value="web" />
      <input checked name="track" type="radio" value="desktop" />
    `);
    const definition = definitionOf([
      { id: "track", label: "Preferred track", options: TRACK_OPTIONS, required: false, type: "radio" },
    ]);

    expect(collectNativeFieldErrors(form, definition)).toEqual({
      track: "Choose one of the listed options.",
    });
  });

  it("reads every ticked box in a group", () => {
    const form = formWith(`
      <input checked name="tracks" type="checkbox" value="web" />
      <input checked name="tracks" type="checkbox" value="desktop" />
    `);
    const definition = definitionOf([
      { id: "tracks", label: "Interested tracks", options: TRACK_OPTIONS, required: false, type: "multi_select" },
    ]);

    expect(collectNativeFieldErrors(form, definition)).toEqual({
      tracks: "Choose one of the listed options.",
    });
  });

  it("never rule-checks a file control, whose value is a fake path", () => {
    const form = formWith('<input name="cv" type="file" />');
    const definition = definitionOf([
      { id: "cv", label: "CV", maxFiles: 1, required: false, type: "pdf" },
    ]);

    // The real answer is an asset id that does not exist until the upload
    // finishes, and the server checks those against the upload proof.
    expect(collectNativeFieldErrors(form, definition)).toEqual({});
  });

  it("says nothing about an empty optional question", () => {
    const form = formWith('<input name="email" type="email" value="" />');
    const definition = definitionOf([
      { id: "email", label: "Email address", required: false, type: "email" },
    ]);

    expect(collectNativeFieldErrors(form, definition)).toEqual({});
  });

  it("reports at most one message per field", () => {
    // Both passes can have an opinion about the same control. The native one
    // wins and the loop moves on, so a respondent never sees two messages
    // stacked under one question.
    const form = formWith('<input name="email" required type="email" value="" />');
    const definition = definitionOf([
      { id: "email", label: "Email address", required: true, type: "email" },
    ]);

    expect(collectNativeFieldErrors(form, definition)).toEqual({
      email: "Please answer this question.",
    });
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
