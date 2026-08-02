import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FormFieldControls } from "@/components/forms/form-field-controls";
import { parseFormDefinition } from "@/lib/forms/definition";
import { findAccessibilityViolations } from "../../../test/setup/axe";

/**
 * Component tests for the shared field renderer, replacing the source-text
 * guards that stood in for them while #52 was open.
 *
 * Fixtures are synthetic. Every real form is author-created with a changeable
 * title and slug, so a test built around one asserts content rather than
 * behaviour.
 */

function renderDefinition(
  fields: unknown[],
  options: { errors?: Record<string, string>; preview?: boolean } = {}
) {
  const definition = parseFormDefinition({ fields, payment: { enabled: false } });

  return render(
    <FormFieldControls
      definition={definition}
      errors={options.errors}
      idPrefix="form-test"
      preview={options.preview}
    />
  );
}

const question = (id: string, label: string) => ({
  id,
  label,
  required: false,
  type: "text",
});

const section = (id: string, label: string) => ({ id, label, type: "section" });

const TRACK_OPTIONS = [
  { label: "Web", value: "web" },
  { label: "Mobile", value: "mobile" },
];

const radioField = (overrides: Record<string, unknown> = {}) => ({
  id: "track",
  label: "Preferred track",
  options: TRACK_OPTIONS,
  required: false,
  type: "radio",
  ...overrides,
});

const checkboxGroupField = (overrides: Record<string, unknown> = {}) => ({
  id: "tracks",
  label: "Interested tracks",
  options: TRACK_OPTIONS,
  required: false,
  type: "multi_select",
  ...overrides,
});

describe("a section owns the questions it introduces", () => {
  it("puts each question inside the region its heading names", () => {
    renderDefinition([
      question("reference", "Reference number"),
      section("personal", "Personal details"),
      question("full_name", "Full name"),
      question("nickname", "Preferred name"),
    ]);

    // The defect this replaces: the heading sat in a `section` element that
    // wrapped nothing but itself, so aria-labelledby named a region containing
    // no controls at all.
    const personal = screen.getByRole("region", { name: "Personal details" });

    expect(within(personal).getByLabelText("Full name")).toBeInTheDocument();
    expect(within(personal).getByLabelText("Preferred name")).toBeInTheDocument();
  });

  it("leaves a question asked before the first heading outside every region", () => {
    renderDefinition([
      question("reference", "Reference number"),
      section("personal", "Personal details"),
      question("full_name", "Full name"),
    ]);

    const personal = screen.getByRole("region", { name: "Personal details" });

    expect(within(personal).queryByLabelText("Reference number")).toBeNull();
    expect(screen.getByLabelText("Reference number")).toBeInTheDocument();
  });

  it("still renders a heading that owns no questions", () => {
    // Two headings in a row is valid schema. The author wrote both.
    renderDefinition([
      section("intro", "Before you start"),
      section("personal", "Personal details"),
      question("full_name", "Full name"),
    ]);

    const intro = screen.getByRole("region", { name: "Before you start" });

    expect(intro).toBeInTheDocument();
    expect(within(intro).queryAllByRole("textbox")).toHaveLength(0);
    expect(
      within(screen.getByRole("region", { name: "Personal details" })).getByLabelText(
        "Full name"
      )
    ).toBeInTheDocument();
  });

  it("renders no region at all when the form has no headings", () => {
    renderDefinition([question("full_name", "Full name")]);

    expect(screen.queryAllByRole("region")).toHaveLength(0);
    expect(screen.getByLabelText("Full name")).toBeInTheDocument();
  });
});

describe("a required field says so in its accessible name", () => {
  it("announces the requirement rather than only setting the attribute", () => {
    renderDefinition([
      { id: "full_name", label: "Full name", required: true, type: "text" },
      question("nickname", "Preferred name"),
    ]);

    // The asterisk is aria-hidden and carries the visual weight; the sr-only
    // text is what is announced. Before #89 the marker was aria-hidden with no
    // replacement, leaving `required` as the only signal.
    const required = screen.getByRole("textbox", { name: /Full name/ });

    expect(required).toBeRequired();
    expect(required).toHaveAccessibleName(expect.stringContaining("(required)"));

    const optional = screen.getByRole("textbox", { name: /Preferred name/ });

    expect(optional).not.toBeRequired();
    expect(optional).not.toHaveAccessibleName(
      expect.stringContaining("(required)")
    );
  });

  it("marks a required checkbox, which previously carried no marker at all", () => {
    renderDefinition([
      { id: "reminders", label: "Send me reminders", required: true, type: "checkbox" },
    ]);

    // The checkbox branch used to mark `consent` alone, so a required checkbox
    // rendered with nothing.
    expect(screen.getByRole("checkbox")).toHaveAccessibleName(
      expect.stringContaining("(required)")
    );
  });

  it("marks consent, which the schema forces to be required", () => {
    renderDefinition([
      { id: "consent", label: "I confirm these details are accurate", required: true, type: "consent" },
    ]);

    const consent = screen.getByRole("checkbox");

    expect(consent).toBeRequired();
    expect(consent).toHaveAccessibleName(expect.stringContaining("(required)"));
  });
});

/**
 * Task 2.1. Every one of these was a source file that looked correct.
 *
 * The help text, the date note and the upload constraints were all rendered as
 * visible paragraphs beside the control they describe, and none of them was
 * associated with it. A screen reader announced the label and stopped.
 */
describe("a control is described by the text that explains it", () => {
  it("associates helpText with the control", () => {
    renderDefinition([
      {
        helpText: "Use the name printed on your student ID.",
        id: "full_name",
        label: "Full name",
        required: true,
        type: "text",
      },
    ]);

    // #94 asserted the absence of this description as current behaviour, so a
    // fix could not land without touching the test that described the defect.
    // This is that flip. The visible text was never the problem.
    expect(screen.getByRole("textbox")).toHaveAccessibleDescription(
      "Use the name printed on your student ID."
    );
  });

  it("describes a control with no help text as having no description", () => {
    renderDefinition([question("full_name", "Full name")]);

    // Guards against pointing aria-describedby at an element that does not
    // exist, which is worse than omitting it: the reference is dangling and
    // some screen readers announce nothing at all for the control.
    expect(screen.getByRole("textbox")).not.toHaveAccessibleDescription();
  });

  it("associates the browser date-format note with the date control", () => {
    renderDefinition([
      { id: "born_on", label: "Date of birth", required: false, type: "date" },
    ]);

    expect(screen.getByLabelText("Date of birth")).toHaveAccessibleDescription(
      /Shown in your browser/
    );
  });

  it("associates the upload constraints with the file control", () => {
    renderDefinition([
      { id: "id_card", label: "Student ID card", maxFiles: 1, required: false, type: "image" },
    ]);

    // These are the rules the server enforces. A respondent who cannot hear
    // them is being held to constraints nobody told them about.
    expect(screen.getByLabelText("Student ID card")).toHaveAccessibleDescription(
      /Maximum 10 MB per file/
    );
  });
});

describe("a failing field is reported beside the control", () => {
  it("marks the field invalid and announces the message as its description", () => {
    renderDefinition([question("full_name", "Full name")], {
      errors: { full_name: "Please answer this question." },
    });

    const control = screen.getByRole("textbox", { name: /Full name/ });

    expect(control).toHaveAttribute("aria-invalid", "true");
    expect(control).toHaveAccessibleDescription("Please answer this question.");
  });

  it("announces the message before the help text, not instead of it", () => {
    renderDefinition(
      [
        {
          helpText: "Use the name printed on your student ID.",
          id: "full_name",
          label: "Full name",
          required: true,
          type: "text",
        },
      ],
      { errors: { full_name: "Please answer this question." } }
    );

    // Order is announcement order. Someone who has just been told the field is
    // invalid needs to know why before being told how.
    expect(screen.getByRole("textbox")).toHaveAccessibleDescription(
      "Please answer this question. Use the name printed on your student ID."
    );
  });

  it("leaves every other field untouched", () => {
    renderDefinition(
      [question("full_name", "Full name"), question("nickname", "Preferred name")],
      { errors: { full_name: "Please answer this question." } }
    );

    expect(screen.getByRole("textbox", { name: /Preferred name/ })).not.toHaveAttribute(
      "aria-invalid"
    );
  });

  it("does not use role=alert on the message", () => {
    renderDefinition(
      [question("one", "One"), question("two", "Two"), question("three", "Three")],
      {
        errors: {
          one: "Please answer this question.",
          three: "Please answer this question.",
          two: "Please answer this question.",
        },
      }
    );

    // Three simultaneous alerts is three simultaneous announcements. The screen
    // moves focus to the first failing control instead, which announces its
    // name, its invalid state and its description together.
    expect(screen.queryAllByRole("alert")).toHaveLength(0);
  });

  it("reports a failing checkbox, select, date and file control too", () => {
    renderDefinition(
      [
        { id: "consent", label: "I confirm these details are accurate", required: true, type: "consent" },
        {
          id: "track",
          label: "Preferred track",
          options: [{ label: "Web", value: "web" }],
          required: true,
          type: "select",
        },
        { id: "born_on", label: "Date of birth", required: true, type: "date" },
        { id: "cv", label: "CV", maxFiles: 1, required: true, type: "pdf" },
      ],
      {
        errors: {
          born_on: "Please enter a date.",
          consent: "Please confirm this to continue.",
          cv: "Please choose a file.",
          track: "Please choose an option.",
        },
      }
    );

    expect(screen.getByRole("checkbox")).toHaveAccessibleDescription(
      "Please confirm this to continue."
    );
    expect(screen.getByRole("combobox")).toHaveAccessibleDescription(
      "Please choose an option."
    );
    expect(screen.getByLabelText(/Date of birth/)).toHaveAccessibleDescription(
      /Please enter a date/
    );
    expect(screen.getByLabelText(/CV/)).toHaveAccessibleDescription(
      /Please choose a file/
    );
  });

  it("never reports an error in the Studio preview", () => {
    renderDefinition([question("full_name", "Full name")], {
      errors: { full_name: "Please answer this question." },
      preview: true,
    });

    // A preview control is disabled and unnamed, so it cannot hold a value and
    // cannot have failed validation. An error on one would be fiction.
    const control = screen.getByRole("textbox", { name: /Full name/ });

    expect(control).toBeDisabled();
    expect(control).not.toHaveAttribute("aria-invalid");
    expect(screen.queryByText("Please answer this question.")).toBeNull();
  });
});

describe("a date field states where its format comes from", () => {
  it("explains the browser locale on a date field", () => {
    renderDefinition([
      { id: "born_on", label: "Date of birth", required: false, type: "date" },
    ]);

    // The native control accepts no display format, so a Bangladeshi respondent
    // may see mm/dd/yyyy. The stored value is ISO regardless; the risk is
    // misreading which box is the month.
    expect(screen.getByText(/Shown in your browser/)).toBeInTheDocument();
  });

  it("does not explain a format on a field that has none", () => {
    renderDefinition([
      { id: "age", label: "Age", required: false, type: "number" },
    ]);

    expect(screen.queryByText(/Shown in your browser/)).toBeNull();
  });
});

/**
 * Tasks 3.2 and 3.3.
 *
 * One describe for both, because they are one component: a `fieldset`/`legend`
 * group of native inputs sharing the field id as their name. The differences
 * that matter -- the input type, and where "required" is enforced -- each get
 * their own assertion below.
 *
 * The `multi_select` entry that used to sit in "known defects, asserted so a
 * fix cannot pass unnoticed" has moved here as a positive. That block held only
 * that one case and is gone with it; add it back the moment another known
 * defect needs pinning.
 */
describe("a choice question is a named group of native controls", () => {
  it("renders single choice as radios inside a group named by its legend", () => {
    renderDefinition([radioField()]);

    const group = screen.getByRole("group", { name: /Preferred track/ });

    expect(within(group).getAllByRole("radio")).toHaveLength(2);
    expect(screen.getByRole("radio", { name: "Web" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Mobile" })).toBeInTheDocument();
  });

  it("renders multi_select as a real checkbox group, which is what the Studio always called it", () => {
    renderDefinition([checkboxGroupField()]);

    // Task 3.3. This assertion previously pinned the defect: the Studio offered
    // "Checkbox choices" and the renderer emitted a `select multiple` listbox.
    // Flipped rather than deleted, per #96.
    const group = screen.getByRole("group", { name: /Interested tracks/ });

    expect(within(group).getAllByRole("checkbox")).toHaveLength(2);
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("submits the option value rather than the browser's default", () => {
    renderDefinition([checkboxGroupField(), radioField()]);

    // A native checkbox with no `value` submits the string "on". That would
    // store "on" and fail server validation with a message about an invalid
    // option, which reads like a backend fault rather than a missing attribute.
    expect(screen.getByRole("checkbox", { name: "Web" })).toHaveAttribute("value", "web");
    expect(screen.getByRole("radio", { name: "Mobile" })).toHaveAttribute("value", "mobile");
  });

  it("gives every member the field id as its control name", () => {
    renderDefinition([radioField()]);

    for (const radio of screen.getAllByRole("radio")) {
      expect(radio).toHaveAttribute("name", "track");
    }
  });

  it("puts the group's canonical id on the first option", () => {
    renderDefinition([radioField()]);

    // The failed-submit focus effect looks up `${idPrefix}-${field.id}` and a
    // fieldset is not focusable. Without this, a failing group is reported and
    // never focused, which loses half of task 2.2 for exactly the controls a
    // respondent is most likely to skip.
    expect(document.getElementById("form-test-track")).toBe(
      screen.getByRole("radio", { name: "Web" })
    );
  });

  it("keeps stored option values out of HTML ids", () => {
    renderDefinition([
      radioField({
        options: [
          { label: "Web", value: "web" },
          { label: "In person", value: "in person" },
        ],
      }),
    ]);

    const option = screen.getByRole("radio", { name: "In person" });

    expect(option).toHaveAttribute("value", "in person");
    expect(option).toHaveAttribute("id", "form-test-track-option-2");
    expect(option.id).not.toContain("in person");
  });

  it("announces the requirement once for the group, not once per option", () => {
    renderDefinition([radioField({ required: true })]);

    expect(screen.getByRole("group")).toHaveAccessibleName(
      expect.stringContaining("(required)")
    );
    expect(screen.getByRole("radio", { name: "Web" })).toHaveAccessibleName("Web");
  });

  it("marks radio members required, because the native rule is the correct one", () => {
    renderDefinition([radioField({ required: true })]);

    // `required` on radios sharing a name means "exactly one of these", which
    // is what the field means.
    for (const radio of screen.getAllByRole("radio")) {
      expect(radio).toBeRequired();
    }
  });

  it("leaves checkbox members unrequired, because the native rule is the wrong one", () => {
    renderDefinition([checkboxGroupField({ required: true })]);

    // `required` on a checkbox means *that* box must be ticked. Setting it on
    // every member of a "choose at least one" group would demand all of them,
    // so cardinality lives in collectNativeFieldErrors instead.
    for (const checkbox of screen.getAllByRole("checkbox")) {
      expect(checkbox).not.toBeRequired();
    }
  });

  it("describes every member with the error and the help text", () => {
    renderDefinition([radioField({ helpText: "Pick the one you would attend." })], {
      errors: { track: "Please choose an option." },
    });

    // Repeated on each member rather than placed on the fieldset: group-level
    // description support is inconsistent, and the message has to be heard
    // wherever focus lands.
    for (const radio of screen.getAllByRole("radio")) {
      expect(radio).toHaveAttribute("aria-invalid", "true");
      expect(radio).toHaveAccessibleDescription(
        "Please choose an option. Pick the one you would attend."
      );
    }
  });

  it("does not use role=alert on a group's message either", () => {
    renderDefinition([radioField(), checkboxGroupField()], {
      errors: {
        track: "Please choose an option.",
        tracks: "Please choose at least one option.",
      },
    });

    expect(screen.queryAllByRole("alert")).toHaveLength(0);
  });

  it("renders an inert, unnamed group in the Studio preview", () => {
    renderDefinition([radioField({ required: true })], {
      errors: { track: "Please choose an option." },
      preview: true,
    });

    for (const radio of screen.getAllByRole("radio")) {
      expect(radio).toBeDisabled();
      expect(radio).not.toBeRequired();
      expect(radio).not.toHaveAttribute("name");
    }

    expect(screen.queryByText("Please choose an option.")).toBeNull();
  });
});

/**
 * The compatibility contract for task 3.3, asserted against a definition
 * written the way one already sits in the database.
 *
 * The presentation changed and the stored shape did not. Nothing about this
 * fixture is new: no `radio`, no added property, no re-publish. If this test
 * ever needs editing to pass, an existing published form has broken.
 */
describe("an existing multi_select definition keeps working untouched", () => {
  const STORED_DEFINITION = {
    fields: [
      { id: "full_name", label: "Full name", required: true, type: "text" },
      {
        id: "tracks",
        label: "Interested tracks",
        options: [
          { label: "Web", value: "web" },
          { label: "Mobile", value: "mobile" },
        ],
        required: false,
        type: "multi_select",
      },
    ],
    payment: { enabled: false },
  };

  it("parses unchanged and renders as checkboxes", () => {
    const definition = parseFormDefinition(STORED_DEFINITION);

    render(<FormFieldControls definition={definition} idPrefix="form-test" />);

    expect(screen.getAllByRole("checkbox")).toHaveLength(2);
  });

  it("still produces the same array of option values it always did", () => {
    const definition = parseFormDefinition(STORED_DEFINITION);

    render(
      <form>
        <FormFieldControls definition={definition} idPrefix="form-test" />
      </form>
    );

    const web = screen.getByRole("checkbox", { name: "Web" });
    const mobile = screen.getByRole("checkbox", { name: "Mobile" });
    web.click();
    mobile.click();

    // The point of the whole slice: `getAll` returned a multi-select's selected
    // options and returns a checkbox group's ticked values, so `toAnswers` did
    // not have to change and no stored submission means anything different.
    const formElement = web.closest("form");
    if (!formElement) throw new Error("The fixture form is missing.");

    expect(new FormData(formElement).getAll("tracks")).toEqual(["web", "mobile"]);
  });
});

describe("accessibility of a form using every control", () => {
  const everyControl = [
    section("personal", "Personal details"),
    { id: "full_name", label: "Full name", required: true, type: "text" },
    { id: "email", label: "Email address", required: true, type: "email" },
    { id: "phone", label: "Phone number", required: false, type: "telephone" },
    { id: "about", label: "About you", required: false, type: "textarea" },
    { id: "age", label: "Age", required: false, type: "number" },
    { id: "born_on", label: "Date of birth", required: false, type: "date" },
    section("extras", "Anything else"),
    {
      id: "track",
      label: "Preferred track",
      options: [{ label: "Web", value: "web" }],
      required: false,
      type: "select",
    },
    {
      id: "attendance",
      label: "How will you attend",
      options: [
        { label: "In person", value: "in_person" },
        { label: "Online", value: "online" },
      ],
      required: false,
      type: "radio",
    },
    {
      id: "tracks",
      label: "Interested tracks",
      options: [
        { label: "Web", value: "web" },
        { label: "Mobile", value: "mobile" },
      ],
      required: false,
      type: "multi_select",
    },
    { id: "reminders", label: "Send me reminders", required: false, type: "checkbox" },
    { id: "id_card", label: "Student ID card", maxFiles: 1, required: false, type: "image" },
    { id: "cv", label: "CV", maxFiles: 1, required: false, type: "pdf" },
    { id: "consent", label: "I confirm these details are accurate", required: true, type: "consent" },
  ];

  it("reports no axe violations", async () => {
    const { container } = renderDefinition(everyControl);

    // Rendered without a surrounding form or landmark on purpose: this is the
    // renderer's own contract. The page-level structure is asserted where the
    // page is assembled.
    const violations = await findAccessibilityViolations(container);

    expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
  });

  it("reports no axe violations with errors on screen", async () => {
    const { container } = renderDefinition(everyControl, {
      errors: {
        attendance: "Please choose an option.",
        consent: "Please confirm this to continue.",
        email: "Please answer this question.",
        full_name: "Please answer this question.",
        tracks: "Please choose at least one option.",
      },
    });

    // The failing state is the one nobody screenshots, so it is the one where a
    // dangling aria-describedby or an orphaned message would survive review.
    // Both group controls fail here, because a repeated describedby is exactly
    // the kind of thing that produces a dangling reference.
    const violations = await findAccessibilityViolations(container);

    expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
  });
});
