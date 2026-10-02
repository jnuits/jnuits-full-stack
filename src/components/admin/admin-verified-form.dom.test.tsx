import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminVerifiedForm } from "./admin-verified-form";

const intent = { operation: "admin.lifecycle.freeze" as const, payload: { adminProfileId: "11111111-1111-4111-8111-111111111111", confirmation: "QA" } };
afterEach(() => vi.unstubAllGlobals());
describe("verified form submission", () => {
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
