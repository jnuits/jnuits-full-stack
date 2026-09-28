import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ChangePasswordForm } from "@/components/portal/change-password-form";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ChangePasswordForm", () => {
  it("changes a password with the current password and never asks for an email code", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(
      async (...args: [RequestInfo | URL, RequestInit?]) => {
        void args;
        return {
          json: async () => ({ message: "Password updated." }),
          ok: true,
        };
      }
    );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <ChangePasswordForm
        captcha={{ required: false, siteKey: "" }}
        username="member@example.test"
      />
    );

    expect(screen.queryByLabelText(/reauthentication code/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /send reauthentication code/i })
    ).not.toBeInTheDocument();

    await user.type(screen.getByLabelText(/current password/i), "Current-pass-2046!");
    await user.type(screen.getByLabelText(/^new password/i), "River-Cedar-Glass-2046!");
    await user.type(
      screen.getByLabelText(/confirm new password/i),
      "River-Cedar-Glass-2046!"
    );
    await user.click(screen.getByRole("button", { name: /update password/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const [, options] = fetchMock.mock.calls[0] ?? [];
    const payload = JSON.parse(String(options?.body));

    expect(payload).toEqual({
      captchaToken: "",
      confirmPassword: "River-Cedar-Glass-2046!",
      currentPassword: "Current-pass-2046!",
      password: "River-Cedar-Glass-2046!",
    });
    expect(payload).not.toHaveProperty("nonce");
    expect(await screen.findByText("Password updated.")).toBeInTheDocument();
  });
});
