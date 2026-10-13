import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));

vi.mock("@/components/auth/turnstile-field", () => ({
  TurnstileField: ({
    onTokenChange,
  }: {
    onTokenChange?: (token: string) => void;
  }) => (
    <button
      onClick={() => onTokenChange?.("captcha-token")}
      type="button"
    >
      Complete verification challenge
    </button>
  ),
}));

import { StepUpVerificationForm } from "@/components/portal/step-up-verification-form";

afterEach(() => {
  vi.unstubAllGlobals();
  mocks.refresh.mockReset();
});

describe("StepUpVerificationForm", () => {
  it("unlocks with the current password when no CAPTCHA is present", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(
      async (...args: [RequestInfo | URL, RequestInit?]) => {
        void args;
        return {
          json: async () => ({ message: "Profile editing unlocked.", verified: true }),
          ok: true,
        };
      }
    );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <StepUpVerificationForm
        initiallyActive={false}
        username="member@example.test"
      />
    );

    await user.type(screen.getByLabelText(/current password/i), "Current-pass-2046!");
    expect(screen.queryByRole("button", { name: /complete verification challenge/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /verify and unlock/i })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: /verify and unlock/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const [, options] = fetchMock.mock.calls[0] ?? [];
    expect(JSON.parse(String(options?.body))).toEqual({
      currentPassword: "Current-pass-2046!",
    });
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });
});
