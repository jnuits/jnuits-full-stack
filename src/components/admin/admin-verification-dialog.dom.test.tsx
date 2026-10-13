import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminVerificationDialog } from "./admin-verification-dialog";
const mocks = vi.hoisted(() => ({ factors: vi.fn(), challenge: vi.fn(), verify: vi.fn() }));
vi.mock("@/utils/supabase/client", () => ({ createClient: () => ({ auth: { mfa: { listFactors: mocks.factors, challenge: mocks.challenge, verify: mocks.verify } } }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }) }));
const payload = { adminProfileId: "11111111-1111-4111-8111-111111111111", confirmation: "QA" };
afterEach(() => vi.unstubAllGlobals());
describe("admin verification dialog", () => {
  it("role_dialog_never_offers_email even if a malformed policy response includes it", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, value: { decision: { status: "required", methods: ["totp", "email"] } } }) }));
    render(<AdminVerificationDialog intent={{ operation: "admin.role.remove", payload }} onCancel={vi.fn()} onVerified={vi.fn()} />);
    expect(await screen.findByRole("button", { name: "Verify authenticator" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Verify by email" })).not.toBeInTheDocument();
  });
  it("failed_challenge_releases_pending and delivery failure cannot unlock", async () => {
    const fetch = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, value: { decision: { status: "required", methods: ["totp", "email"] } } }) })
      .mockResolvedValueOnce({ ok: false, json: async () => ({ ok: false, code: "delivery_failed" }) });
    vi.stubGlobal("fetch", fetch); const verified = vi.fn(); const user = userEvent.setup();
    render(<AdminVerificationDialog intent={{ operation: "admin.lifecycle.freeze", payload }} onCancel={vi.fn()} onVerified={verified} />);
    await user.click(await screen.findByRole("button", { name: "Verify by email" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/could not send/i);
    expect(screen.getByRole("button", { name: "Verify by email" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Cancel verification" })).toBeEnabled();
    expect(verified).not.toHaveBeenCalled();
  });
  it("rechecks policy after actual TOTP and requires role password without replacing the session", async () => {
    const fetch = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, value: { decision: { status: "required", methods: ["totp"] } } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, value: { decision: { status: "required", methods: ["password"] }, captcha: { required: true, siteKey: "" } } }) });
    vi.stubGlobal("fetch", fetch);
    mocks.factors.mockResolvedValue({ data: { totp: [{ id: "factor-qa", status: "verified" }] }, error: null });
    mocks.challenge.mockResolvedValue({ data: { id: "challenge-qa" }, error: null });
    mocks.verify.mockResolvedValue({ data: {}, error: null });
    const verified = vi.fn(); const user = userEvent.setup();
    render(<AdminVerificationDialog intent={{ operation: "admin.role.remove", payload }} onCancel={vi.fn()} onVerified={verified} />);
    await user.click(await screen.findByRole("button", { name: "Verify authenticator" }));
    await user.type(await screen.findByLabelText("Authenticator code"), "123456");
    await user.click(screen.getByRole("button", { name: "Verify and continue" }));
    await waitFor(() => expect(screen.getByLabelText("Current password")).toBeEnabled());
    expect(screen.getByRole("button", { name: "Verify password and continue" })).toBeEnabled();
    expect(screen.queryByText(/verification is temporarily unavailable/i)).not.toBeInTheDocument();
    expect(mocks.verify).toHaveBeenCalledWith({ factorId: "factor-qa", challengeId: "challenge-qa", code: "123456" });
    expect(verified).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("Email code")).not.toBeInTheDocument();
  });
  it("keeps keyboard focus in the dialog", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, value: { decision: { status: "required", methods: ["totp", "email"] } } }) }));
    const user = userEvent.setup();
    render(<AdminVerificationDialog intent={{ operation: "admin.lifecycle.freeze", payload }} onCancel={vi.fn()} onVerified={vi.fn()} />);
    const first = await screen.findByRole("button", { name: "Verify authenticator" });
    const last = screen.getByRole("button", { name: "Cancel verification" });
    last.focus(); await user.tab(); expect(first).toHaveFocus();
    await user.tab({ shift: true }); expect(last).toHaveFocus();
  });
  it("clears password and releases pending after a rejected password challenge", async () => {
    const fetch = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, value: { decision: { status: "required", methods: ["password"] }, captcha: { required: true, siteKey: "" } } }) })
      .mockResolvedValueOnce({ ok: false, json: async () => ({ ok: false, code: "password_invalid" }) });
    vi.stubGlobal("fetch", fetch); const verified = vi.fn(); const user = userEvent.setup();
    render(<AdminVerificationDialog intent={{ operation: "admin.role.remove", payload }} onCancel={vi.fn()} onVerified={verified} />);
    await user.type(await screen.findByLabelText("Current password"), "Fictional-QA-Pass!");
    await user.click(screen.getByRole("button", { name: "Verify password and continue" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/password was not accepted/i);
    expect(screen.getByLabelText("Current password")).toHaveValue("");
    expect(screen.getByRole("button", { name: "Verify password and continue" })).toBeEnabled();
    expect(verified).not.toHaveBeenCalled();
  });
});
