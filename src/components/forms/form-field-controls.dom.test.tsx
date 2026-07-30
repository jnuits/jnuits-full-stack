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
 * Documented current behaviour, not endorsed behaviour.
 *
 * Asserts a defect that is already tracked, so the fix cannot land without
 * updating the test that describes the old shape. That is the only reliable way
 * to keep a known defect from quietly becoming permanent.
 *
 * The helpText entry that used to live here has been removed: task 2.1 fixed it,
 * and its assertion now sits in "a control is described by the text that
 * explains it" as a positive.
 */
describe("known defects, asserted so a fix cannot pass unnoticed", () => {
  it("renders multi_select as a listbox while the Studio calls it a checkbox group", () => {
    renderDefinition([
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
    ]);

    // Task 3.3. The label and the control disagree: the Studio offers
    // "Checkbox choices" and this renders a multi-select list box.
    expect(screen.getByRole("listbox", { name: /Interested tracks/ })).toBeInTheDocument();
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
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
        consent: "Please confirm this to continue.",
        email: "Please answer this question.",
        full_name: "Please answer this question.",
      },
    });

    // The failing state is the one nobody screenshots, so it is the one where a
    // dangling aria-describedby or an orphaned message would survive review.
    const violations = await findAccessibilityViolations(container);

    expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
  });
});
