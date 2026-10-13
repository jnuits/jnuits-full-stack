import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ update: vi.fn() }));
vi.mock("@/app/(auth)/actions", () => ({ updateCurrentPassword: mocks.update }));
vi.mock("@/lib/security/pwned-passwords", () => ({ getPasswordExposureError: async () => null }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth: { reauthenticate: vi.fn() } }) }));
import { AdminPasswordForm } from "./admin-password-form";

beforeEach(() => mocks.update.mockReset());
afterEach(() => vi.unstubAllGlobals());
it("retries the signed-in admin password update with current-password verification and no CAPTCHA", async () => {
  mocks.update.mockResolvedValueOnce({ ok: false, requiresStepUp: true, message: "Verify your current password." })
    .mockResolvedValueOnce({ ok: true, message: "Password updated." });
  const request = vi.fn().mockResolvedValue({ ok: true });
  vi.stubGlobal("fetch", request);
  const user = userEvent.setup();
  render(<AdminPasswordForm />);
  await user.type(screen.getByLabelText(/^new password/i), "River-Cedar-Glass-2046!");
  await user.type(screen.getByLabelText(/confirm password/i), "River-Cedar-Glass-2046!");
  await user.click(screen.getByRole("button", { name: "Update password" }));
  await user.type(await screen.findByLabelText("Verify current password"), "Current-pass-2046!");
  const verify = screen.getByRole("button", { name: "Verify and update password" });
  expect(verify).toBeEnabled();
  expect(document.querySelector('[name="captchaToken"]')).toBeNull();
  await user.click(verify);
  await waitFor(() => expect(mocks.update).toHaveBeenCalledTimes(2));
  expect(request).toHaveBeenCalledWith("/api/profile/step-up", {
    body: JSON.stringify({ currentPassword: "Current-pass-2046!" }),
    headers: { "Content-Type": "application/json" }, method: "POST",
  });
  expect(await screen.findByText("Password updated.")).toBeInTheDocument();
});
