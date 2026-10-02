import { describe, expect, it, vi } from "vitest";
import { AdminVerificationStore } from "./store";
import type { AdminVerificationActor } from "./types";
const actor: AdminVerificationActor = { userId: "11111111-1111-4111-8111-111111111111", sessionId: "22222222-2222-4222-8222-222222222222", email: "operator@example.com", emailConfirmed: true, currentLevel: "aal1", enforced: false, enrollment: "never", roleVersion: 1 };
describe("verification RPC boundary", () => {
  it("does not create an authorization success from malformed RPC output", async () => {
    const store = new AdminVerificationStore({ rpc: vi.fn().mockResolvedValue({ data: { ok: true }, error: null }) });
    expect((await store.prepare(actor, { operation: "admin.security.read", payload: {} })).ok).toBe(false);
  });
  it("preserves permission denial and does not accept invalid token syntax", async () => {
    const store = new AdminVerificationStore({ rpc: vi.fn().mockResolvedValue({ data: { ok: false, code: "permission_denied" }, error: null }) });
    expect(await store.prepare(actor, { operation: "admin.security.read", payload: {} })).toEqual({ ok: false, code: "permission_denied" });
    expect(await store.checkRead(actor, { operation: "admin.security.read", payload: {} }, "broken")).toEqual({ ok: false, code: "verification_invalid" });
  });
  it("fails closed when the durable backend is offline", async () => {
    const store = new AdminVerificationStore({ rpc: vi.fn().mockRejectedValue(new Error("offline")) });
    expect(await store.prepare(actor, { operation: "admin.security.read", payload: {} })).toEqual({ ok: false, code: "verification_unavailable" });
  });
});
