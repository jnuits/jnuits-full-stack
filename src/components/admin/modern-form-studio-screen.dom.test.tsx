import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FormInventoryProvider } from "@/components/admin/form-inventory-context";
import { ModernFormStudioScreen } from "@/components/admin/modern-form-studio-screen";
import { STUDIO_HELP_TEXT_MAX_LENGTH } from "@/lib/forms/form-studio-definition";

/**
 * Component tests for task 3.1, the help text authoring input.
 *
 * These drive the editor and then read the description off the real control in
 * the respondent preview, rather than asserting that state was stored. Storing
 * the text was never the hard part: task 2.1 existed because help text was
 * rendered correctly and associated with nothing, and a test that stops at the
 * editor would have shipped that defect a second time.
 */

const INVENTORY_ENDPOINT = "/api/admin/forms?pageSize=100";

/**
 * The inventory request the provider makes on mount, answered with nothing.
 *
 * An empty inventory is deliberate: a form card renders `next/link`, which needs
 * an App Router this test does not mount. The recorded call list is asserted, so
 * a future panel that quietly fetches something else shows up here (finding
 * 14.5 — assert what ran, not only that nothing failed).
 */
function stubFetch() {
  const calls: string[] = [];

  vi.stubGlobal(
    "fetch",
    vi.fn((input: unknown) => {
      calls.push(String(input));
      return Promise.resolve({ json: () => Promise.resolve({ items: [] }), ok: true });
    })
  );

  return { calls };
}

async function renderStudio() {
  const stub = stubFetch();
  const user = userEvent.setup();

  render(
    <FormInventoryProvider publicBaseUrl="https://jnuits.org.bd">
      <ModernFormStudioScreen />
    </FormInventoryProvider>
  );

  // Flushes the provider's initial load inside act, so the first assertion is
  // not racing a state update.
  expect(await screen.findByText("No forms yet. Create your first draft.")).toBeInTheDocument();

  return { stub, user };
}

/**
 * The hint sits inside the label, as it does for every other field on this
 * screen, so the accessible label is the caption followed by the hint.
 */
const helpTextInputs = () => screen.getAllByLabelText(/^Help text/);

const previewRegion = () => screen.getByRole("region", { name: "Form preview" });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("authoring help text in the Form Studio", () => {
  it("offers the input on every question", async () => {
    await renderStudio();

    // The starter membership form is all questions, so every card has one.
    expect(helpTextInputs().length).toBe(screen.getAllByLabelText("Question type").length);
  });

  it("withholds the input from a section heading", async () => {
    const { user } = await renderStudio();
    const before = helpTextInputs().length;

    await user.selectOptions(screen.getAllByLabelText("Question type")[0], "section");

    // A section's help text is still rendered beside the region it introduces
    // without being associated with it, which is the defect task 2.1 removed
    // everywhere else. Authoring text assistive technology cannot reach is worse
    // than not offering the input, so it waits for #95.
    expect(helpTextInputs()).toHaveLength(before - 1);
  });

  it("carries authored help text into the preview as the control's description", async () => {
    const { user } = await renderStudio();

    await user.type(helpTextInputs()[0], "As printed on your student ID.");
    await user.click(screen.getByRole("button", { name: /Preview/ }));

    const preview = previewRegion();

    // The whole chain: editor state, studioFieldsToDefinition, the renderer's
    // aria-describedby. The preview renders the same control a respondent gets.
    expect(within(preview).getByRole("textbox", { name: /Full name/ })).toHaveAccessibleDescription(
      "As printed on your student ID."
    );
  });

  it("leaves a question with no help text with no description at all", async () => {
    const { user } = await renderStudio();

    await user.type(helpTextInputs()[0], "As printed on your student ID.");
    await user.click(screen.getByRole("button", { name: /Preview/ }));

    // Guards against describing every control the moment one of them is
    // described: a dangling or empty description is worse than none, because
    // some screen readers then announce nothing for the control.
    expect(
      within(previewRegion()).getByRole("textbox", { name: /Email address/ })
    ).not.toHaveAccessibleDescription();
  });

  it("treats whitespace as no help text", async () => {
    const { user } = await renderStudio();

    await user.type(helpTextInputs()[0], "   ");
    await user.click(screen.getByRole("button", { name: /Preview/ }));

    // An empty string parses, and then aria-describedby points at an empty
    // paragraph: a description that announces nothing.
    expect(
      within(previewRegion()).getByRole("textbox", { name: /Full name/ })
    ).not.toHaveAccessibleDescription();
  });

  it("caps the input where the schema caps it", async () => {
    await renderStudio();

    // Not cosmetic. The schema rejects a longer value, so without the cap the
    // operator learns about the limit when the save fails, after writing past it.
    expect(helpTextInputs()[0]).toHaveAttribute(
      "maxlength",
      String(STUDIO_HELP_TEXT_MAX_LENGTH)
    );
  });

  it("loads the inventory and asks for nothing else", async () => {
    const { stub } = await renderStudio();

    // The linkable-events query belongs to event registration forms. A default
    // membership draft that triggers it is a regression, and a passing suite
    // would otherwise say nothing about it.
    expect(stub.calls).toEqual([INVENTORY_ENDPOINT]);
  });
});
