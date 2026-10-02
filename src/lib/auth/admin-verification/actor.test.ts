import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ client: vi.fn(), admin: vi.fn(), context: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.client }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.admin }));
import { loadAdminVerificationActor } from "./actor";

const id = "11111111-1111-4111-8111-111111111111";
const sid = "22222222-2222-4222-8222-222222222222";
const actor = { userId: id, sessionId: sid, email: "operator@example.com", emailConfirmed: true, roleVersion: 2, enforced: false, enrollment: "unknown", currentLevel: "aal1" };
let user: unknown; let claims: Record<string, unknown>;
beforeEach(() => {
  vi.clearAllMocks();
  user = { id, email: "operator@example.com", email_confirmed_at: "2026-10-02T00:00:00Z" };
  claims = { sub: id, session_id: sid, aal: "aal1", jnuits_role_version: 2 };
  mocks.client.mockResolvedValue({ auth: {
    getUser: async () => ({ data: { user }, error: null }), getClaims: async () => ({ data: { claims }, error: null }),
    mfa: { getAuthenticatorAssuranceLevel: async () => ({ data: { currentLevel: "aal1", nextLevel: "aal1" }, error: null }) },
  }, rpc: async () => ({ data: false, error: null }) });
  mocks.context.mockResolvedValue({ data: { ok: true, value: actor }, error: null });
  mocks.admin.mockReturnValue({ rpc: mocks.context });
});
describe("trusted admin verification actor", () => {
  it("keeps unknown MFA history restricted instead of inferring never enrolled", async () => {
    expect(await loadAdminVerificationActor()).toEqual({ ok: true, value: actor });
  });
  it("does not resolve unauthenticated or sessionless identities", async () => {
    user = null;
    expect((await loadAdminVerificationActor()).ok).toBe(false);
    user = { id, email: "operator@example.com" }; delete claims.session_id;
    expect((await loadAdminVerificationActor()).ok).toBe(false);
  });
  it.each(["session_invalid", "permission_denied", "role_version_stale"])("preserves database denial for %s", async code => {
    mocks.context.mockResolvedValue({ data: { ok: false, code }, error: null });
    expect(await loadAdminVerificationActor()).toEqual({ ok: false, code });
  });
  it("rejects a different user or session even in an otherwise shaped RPC response", async () => {
    mocks.context.mockResolvedValue({ data: { ok: true, value: { ...actor, userId: sid } }, error: null });
    expect((await loadAdminVerificationActor()).ok).toBe(false);
  });
  it("fails closed on unavailable or malformed context", async () => {
    mocks.context.mockResolvedValue({ data: { ok: true }, error: null });
    expect((await loadAdminVerificationActor()).ok).toBe(false);
    mocks.context.mockRejectedValue(new Error("offline"));
    expect((await loadAdminVerificationActor()).ok).toBe(false);
  });
});
