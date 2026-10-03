import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Component, type ReactNode } from "react";
import { redirect } from "next/navigation";
import { AdminVerifiedForm } from "./admin-verified-form";

const intent = { operation: "admin.lifecycle.freeze" as const, payload: { adminProfileId: "11111111-1111-4111-8111-111111111111", confirmation: "QA" } };
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
class DraftBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <p>Draft lost to error boundary</p> : this.props.children; }
}
describe("verified form submission", () => {
  it("rejected_submission_keeps_draft_and_discards_proof_without_automatic_retry", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {}); // Deliberate failing-action boundary probe.
    const id = "11111111-1111-4111-8111-111111111111";
    const expiresAt = new Date(Date.now() + 300_000).toISOString();
    const fetch = vi.fn(async (_url: string, options?: RequestInit) => {
      const body = JSON.parse(String(options?.body));
      const value = body.action === "prepare" ? { decision: { status: "required", methods: ["email"] } }
        : body.action === "email_send" ? { challengeId: id, expiresAt }
          : { token: `${id}.${"a".repeat(43)}`, expiresAt };
      return { ok: true, json: async () => ({ ok: true, value }) };
    });
    vi.stubGlobal("fetch", fetch);
    const action = vi.fn<(form: FormData) => Promise<void>>().mockRejectedValue(new Error("Network response lost"));
    const user = userEvent.setup();
    render(<DraftBoundary><AdminVerifiedForm intent={intent} action={action}><label>Review note<textarea name="note" /></label><button>Save</button></AdminVerifiedForm></DraftBoundary>);
    await user.type(screen.getByLabelText("Review note"), "Valid claim");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await user.click(await screen.findByRole("button", { name: "Verify by email" }));
    await user.type(await screen.findByLabelText("Email code"), "123456");
    await user.click(screen.getByRole("button", { name: "Verify and continue" }));
    await waitFor(() => expect(action).toHaveBeenCalledOnce());
    await waitFor(() => expect(screen.getByLabelText("Review note")).toHaveValue("Valid claim"));
    expect(await screen.findByRole("alert")).toHaveTextContent(/check.*before.*trying again/i);
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
    expect(action.mock.calls[0][0].has("verificationProof")).toBe(false);
    expect(screen.queryByText("Network response lost")).not.toBeInTheDocument();
    expect(screen.queryByText("Draft lost to error boundary")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("button", { name: "Verify by email" })).toBeInTheDocument();
    expect(action).toHaveBeenCalledOnce(); // A new challenge, never replay the uncertain submission.
  });
  it("legitimate_next_redirect_is_not_converted_to_an_inline_submission_failure", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, value: { decision: { status: "allowed" } } }) }));
    const user = userEvent.setup();
    render(<DraftBoundary><AdminVerifiedForm intent={intent} action={async () => redirect("/admin/admin-profiles?message=saved")}><button>Save</button></AdminVerifiedForm></DraftBoundary>);
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Draft lost to error boundary")).toBeInTheDocument(); // The real Next router owns this exception.
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
  it("cancel_keeps_draft and cannot submit without verification", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, value: { decision: { status: "required", methods: ["totp", "email"] } } }) }));
    const action = vi.fn(); const user = userEvent.setup();
    render(<AdminVerifiedForm intent={intent} action={action}><label>Review note<textarea name="note" /></label><button>Save</button></AdminVerifiedForm>);
    await user.type(screen.getByLabelText("Review note"), "Valid claim");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await user.click(await screen.findByRole("button", { name: "Cancel verification" }));
    expect(screen.getByLabelText("Review note")).toHaveValue("Valid claim");
    expect(action).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
    await waitFor(() => expect(screen.getByRole("button", { name: "Save" })).toHaveFocus());
  });
  it("submits the captured payload once while pending and never reuses proof", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, value: { decision: { status: "allowed" } } }) }));
    let finish!: () => void; const action = vi.fn<(form: FormData) => Promise<void>>(() => new Promise<void>(resolve => { finish = resolve; }));
    const user = userEvent.setup();
    render(<AdminVerifiedForm intent={intent} action={action}><input name="confirmation" defaultValue="QA" /><button>Save</button></AdminVerifiedForm>);
    await user.dblClick(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(action).toHaveBeenCalledOnce());
    expect(action.mock.calls[0][0].get("confirmation")).toBe("QA");
    expect(action.mock.calls[0][0].has("verificationProof")).toBe(false);
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    finish();
    await waitFor(() => expect(screen.getByRole("button", { name: "Save" })).toBeEnabled());
  });
});
