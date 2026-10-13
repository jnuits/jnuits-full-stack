import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ChangePasswordForm } from "@/components/portal/change-password-form";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ChangePasswordForm", () => {
  it("cancel and Escape preserve the password draft without submitting", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<ChangePasswordForm username="member@example.test" />);
    await user.type(screen.getByLabelText(/current password/i), "Current-pass-2046!");
    await user.type(screen.getByLabelText(/^new password/i), "River-Cedar-Glass-2046!");
    await user.type(screen.getByLabelText(/confirm new password/i), "River-Cedar-Glass-2046!");
    const opener = screen.getByRole("button", { name: "Update password" });
    await user.click(opener);
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/^new password/i)).toHaveValue("River-Cedar-Glass-2046!");
    expect(opener).toHaveFocus();
    await user.click(opener);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(opener).toHaveFocus();
  });

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
    expect(screen.getByRole("button", { name: /update password/i })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: /update password/i }));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Change your password?" })).toHaveTextContent(/new password.*sign in/i);
    await user.click(screen.getByRole("button", { name: "Confirm password change" }));


    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const [, options] = fetchMock.mock.calls[0] ?? [];
    const payload = JSON.parse(String(options?.body));

    expect(payload).toEqual({
      confirmPassword: "River-Cedar-Glass-2046!",
      currentPassword: "Current-pass-2046!",
      password: "River-Cedar-Glass-2046!",
    });
    expect(payload).not.toHaveProperty("nonce");
    expect(await screen.findByText("Password updated.")).toBeInTheDocument();
  });
});
