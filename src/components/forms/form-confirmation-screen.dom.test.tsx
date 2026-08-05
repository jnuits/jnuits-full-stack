import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FormConfirmationScreen } from "@/components/forms/form-confirmation-screen";

import { findAccessibilityViolations } from "../../../test/setup/axe";

/**
 * Issues #134 and #135.
 *
 * The only test this component had read its own source text, so the focus defect
 * #125 fixed on the public form screen survived here untouched: nothing that
 * matches strings can tell you where focus went.
 *
 * Rendered without a challenge on purpose. Turnstile mounts a third-party script
 * through `next/script`; requiring it would test the stub rather than the screen.
 */

function renderScreen({ valid = true }: { valid?: boolean } = {}) {
  return render(
    <FormConfirmationScreen
      captcha={{ required: false, siteKey: "" }}
      formSlug="membership-2026"
      submissionId="11111111-1111-4111-8111-111111111111"
      token="confirmation-token"
      valid={valid}
    />
  );
}

/**
 * A response-shaped object rather than a real `Response`, matching
 * public-form-screen.dom.test.tsx. The screen reads `ok`, `status` and `json()`
 * and nothing else.
 */
function stubFetch({
  ok = true,
  payload = { success: true } as Record<string, unknown>,
  status = 200,
} = {}) {
  const fetchMock = vi.fn(async () => ({ json: async () => payload, ok, status }));

  vi.stubGlobal("fetch", fetchMock);

  return fetchMock;
}

function confirmButton() {
  return screen.getByRole("button", { name: "Confirm email and submit" });
}

async function confirm(user: ReturnType<typeof userEvent.setup>) {
  await user.click(confirmButton());
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("focus after a confirmation attempt", () => {
  it("moves focus to the success heading instead of dropping it on the body", async () => {
    const user = userEvent.setup();
    stubFetch();
    renderScreen();

    await confirm(user);

    const heading = await screen.findByRole("heading", {
      level: 1,
      name: "Email confirmed",
    });

    await waitFor(() => expect(heading).toHaveFocus());

    // The actual regression, and the reason the live region was not enough:
    // success replaces the button that had focus, so without this the browser
    // hands focus to <body> and the respondent is returned to the top of the
    // document with nothing telling them their submission went through.
    expect(document.activeElement).not.toBe(document.body);

    // A focus target, not a tab stop.
    expect(heading).toHaveAttribute("tabindex", "-1");
  });

  it("does not put the focused heading inside a live region", async () => {
    const user = userEvent.setup();
    stubFetch();
    renderScreen();

    await confirm(user);

    const heading = await screen.findByRole("heading", { level: 1 });
    await waitFor(() => expect(heading).toHaveFocus());

    // The success section carried `role="status" aria-live="polite"` and
    // announced nothing, because it mounted with its content already inside it.
    // Now that focus lands on the heading, a region around it would have the same
    // sentence read out twice.
    expect(heading.closest("[aria-live]")).toBeNull();
    expect(heading.closest('[role="status"]')).toBeNull();
    expect(screen.queryAllByRole("status")).toHaveLength(0);
  });

  it("focuses the expired heading and offers recovery beneath it", async () => {
    const user = userEvent.setup();
    stubFetch({
      ok: false,
      payload: { error: "This confirmation link has expired." },
      status: 410,
    });
    renderScreen();

    await confirm(user);

    const heading = await screen.findByRole("heading", {
      level: 1,
      name: "Confirmation link expired",
    });

    await waitFor(() => expect(heading).toHaveFocus());
    // The button is gone in this state too, which is why focus has to move.
    expect(screen.queryByRole("button", { name: "Confirm email and submit" })).toBeNull();
    expect(screen.getByLabelText("Email address")).toBeInTheDocument();
  });

  it("gives the failure state a heading that describes it", async () => {
    const user = userEvent.setup();
    stubFetch({ ok: false, payload: { error: "We could not confirm this submission." }, status: 500 });
    renderScreen();

    await confirm(user);

    // Not "Confirm your email". Focus lands here, so a heading still telling the
    // respondent to confirm would announce an instruction immediately after the
    // attempt failed.
    const heading = await screen.findByRole("heading", {
      level: 1,
      name: "We could not confirm your email",
    });

    await waitFor(() => expect(heading).toHaveFocus());
    expect(screen.getByText("We could not confirm this submission.")).toBeInTheDocument();
  });

  it("does not move focus while the request is in flight", async () => {
    const user = userEvent.setup();
    let release: (value: unknown) => void = () => {};
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise((resolve) => {
            release = resolve;
          })
      )
    );
    renderScreen();

    await user.click(confirmButton());

    const heading = screen.getByRole("heading", { level: 1, name: "Confirm your email" });
    const busy = screen.getByRole("button", { name: "Confirming…" });

    // `confirming` keeps the button mounted, so there is nothing to move focus
    // away from and the heading must not take it. This is the state the effect
    // deliberately excludes.
    expect(busy).toHaveAttribute("aria-busy", "true");
    expect(heading).not.toHaveFocus();

    // NOT asserted: that the button keeps focus. It cannot -- `disabled={isBusy}`
    // blurs it, so focus sits on the body for the duration of the request. That
    // is a real defect and it is reported rather than fixed here, because the
    // public form screen's submit button does exactly the same thing while
    // submitting; it is a shared pattern, not something this surface introduced.

    // Resolved inside the test, so no state update lands after teardown.
    release({ json: async () => ({ success: true }), ok: true, status: 200 });
    await screen.findByRole("heading", { level: 1, name: "Email confirmed" });
  });
});

describe("focus when the page simply opens in a terminal state", () => {
  it("does not move focus for an invalid link, because nothing happened", async () => {
    renderScreen({ valid: false });

    const heading = screen.getByRole("heading", {
      level: 1,
      name: "We could not confirm your email",
    });

    // The assertion a version of this fix without the transition check would
    // fail, and the only one here that would not. An invalid link initialises
    // straight to the error state, so an effect firing on mount would grab a
    // visitor who has just arrived and move them before they read anything.
    await waitFor(() => expect(heading).not.toHaveFocus());
    expect(document.activeElement).toBe(document.body);
    expect(
      screen.getByText("This confirmation link is invalid or incomplete.")
    ).toBeInTheDocument();
  });

  it("offers no confirm button for a link that cannot be confirmed", () => {
    renderScreen({ valid: false });

    expect(screen.queryByRole("button", { name: "Confirm email and submit" })).toBeNull();
  });
});

describe("focus is not stolen back by the recovery form", () => {
  it("stays where the respondent puts it", async () => {
    const user = userEvent.setup();
    stubFetch({ ok: false, payload: { error: "Expired." }, status: 410 });
    renderScreen();

    await confirm(user);

    const heading = await screen.findByRole("heading", { level: 1 });
    await waitFor(() => expect(heading).toHaveFocus());

    const email = screen.getByLabelText("Email address");
    await user.type(email, "member@example.test");

    // The recovery form manages its own state inside this branch. An effect keyed
    // on the state object rather than its status would fire on those changes and
    // drag focus back to the heading, out of the field being typed into. #125's
    // test named this mistake; this is the same shape on a different surface.
    expect(email).toHaveFocus();
    expect(heading).not.toHaveFocus();
  });
});

describe("accessibility of every confirmation state", () => {
  it("reports no axe violations in the success state", async () => {
    const user = userEvent.setup();
    stubFetch();
    const { container } = renderScreen();

    await confirm(user);

    // Finding 14.5: prove the scan saw the success card rather than the ready
    // state it replaced, which would pass this for the wrong reason.
    const heading = await screen.findByRole("heading", { level: 1, name: "Email confirmed" });
    expect(container).toContainElement(heading);

    const violations = await findAccessibilityViolations(container);

    expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
  });

  it("reports no axe violations in the expired state, recovery form included", async () => {
    const user = userEvent.setup();
    stubFetch({ ok: false, payload: { error: "Expired." }, status: 410 });
    const { container } = renderScreen();

    await confirm(user);

    const email = await screen.findByLabelText("Email address");
    expect(container).toContainElement(email);

    const violations = await findAccessibilityViolations(container);

    expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
  });

  it("reports no axe violations in the ready state", async () => {
    const { container } = renderScreen();

    expect(container).toContainElement(confirmButton());

    const violations = await findAccessibilityViolations(container);

    expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
  });
});
