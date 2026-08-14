import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PHONE_ANSWER_MESSAGE } from "@/lib/phone";

import { findAccessibilityViolations } from "../../../../test/setup/axe";
import { ContactFormCard } from "./contact-form-card";

/**
 * Issue #131.
 *
 * `/contact` had no tests at all, which is how it kept a phone composition that
 * disagreed with the forms contract for as long as it did. These assert the
 * submitted value rather than the component's internals: what reaches the server
 * is the only thing the respondent is affected by.
 */

beforeEach(() => {
  // No site key means TurnstileWidget renders nothing and reports an error, so
  // `canSubmit` stays false and the submit button is disabled. That is the real
  // unconfigured code path, and it is why these tests dispatch `submit` on the
  // form rather than clicking the button. CAPTCHA is out of scope here.
  vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

function renderCard() {
  return render(
    <ContactFormCard
      defaultCategory="general"
      defaultSubject="Certificate verification support"
      error={null}
      inquiryCategories={[
        { label: "General Inquiry", value: "general" },
        { label: "Technical Support", value: "technical_support" },
      ]}
      message={null}
    />
  );
}

const phoneInput = () => screen.getByLabelText("Phone or WhatsApp number");

function contactForm() {
  const form = document.getElementById("contact-form");

  if (!(form instanceof HTMLFormElement)) {
    throw new Error("The contact form is missing.");
  }

  return form;
}

/** What the browser would actually post, read the way the browser reads it. */
function submittedPhone() {
  return new FormData(contactForm()).get("phone_whatsapp");
}

function typePhone(value: string) {
  fireEvent.change(phoneInput(), { target: { value } });
}

describe("every way a Bangladeshi number gets typed submits one value", () => {
  it.each([
    ["01712345678", "the trunk zero typed at home"],
    ["1712345678", "the national number alone"],
    ["8801712345678", "the country code without its plus"],
    ["+8801712345678", "a pasted international number"],
    ["01712-345 678", "separators"],
  ])("submits +8801712345678 for %s (%s)", (typed) => {
    renderCard();
    typePhone(typed);

    expect(submittedPhone()).toBe("+8801712345678");
  });

  it("never submits the doubled trunk zero", () => {
    renderCard();
    typePhone("01712345678");

    // The defect itself. `+88001712345678` passed every check this form had,
    // because this form had none, and reached nobody.
    expect(submittedPhone()).not.toBe("+88001712345678");
  });

  it("submits nothing when the optional field is untouched", () => {
    renderCard();

    expect(submittedPhone()).toBe("");
  });

  it("recomposes against the country actually picked", async () => {
    const user = userEvent.setup();
    renderCard();

    await user.click(screen.getByRole("button", { name: "Select country dialling code" }));
    await user.type(screen.getByRole("textbox", { name: "Search country" }), "german");
    await user.click(screen.getByRole("option", { name: /Germany/ }));
    typePhone("01512345678");

    expect(submittedPhone()).toBe("+491512345678");
  });
});

describe("an unusable number is reported on the field that holds it", () => {
  it("blocks the submission instead of mailing an unreachable number", () => {
    renderCard();
    typePhone("call me");

    // `fireEvent` returns false when a handler called preventDefault.
    expect(fireEvent.submit(contactForm())).toBe(false);
  });

  it("marks the control invalid and describes it with the shared message", () => {
    renderCard();
    typePhone("call me");
    fireEvent.blur(phoneInput());

    expect(phoneInput()).toHaveAttribute("aria-invalid", "true");
    expect(phoneInput()).toHaveAccessibleDescription(PHONE_ANSWER_MESSAGE);
  });

  it("describes the country picker with the same message", () => {
    renderCard();
    typePhone("call me");
    fireEvent.blur(phoneInput());

    // The picker is half of the control that failed. A message only the text
    // input carries is a message half the field never announces.
    expect(
      screen.getByRole("button", { name: "Select country dialling code" })
    ).toHaveAccessibleDescription(PHONE_ANSWER_MESSAGE);
  });

  it("stays quiet while the number is still being typed", () => {
    renderCard();
    typePhone("017");

    // `017` is not yet a valid number and is not yet a mistake. Reporting on
    // every keystroke is how a form teaches people to ignore its errors.
    expect(phoneInput()).not.toHaveAttribute("aria-invalid");
    expect(screen.queryByText(PHONE_ANSWER_MESSAGE)).toBeNull();
  });

  it("moves focus to the field it just refused", () => {
    renderCard();
    typePhone("call me");
    fireEvent.submit(contactForm());

    // Task 2.2's pattern. A message nobody is focused on is a message a keyboard
    // user has to go looking for.
    expect(phoneInput()).toHaveFocus();
  });

  it("clears once the number is corrected", () => {
    renderCard();
    typePhone("call me");
    fireEvent.blur(phoneInput());
    expect(phoneInput()).toHaveAttribute("aria-invalid", "true");

    typePhone("01712345678");

    // A message that outlives its cause is the defect task 2.1 fixed elsewhere.
    expect(phoneInput()).not.toHaveAttribute("aria-invalid");
    expect(screen.queryByText(PHONE_ANSWER_MESSAGE)).toBeNull();
    expect(submittedPhone()).toBe("+8801712345678");
  });

  it("keeps what was typed rather than blanking the field", () => {
    renderCard();
    typePhone("call me");
    fireEvent.blur(phoneInput());

    // Submitting "" would look like an untouched optional field, and the
    // respondent would be told nothing at all.
    expect(submittedPhone()).not.toBe("");
  });

  it("lets a valid number through", () => {
    renderCard();
    typePhone("01712345678");

    expect(fireEvent.submit(contactForm())).toBe(true);
  });

  it("lets an untouched optional field through", () => {
    renderCard();

    expect(fireEvent.submit(contactForm())).toBe(true);
  });
});

describe("accessibility of the failing phone field", () => {
  it("reports no axe violations naming the phone control", async () => {
    const { container } = renderCard();
    typePhone("call me");
    fireEvent.blur(phoneInput());

    // Asserted first, because every filter below passes trivially against a
    // container that never rendered the control. Finding 14.5.
    expect(container.querySelector("#contact-phone-whatsapp")).not.toBeNull();

    const violations = await findAccessibilityViolations(container);
    const phoneViolations = violations.filter((violation) =>
      violation.targets.some((target) => target.includes("contact-phone"))
    );

    // Scoped deliberately. A whole-card assertion would also be reporting on
    // markup this PR did not touch, and a green from that says nothing about
    // the error state added here. The full list is in the failure message.
    expect(phoneViolations, JSON.stringify(violations, null, 2)).toEqual([]);
  });
});
