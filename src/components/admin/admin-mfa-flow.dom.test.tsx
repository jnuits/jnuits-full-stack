import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { AdminMFASetup } from "./admin-mfa-setup";
import { AdminMFAChallenge } from "./admin-mfa-challenge";
const mocks = vi.hoisted(() => ({ factors: vi.fn(), enroll: vi.fn(), unenroll: vi.fn(), challenge: vi.fn(), verify: vi.fn(), assurance: vi.fn(), replace: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh }) }));
vi.mock("@/utils/supabase/client", () => ({ createClient: () => ({ auth: { mfa: { listFactors: mocks.factors, enroll: mocks.enroll, unenroll: mocks.unenroll, challenge: mocks.challenge, verify: mocks.verify, getAuthenticatorAssuranceLevel: mocks.assurance } } }) }));
beforeEach(() => {
  vi.resetAllMocks();
  mocks.factors.mockResolvedValue({ data: { all: [], totp: [] }, error: null });
  mocks.enroll.mockResolvedValue({ data: { id: "new-factor", totp: { qr_code: "data:image/svg+xml,<svg/>", secret: "fictional-setup-key" } }, error: null });
  mocks.unenroll.mockResolvedValue({ error: null });
  mocks.challenge.mockResolvedValue({ data: { id: "challenge" }, error: null });
  mocks.verify.mockResolvedValue({ data: {}, error: null });
  mocks.assurance.mockResolvedValue({ data: { currentLevel: "aal2", nextLevel: "aal2" }, error: null });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
});
afterEach(() => vi.unstubAllGlobals());
describe("native MFA setup", () => {
  it("offers a manual setup key after an explicit reveal and identifies the account issuer", async () => {
    const user = userEvent.setup();
    render(<AdminMFASetup />);
    await screen.findByAltText("TOTP setup QR code");
    expect(screen.queryByText("fictional-setup-key")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /setup key/i }));
    expect(screen.getByText("fictional-setup-key")).toBeVisible();
    expect(mocks.enroll).toHaveBeenCalledWith(expect.objectContaining({ factorType: "totp", issuer: "JnUITS" }));
  });
  it("cleans only unverified TOTP factors from the all-factors list before enrolling", async () => {
    mocks.factors.mockResolvedValue({ data: { all: [{ id: "pending-totp", factor_type: "totp", status: "unverified" }, { id: "pending-phone", factor_type: "phone", status: "unverified" }], totp: [] }, error: null });
    render(<AdminMFASetup />);
    await screen.findByAltText("TOTP setup QR code");
    expect(mocks.unenroll).toHaveBeenCalledExactlyOnceWith({ factorId: "pending-totp" });
    expect(mocks.unenroll.mock.invocationCallOrder[0]).toBeLessThan(mocks.enroll.mock.invocationCallOrder[0]);
  });
  it("allows retry after a failed enrollment without claiming that MFA is enabled", async () => {
    mocks.enroll.mockResolvedValueOnce({ data: null, error: { message: "Enrollment unavailable" } });
    const user = userEvent.setup(); const done = vi.fn();
    render(<AdminMFASetup onVerified={done} />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/unavailable/i);
    await user.click(screen.getByRole("button", { name: /try again/i }));
    await screen.findByAltText("TOTP setup QR code");
    expect(done).not.toHaveBeenCalled();
  });
  it("requires exactly six digits and disables code editing during verification", async () => {
    let release!: (value: unknown) => void;
    mocks.challenge.mockReturnValue(new Promise(resolve => { release = resolve; }));
    const user = userEvent.setup(); render(<AdminMFASetup />);
    const input = await screen.findByLabelText("Verification code");
    expect(input).toHaveAttribute("maxLength", "6");
    expect(input).toHaveAttribute("pattern", "[0-9]{6}");
    await user.type(input, "123456");
    await user.click(screen.getByRole("button", { name: "Verify and continue" }));
    expect(input).toBeDisabled();
    release({ data: null, error: { message: "Try the current code" } });
    expect(await screen.findByRole("alert")).toHaveTextContent(/could not be started/i);
    expect(input).toBeEnabled();
  });
  it("does not finish setup unless the native session really reaches AAL2", async () => {
    mocks.assurance.mockResolvedValue({ data: { currentLevel: "aal1", nextLevel: "aal2" }, error: null });
    const done = vi.fn(); const user = userEvent.setup(); render(<AdminMFASetup onVerified={done} />);
    await user.type(await screen.findByLabelText("Verification code"), "123456");
    await user.click(screen.getByRole("button", { name: "Verify and continue" }));
    await screen.findByRole("alert");
    expect(done).not.toHaveBeenCalled(); expect(mocks.replace).not.toHaveBeenCalled();
  });
  it("verifies the enrolled factor and returns only to the allowlisted destination", async () => {
    const user = userEvent.setup(); render(<AdminMFASetup returnPath="/admin/settings/security" />);
    await user.type(await screen.findByLabelText("Verification code"), "123456");
    await user.click(screen.getByRole("button", { name: "Verify and continue" }));
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/admin/settings/security"));
    expect(mocks.verify).toHaveBeenCalledWith({ factorId: "new-factor", challengeId: "challenge", code: "123456" });
    expect(mocks.assurance).toHaveBeenCalled();
    expect(screen.queryByText("fictional-setup-key")).not.toBeInTheDocument();
  });
});
describe("native MFA challenge", () => {
  beforeEach(() => mocks.factors.mockResolvedValue({ data: { all: [], totp: [{ id: "verified-factor", status: "verified", friendly_name: "JnUITS Admin" }] }, error: null }));
  it("shows factor-loading failures with a retry instead of reporting no authenticator", async () => {
    mocks.factors.mockResolvedValueOnce({ data: null, error: { message: "Factors unavailable" } });
    const user = userEvent.setup(); render(<AdminMFAChallenge />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/unavailable/i);
    await user.click(screen.getByRole("button", { name: /try again/i }));
    await screen.findByLabelText("Verification code");
  });
  it("does not navigate on a verify result that leaves the session at AAL1", async () => {
    mocks.assurance.mockResolvedValue({ data: { currentLevel: "aal1", nextLevel: "aal2" }, error: null });
    const user = userEvent.setup(); render(<AdminMFAChallenge />);
    await user.type(await screen.findByLabelText("Verification code"), "123456");
    await user.click(screen.getByRole("button", { name: "Verify and continue" }));
    await screen.findByRole("alert");
    expect(mocks.replace).not.toHaveBeenCalled();
  });
  it("completes a native AAL2 challenge before returning to the original page", async () => {
    const user = userEvent.setup(); render(<AdminMFAChallenge returnPath="/admin/membership?queue=alumni" />);
    await user.type(await screen.findByLabelText("Verification code"), "123456");
    await user.click(screen.getByRole("button", { name: "Verify and continue" }));
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/admin/membership?queue=alumni"));
    expect(mocks.assurance).toHaveBeenCalled();
  });
});
