import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  FormInventoryProvider,
  type FormInventoryItem,
} from "@/components/admin/form-inventory-context";
import { ModernFormStudioScreen } from "@/components/admin/modern-form-studio-screen";
import { STUDIO_HELP_TEXT_MAX_LENGTH } from "@/lib/forms/form-studio-definition";
import { findAccessibilityViolations } from "../../../test/setup/axe";

vi.mock("next/link", () => ({
  default: ({ children, ...props }: ComponentProps<"a">) => <a {...props}>{children}</a>,
}));

const INVENTORY_ENDPOINT = "/api/admin/forms?pageSize=100";
const PUBLISHED_FORM: FormInventoryItem = {
  currentPublishedVersionId: "22222222-2222-4222-8222-222222222222",
  id: "11111111-1111-4111-8111-111111111111",
  kind: "membership_application",
  lifecycle: "published",
  slug: "membership-application",
  title: "Membership application",
};

function stubFetch(items: FormInventoryItem[] = []) {
  const calls: string[] = [];

  vi.stubGlobal(
    "fetch",
    vi.fn((input: unknown) => {
      calls.push(String(input));
      return Promise.resolve({ json: () => Promise.resolve({ items }), ok: true });
    })
  );

  return { calls };
}

async function renderStudio(items: FormInventoryItem[] = []) {
  const stub = stubFetch(items);
  const user = userEvent.setup();
  const rendered = render(
    <FormInventoryProvider publicBaseUrl="https://jnuits.org.bd">
      <ModernFormStudioScreen />
    </FormInventoryProvider>
  );

  if (items.length) {
    expect(await screen.findByText(items[0].title)).toBeInTheDocument();
  } else {
    expect(await screen.findByText("No forms yet. Create your first draft.")).toBeInTheDocument();
  }

  return { container: rendered.container, stub, user };
}

const helpTextInputs = () => screen.getAllByLabelText("Help text");
const previewRegion = () => screen.getByRole("region", { name: "Form preview" });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("authoring help text in the Form Studio", () => {
  it("offers an exactly labelled, described input on every question", async () => {
    await renderStudio();

    expect(helpTextInputs()).toHaveLength(screen.getAllByLabelText("Question type").length);
    expect(helpTextInputs()[0]).toHaveAccessibleName("Help text");
    expect(helpTextInputs()[0]).toHaveAccessibleDescription(
      /Up to 500 characters.*0 \/ 500 characters/
    );
    expect(screen.getByRole("combobox", { name: "Email address" })).toHaveAccessibleDescription(
      "Used for confirmation and review notices."
    );
  });

  it("clears authored help text when a question becomes a section heading", async () => {
    const { user } = await renderStudio();
    const guidance = "This guidance must not become hidden.";

    await user.type(helpTextInputs()[0], guidance);
    await user.selectOptions(screen.getAllByLabelText("Question type")[0], "section");
    await user.click(screen.getByRole("button", { name: /Preview/ }));

    expect(helpTextInputs()).toHaveLength(screen.getAllByLabelText("Question type").length - 1);
    expect(within(previewRegion()).queryByText(guidance)).toBeNull();
  });

  it("carries authored help text into the preview as the control's description", async () => {
    const { user } = await renderStudio();

    await user.type(helpTextInputs()[0], "As printed on your student ID.");
    await user.click(screen.getByRole("button", { name: /Preview/ }));

    expect(
      within(previewRegion()).getByRole("textbox", { name: /Full name/ })
    ).toHaveAccessibleDescription("As printed on your student ID.");
  });

  it("omits absent and whitespace-only help text from the preview", async () => {
    const { user } = await renderStudio();

    await user.type(helpTextInputs()[0], "   ");
    await user.click(screen.getByRole("button", { name: /Preview/ }));

    expect(
      within(previewRegion()).getByRole("textbox", { name: /Full name/ })
    ).not.toHaveAccessibleDescription();
    expect(
      within(previewRegion()).getByRole("textbox", { name: /Email address/ })
    ).not.toHaveAccessibleDescription();
  });

  it("shows the live count and announces only threshold changes", async () => {
    await renderStudio();
    const input = helpTextInputs()[0];
    const field = input.parentElement;

    expect(input).toHaveAttribute("maxlength", String(STUDIO_HELP_TEXT_MAX_LENGTH));
    if (!field) throw new Error("Help text field shell is missing.");

    fireEvent.change(input, { target: { value: "a".repeat(400) } });
    expect(input).toHaveAccessibleDescription(/400 \/ 500 characters/);
    expect(await within(field).findByRole("status")).toHaveTextContent(
      "Approaching the 500 character limit."
    );

    fireEvent.change(input, { target: { value: "a".repeat(401) } });
    expect(within(field).getByRole("status")).toHaveTextContent(
      "Approaching the 500 character limit."
    );
  });

  it("loads the inventory and asks for nothing else", async () => {
    const { stub } = await renderStudio();
    expect(stub.calls).toEqual([INVENTORY_ENDPOINT]);
  });
});

describe("inventory cards and accessibility", () => {
  it("renders a published card with its canonical URL and copy fallback", async () => {
    const { user } = await renderStudio([PUBLISHED_FORM]);

    expect(screen.getByText("Published")).toBeInTheDocument();
    expect(screen.getByTitle("https://jnuits.org.bd/forms/membership-application")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open" })).toHaveAttribute(
      "href",
      "https://jnuits.org.bd/forms/membership-application"
    );

    const originalClipboard = navigator.clipboard;
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined });

    await user.click(screen.getByRole("button", { name: "Copy link" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Copying is unavailable in this browser."
    );

    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: originalClipboard,
    });
  });

  it("has no axe violations in the populated editor", async () => {
    const { container } = await renderStudio([PUBLISHED_FORM]);
    const violations = await findAccessibilityViolations(container);

    expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
  });

  it("has no axe violations with the respondent preview open", async () => {
    const { container, user } = await renderStudio([PUBLISHED_FORM]);
    await user.click(screen.getByRole("button", { name: /Preview/ }));
    const violations = await findAccessibilityViolations(container);

    expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
  });
});
