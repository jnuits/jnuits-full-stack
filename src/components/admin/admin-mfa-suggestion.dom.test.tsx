import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminMfaSuggestion } from "./admin-mfa-suggestion";
afterEach(() => vi.unstubAllGlobals());
describe("optional admin account protection suggestion", () => {
  it("suggestion_does_not_block_review and successful snooze hides only the suggestion", async () => {
    const fetch = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, value: { show: true, snoozedUntil: null } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, value: { show: false, snoozedUntil: "2026-10-10T00:00:00Z" } }) });
    vi.stubGlobal("fetch", fetch); const user = userEvent.setup();
    render(<><AdminMfaSuggestion /><button>Review request</button></>);
    expect(await screen.findByText(/Protect your admin account/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Review request" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Remind me in 7 days" }));
    await waitFor(() => expect(screen.queryByText(/Protect your admin account/)).not.toBeInTheDocument());
    expect(fetch.mock.calls[1][1]).toMatchObject({ method: "POST", body: JSON.stringify({ action: "snooze" }) });
  });
});
