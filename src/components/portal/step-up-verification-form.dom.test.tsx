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
  it("sends the CAPTCHA token with the single current-password unlock", async () => {
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
        captcha={{ required: true, siteKey: "turnstile-site-key" }}
        initiallyActive={false}
        username="member@example.test"
      />
    );

    await user.type(screen.getByLabelText(/current password/i), "Current-pass-2046!");
    await user.click(
      screen.getByRole("button", { name: /complete verification challenge/i })
    );
    await user.click(screen.getByRole("button", { name: /verify and unlock/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const [, options] = fetchMock.mock.calls[0] ?? [];
    expect(JSON.parse(String(options?.body))).toEqual({
      captchaToken: "captcha-token",
      currentPassword: "Current-pass-2046!",
    });
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });
});
