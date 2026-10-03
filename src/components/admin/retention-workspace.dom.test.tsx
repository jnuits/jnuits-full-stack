import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RetentionWorkspace } from "./retention-workspace";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), replace: vi.fn() }) }));
afterEach(() => vi.unstubAllGlobals());
describe("retention protected operations", () => {
  it("initial_read_expiry_recovers_with_a_fresh_authorized_get_without_remounting", async () => {
    let reads = 0;
    const fetch = vi.fn(async (url: string) => {
      if (url === "/api/admin/retention" && ++reads === 1) return { ok: false, json: async () => ({ code: "verification_expired", error: "Verify again." }) };
      return { ok: true, json: async () => url === "/api/admin/retention" ? { archiveConfigured: true, eventJobs: [], formJobs: [] } : { ok: true, value: { decision: { status: "allowed" } } } };
    });
    vi.stubGlobal("fetch", fetch); const user = userEvent.setup(); render(<RetentionWorkspace />);
    expect(await screen.findByText("Verify to view this page")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Discover candidates" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Verify account" }));
    expect(await screen.findByText(/No retention jobs/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Discover candidates" })).toBeEnabled();
    expect(reads).toBe(2);
  });
  it("read_expiry_after_a_completed_mutation_reloads_without_replaying_the_mutation", async () => {
    let reads = 0;
    const fetch = vi.fn(async (url: string, options?: RequestInit) => {
      if (url === "/api/admin/retention") {
        if (options?.method === "POST") return { ok: true, json: async () => ({ success: true, created: 2 }) };
        if (++reads === 2) return { ok: false, json: async () => ({ code: "verification_expired", error: "Verify again." }) };
        return { ok: true, json: async () => ({ archiveConfigured: true, eventJobs: [], formJobs: [] }) };
      }
      return { ok: true, json: async () => ({ ok: true, value: { decision: { status: "allowed" } } }) };
    });
    vi.stubGlobal("fetch", fetch); const user = userEvent.setup(); render(<RetentionWorkspace />);
    await screen.findByText(/No retention jobs/);
    await user.click(screen.getByRole("button", { name: "Discover candidates" }));
    await screen.findByText("Verify to view this page");
    await user.click(screen.getByRole("button", { name: "Verify account" }));
    expect(await screen.findByRole("button", { name: "Discover candidates" })).toBeEnabled();
    expect(reads).toBe(3);
    expect(fetch.mock.calls.filter(([url, options]) => url === "/api/admin/retention" && options?.method === "POST")).toHaveLength(1);
  });
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
