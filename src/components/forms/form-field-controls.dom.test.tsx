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

function renderDefinition(fields: unknown[]) {
  const definition = parseFormDefinition({ fields, payment: { enabled: false } });

  return render(<FormFieldControls definition={definition} idPrefix="form-test" />);
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
 * These two tests describe defects that are already tracked. They exist so the
 * fix cannot land without updating the test that describes the old shape, which
 * is the only reliable way to keep a known defect from quietly becoming
 * permanent.
 */
describe("known defects, asserted so a fix cannot pass unnoticed", () => {
  it("renders helpText visually but never associates it with the control", () => {
    renderDefinition([
      {
        helpText: "Use the name printed on your student ID.",
        id: "full_name",
        label: "Full name",
        required: true,
        type: "text",
      },
    ]);

    // The text is on screen, so it looks correct in a screenshot and in source.
    expect(
      screen.getByText("Use the name printed on your student ID.")
    ).toBeInTheDocument();

    // But nothing links it to the input, so a screen reader announces the label
    // and never the guidance. No amount of source-text guarding could see this;
    // the source looks entirely right.
    //
    // Task 2.1 adds aria-describedby. When it lands, flip this to
    // toHaveAccessibleDescription and delete the comment.
    expect(screen.getByRole("textbox")).not.toHaveAccessibleDescription();
  });

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
  it("reports no axe violations", async () => {
    const { container } = renderDefinition([
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
    ]);

    // Rendered without a surrounding form or landmark on purpose: this is the
    // renderer's own contract. The page-level structure is asserted where the
    // page is assembled.
    const violations = await findAccessibilityViolations(container);

    expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
  });
});
