import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminOperationIntent, AdminVerificationActor } from "./types";
const mocks = vi.hoisted(() => ({ actor: vi.fn(), prepare: vi.fn(), reserve: vi.fn(), issue: vi.fn(), create: vi.fn(), signIn: vi.fn(), signOut: vi.fn() }));
vi.mock("./actor", () => ({ loadAdminVerificationActor: mocks.actor }));
vi.mock("./store", () => ({ AdminVerificationStore: class { prepare = mocks.prepare; reservePasswordAttempt = mocks.reserve; issuePassword = mocks.issue; } }));
vi.mock("@supabase/supabase-js", () => ({ createClient: mocks.create }));
import { verifyAdminRolePassword } from "./password";
const id = "11111111-1111-4111-8111-111111111111";
const actor: AdminVerificationActor = { userId: id, sessionId: "22222222-2222-4222-8222-222222222222", email: "operator@example.test", emailConfirmed: true, roleVersion: 1, currentLevel: "aal2", enforced: false, enrollment: "enrolled" };
const intent: AdminOperationIntent = { operation: "admin.role.change", payload: { adminProfileId: id, confirmation: "fixture", roleCode: "admin" } };
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321"); vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "fixture-publishable"); vi.stubEnv("SUPABASE_SECRET_KEY", "fixture-server-only"); vi.stubEnv("AUTH_CAPTCHA_REQUIRED", "true"); vi.stubEnv("RATE_LIMIT_SECRET_SALT", "fixture-ip-salt");
  mocks.actor.mockResolvedValue({ ok: true, value: actor });
  mocks.prepare.mockImplementation(async (a, i) => ({ ok: true, value: { id, actor: a, intent: i, targetRef: id, payloadDigest: "a".repeat(64), policyRevision: "fixture" } }));
  mocks.reserve.mockResolvedValue({ ok: true, value: null });
  mocks.issue.mockResolvedValue({ ok: true, value: { proofId: id, expiresAt: "2026-10-02T23:05:00Z" } });
  mocks.signIn.mockResolvedValue({ data: { user: { id } }, error: null }); mocks.signOut.mockResolvedValue({ error: null });
  mocks.create.mockReturnValue({ auth: { signInWithPassword: mocks.signIn, signOut: mocks.signOut } });
});
afterEach(() => { vi.unstubAllEnvs(); });
describe("admin-role password proof", () => {
  it("counts the attempt before trusted password verification without CAPTCHA and keeps the original AAL2 session unchanged", async () => {
    const result = await verifyAdminRolePassword(intent, "disposable-proof-password", "192.0.2.10");
    expect(result.ok).toBe(true);
    expect(mocks.create).toHaveBeenCalledWith("http://127.0.0.1:54321", "fixture-server-only", { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } });
    expect(mocks.signIn).toHaveBeenCalledWith({ email: actor.email, password: "disposable-proof-password" });
    expect(mocks.reserve.mock.invocationCallOrder[0]).toBeLessThan(mocks.signIn.mock.invocationCallOrder[0]);
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(mocks.signOut.mock.invocationCallOrder[0]).toBeLessThan(mocks.issue.mock.invocationCallOrder[0]);
    expect(JSON.stringify(mocks.issue.mock.calls)).not.toContain("disposable-proof-password");
  });
  it.each(["wrong_password", "wrong_user", "throw"])("cleans temporary session and never issues proof for %s", async mode => {
    if (mode === "wrong_password") mocks.signIn.mockResolvedValue({ data: { user: null }, error: { message: "sensitive password provider body" } });
    if (mode === "wrong_user") mocks.signIn.mockResolvedValue({ data: { user: { id: actor.sessionId } }, error: null });
    if (mode === "throw") mocks.signIn.mockRejectedValue(new Error("sensitive provider body"));
    expect(await verifyAdminRolePassword(intent, "disposable-proof-password", "192.0.2.10")).toEqual({ ok: false, code: "password_invalid" });
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" }); expect(mocks.issue).not.toHaveBeenCalled();
  });
  it("does not issue proof if temporary cleanup fails", async () => {
    mocks.signOut.mockRejectedValue(new Error("transport"));
    expect((await verifyAdminRolePassword(intent, "disposable-proof-password", "192.0.2.10")).ok).toBe(false);
    expect(mocks.issue).not.toHaveBeenCalled();
  });
  it("requires native AAL2 even when dashboard CAPTCHA is absent", async () => {
    mocks.actor.mockResolvedValue({ ok: true, value: { ...actor, currentLevel: "aal1" } });
    expect(await verifyAdminRolePassword(intent, "disposable-proof-password", "192.0.2.10")).toEqual({ ok: false, code: "verification_required" });
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.issue).not.toHaveBeenCalled();
  });
  it("rejects an invalid original session before creating the trusted client", async () => {
    mocks.actor.mockResolvedValue({ ok: false, code: "session_invalid" });
    expect(await verifyAdminRolePassword(intent, "disposable-proof-password", "192.0.2.10")).toEqual({ ok: false, code: "session_invalid" });
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("fails closed on durable limit/permission/outage denial before sign-in", async () => {
    mocks.reserve.mockResolvedValue({ ok: false, code: "rate_limited" });
    expect(await verifyAdminRolePassword(intent, "disposable-proof-password", "192.0.2.10")).toEqual({ ok: false, code: "rate_limited" });
    expect(mocks.create).not.toHaveBeenCalled();
    mocks.prepare.mockResolvedValue({ ok: false, code: "permission_denied" });
    expect(await verifyAdminRolePassword(intent, "disposable-proof-password", "192.0.2.10")).toEqual({ ok: false, code: "permission_denied" });
  });
  it("rejects non-role and malformed operations without a password check", async () => {
    expect((await verifyAdminRolePassword({ operation: "admin.security.read", payload: {} }, "disposable-proof-password", "192.0.2.10")).ok).toBe(false);
    expect(mocks.create).not.toHaveBeenCalled();
  });
});
