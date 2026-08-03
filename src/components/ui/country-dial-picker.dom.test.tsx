import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { CountryDialPicker } from "@/components/ui/country-dial-picker";
import { DEFAULT_COUNTRY, type DialCountry } from "@/lib/phone";
import { findAccessibilityViolations } from "../../../test/setup/axe";

/**
 * The picker was lifted out of `contact-form-card.tsx` for task 2.6, where it
 * became the second consumer.
 *
 * **`/contact` had no tests at all**, so every behaviour asserted here was
 * previously unverified on the surface that has shipped it since launch: the
 * search, the Escape key, the outside click, and where focus goes afterwards.
 * The extraction is the reason these exist, not the risk they guard.
 */
function Harness({ initial = DEFAULT_COUNTRY }: { initial?: DialCountry }) {
  const [country, setCountry] = useState(initial);

  return (
    <div className="flex">
      <CountryDialPicker country={country} onCountryChange={setCountry} />
      <output>{country.dial}</output>
    </div>
  );
}

const trigger = () => screen.getByRole("button", { name: "Select country dialling code" });
const search = () => screen.getByRole("textbox", { name: "Search country" });

describe("the country dial picker", () => {
  it("shows the selected country's flag, code and dial code", () => {
    render(<Harness />);

    // The dial code is on the trigger because it is the part that changes what
    // gets submitted, so it has to be visible without opening anything.
    expect(trigger()).toHaveTextContent("BD");
    expect(trigger()).toHaveTextContent("+880");
  });

  it("opens a named listbox and reports its expanded state", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    expect(trigger()).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("listbox")).toBeNull();

    await user.click(trigger());

    expect(trigger()).toHaveAttribute("aria-expanded", "true");
    // Named, not merely present. The trigger's label names the button; the list
    // a screen reader lands in next is a separate stop and needs its own name.
    expect(screen.getByRole("listbox", { name: "Country dialling codes" })).toBeInTheDocument();
  });

  it("focuses the search box on open, so typing goes somewhere useful", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(trigger());

    // Focused through a timeout in an effect, so this has to wait rather than
    // assert immediately.
    await waitFor(() => expect(search()).toHaveFocus());
  });

  it.each([
    ["a name", "german", "Germany"],
    ["an ISO code", "de", "Germany"],
    ["a dial code", "49", "Germany"],
    ["a dial code typed with its plus", "+49", "Germany"],
  ])("filters by %s", async (_label, query, expected) => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(trigger());
    await user.type(search(), query);

    expect(screen.getByRole("option", { name: new RegExp(expected) })).toBeInTheDocument();
  });

  it("says so when nothing matches, rather than showing an empty list", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(trigger());
    await user.type(search(), "zzzzz");

    expect(screen.queryAllByRole("option")).toHaveLength(0);
    expect(screen.getByText("No country found.")).toBeInTheDocument();
  });

  it("marks the current country as the selected option", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(trigger());

    expect(screen.getByRole("option", { name: /Bangladesh/ })).toHaveAttribute(
      "aria-selected",
      "true"
    );
  });

  it("chooses a country, closes, and returns focus to the trigger", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(trigger());
    await user.type(search(), "german");
    await user.click(screen.getByRole("option", { name: /Germany/ }));

    // Focus has to come back to something: the option that had focus is gone,
    // and leaving focus on a removed element drops a keyboard user at the top of
    // the document.
    expect(trigger()).toHaveFocus();
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent("+49");
  });

  it("clears the search between openings", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(trigger());
    await user.type(search(), "german");
    await user.click(screen.getByRole("option", { name: /Germany/ }));
    await user.click(trigger());

    expect(search()).toHaveValue("");
  });

  it("closes on Escape and returns focus", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(trigger());
    await user.type(search(), "{Escape}");

    expect(screen.queryByRole("listbox")).toBeNull();
    expect(trigger()).toHaveFocus();
  });

  it("closes when a pointer goes down outside it", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Harness />
        <button type="button">Somewhere else</button>
      </>
    );

    await user.click(trigger());
    await user.click(screen.getByRole("button", { name: "Somewhere else" }));

    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("cannot be opened while disabled", async () => {
    const user = userEvent.setup();
    render(
      <div className="flex">
        <CountryDialPicker country={DEFAULT_COUNTRY} disabled onCountryChange={() => undefined} />
      </div>
    );

    expect(trigger()).toBeDisabled();

    await user.click(trigger());

    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("reports no axe violations, closed or open", async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness />);

    expect(await findAccessibilityViolations(container)).toEqual([]);

    await user.click(trigger());

    /**
     * The dropdown is portalled to `document.body`, so it sits outside
     * `container` and has to be scanned on its own.
     *
     * Scanning the body instead is worse, not stricter. `region` is one of
     * axe's page-level rules, so a body scan reports every node that is not
     * inside a landmark, which for a popup deliberately rendered outside the
     * page's landmarks (so no ancestor `overflow` can clip it) means the search
     * box and every option. That says nothing about the component. Scanning the
     * dropdown drops that single page-level rule and keeps every element-level
     * one, including the `aria-input-field-name` check that caught the unnamed
     * listbox this component inherited from `/contact`. The shared helper is
     * not relaxed for anybody else.
     */
    const dropdown = screen.getByRole("listbox").parentElement as HTMLElement;

    // Finding 14.5: assert what the scan covered. A wrong or empty node would
    // otherwise pass this test by having nothing to find.
    expect(dropdown).toContainElement(search());
    expect(dropdown).toContainElement(screen.getByRole("option", { name: /Bangladesh/ }));

    const violations = await findAccessibilityViolations(dropdown);

    expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
  });
});
