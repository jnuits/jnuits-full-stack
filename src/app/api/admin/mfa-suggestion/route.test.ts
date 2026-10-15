import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ actor: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/auth/admin-verification/actor", () => ({ loadAdminVerificationActor: mocks.actor, adminVerificationActorSchema: undefined }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc: mocks.rpc }) }));
vi.mock("@/lib/auth/session", () => ({ hasPermission: async () => false, getAuthContext: async () => ({ user: { id: "11111111-1111-4111-8111-111111111111" } }) }));
import { GET, POST } from "./route";
const actor = { userId: "11111111-1111-4111-8111-111111111111", sessionId: "22222222-2222-4222-8222-222222222222", email: "qa@local.invalid", emailConfirmed: true, roleVersion: 3, currentLevel: "aal1", enforced: false, enrollment: "never" };
const context = { params: Promise.resolve({}) };
function request(body: unknown, origin = "https://jnuits.example.test") {
  return new NextRequest("https://jnuits.example.test/api/admin/mfa-suggestion", { method: "POST", headers: { origin, "Content-Type": "application/json" }, body: JSON.stringify(body) });
}
beforeEach(() => { vi.clearAllMocks(); mocks.actor.mockResolvedValue({ ok: true, value: actor }); mocks.rpc.mockResolvedValue({ error: null, data: { ok: true, value: { show: false, snoozedUntil: "2026-10-10T00:00:00Z" } } }); });
describe("private MFA suggestion preferences", () => {
  it("snoozes only the live authenticated administrator and disables caching", async () => {
    const response = await POST(request({ action: "snooze" }), context);
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(mocks.rpc).toHaveBeenCalledWith("admin_verification_suggestion", { p_input: { actor, snooze: true } });
    expect(await response.json()).toEqual({ ok: true, value: { show: false, snoozedUntil: "2026-10-10T00:00:00Z" } });
  });
  it("rejects client-selected recipients, durations and cross-origin mutations before preference writes", async () => {
    expect((await POST(request({ action: "snooze", userId: "other-user" }), context)).status).toBe(422);
    expect((await POST(request({ action: "snooze", days: 100 }), context)).status).toBe(422);
    expect((await POST(request({ action: "snooze" }, "https://untrusted.example.test"), context)).status).toBe(403);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("never reports a successful preference from unavailable or malformed private state", async () => {
    mocks.rpc.mockResolvedValue({ error: null, data: { ok: true, value: {} } });
    expect((await GET(new NextRequest("https://jnuits.example.test/api/admin/mfa-suggestion"), context)).status).toBe(503);
    mocks.actor.mockResolvedValue({ ok: false, code: "permission_denied" });
    mocks.rpc.mockClear();
    expect((await POST(request({ action: "snooze" }), context)).status).toBe(403);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
