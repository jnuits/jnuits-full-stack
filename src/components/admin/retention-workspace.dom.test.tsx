import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RetentionWorkspace } from "./retention-workspace";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), replace: vi.fn() }) }));
afterEach(() => vi.unstubAllGlobals());
describe("retention protected operations", () => {
  it("cancelling verification keeps discovery from reaching its write endpoint", async () => {
    const fetch = vi.fn(async (url: string, options?: RequestInit) => ({ ok: true, json: async () => url === "/api/admin/retention" && options?.method !== "POST"
      ? { archiveConfigured: true, eventJobs: [], formJobs: [] }
      : { ok: true, value: { decision: { status: "required", methods: ["totp", "email"] } } } }));
    vi.stubGlobal("fetch", fetch); const user = userEvent.setup();
    render(<RetentionWorkspace />);
    await screen.findByText(/No retention jobs/);
    await user.click(screen.getByRole("button", { name: "Discover candidates" }));
    await user.click(await screen.findByRole("button", { name: "Cancel verification" }));
    expect(fetch.mock.calls.filter(([url, options]) => url === "/api/admin/retention" && options?.method === "POST")).toHaveLength(0);
    expect(screen.getByRole("button", { name: "Discover candidates" })).toBeEnabled();
  });
  it("sends an exact discovery proof only after developed email verification", async () => {
    const id = "11111111-1111-4111-8111-111111111111"; const token = `${id}.${"a".repeat(43)}`;
    const expiresAt = new Date(Date.now() + 300_000).toISOString();
    const fetch = vi.fn(async (url: string, options?: RequestInit) => {
      const body = options?.body ? JSON.parse(String(options.body)) : null;
      const response = url === "/api/admin/retention" ? options?.method === "POST" ? { success: true, created: 2 } : { archiveConfigured: true, eventJobs: [], formJobs: [] }
        : body.action === "prepare" ? { ok: true, value: { decision: { status: "required", methods: ["totp", "email"] } } }
        : body.action === "email_send" ? { ok: true, value: { challengeId: id, expiresAt } }
        : { ok: true, value: { token, expiresAt } };
      return { ok: true, json: async () => response };
    });
    vi.stubGlobal("fetch", fetch); const user = userEvent.setup(); render(<RetentionWorkspace />);
    await screen.findByText(/No retention jobs/);
    await user.click(screen.getByRole("button", { name: "Discover candidates" }));
    await user.click(await screen.findByRole("button", { name: "Verify by email" }));
    await user.type(await screen.findByLabelText("Email code"), "123456");
    await user.click(screen.getByRole("button", { name: "Verify and continue" }));
    await waitFor(() => expect(screen.getByText("2 retention candidate(s) created.")).toBeInTheDocument());
    const writes = fetch.mock.calls.filter(([url, options]) => url === "/api/admin/retention" && options?.method === "POST");
    expect(writes).toHaveLength(1);
    expect(JSON.parse(String(writes[0][1]?.body))).toEqual({ action: "discover", verificationProof: token });
  });
});
