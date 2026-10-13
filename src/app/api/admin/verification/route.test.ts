import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ prepare: vi.fn(), send: vi.fn(), verify: vi.fn(), password: vi.fn() }));
vi.mock("@/lib/auth/admin-verification/email", () => ({ prepareAdminVerification: mocks.prepare, requestAdminEmailVerification: mocks.send, verifyAdminEmailCodeWithScope: mocks.verify }));
vi.mock("@/lib/auth/admin-verification/password", () => ({ verifyAdminRolePassword: mocks.password }));
vi.mock("@/lib/auth/session", () => ({ getAuthContext: async () => ({ user: { id: "11111111-1111-4111-8111-111111111111" } }) }));
vi.mock("@/lib/security/rate-limit", () => ({ getRequestIp: () => "192.0.2.10" }));
// Use the real same-origin/auth guard rather than an identity mock.
import { POST } from "./route";
const intent = { operation: "admin.security.read", payload: {} };
const id = "33333333-3333-4333-8333-333333333333";
const proof = { token: `${id}.${"a".repeat(43)}`, expiresAt: "2026-10-02T23:05:00Z" };
function request(body: unknown, origin = "https://jnuits.example.test") {
  return new NextRequest("https://jnuits.example.test/api/admin/verification", { method: "POST", headers: { "Content-Type": "application/json", origin }, body: JSON.stringify(body) });
}
beforeEach(() => {
  vi.resetAllMocks(); vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-02T23:00:00Z"));
  mocks.prepare.mockResolvedValue({ ok: true, value: { decision: { status: "required", methods: ["totp", "email"] } } });
  mocks.send.mockResolvedValue({ ok: true, value: { challengeId: id, expiresAt: proof.expiresAt } });
  mocks.verify.mockResolvedValue({ ok: true, value: { proof, readOperation: "admin.security.read" } });
  mocks.password.mockResolvedValue({ ok: true, value: proof });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });
describe("same-origin admin verification API", () => {
  it("rejects cross-origin issuance before any verification service and disables caching", async () => {
    const response = await POST(request({ action: "email_send", intent }, "https://untrusted.example.test"), { params: Promise.resolve({}) });
    expect(response.status).toBe(403); expect(response.headers.get("Cache-Control")).toBe("private, no-store, max-age=0");
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it("rejects unknown operations, forged actor/recipient metadata and oversized passwords", async () => {
    for (const body of [{ action: "prepare", intent: { operation: "unknown", payload: {} } }, { action: "email_send", intent, to: "attacker@example.test" }, { action: "prepare", intent, actor: { role: "super_admin" } }, { action: "password_verify", intent, password: "x".repeat(4097), captchaToken: "fixture" }]) {
      expect((await POST(request(body), { params: Promise.resolve({}) })).status).toBe(422);
    }
    expect(mocks.prepare).not.toHaveBeenCalled(); expect(mocks.send).not.toHaveBeenCalled(); expect(mocks.password).not.toHaveBeenCalled();
  });
  it("prepares a strict named intent without returning proof", async () => {
    const response = await POST(request({ action: "prepare", intent }), { params: Promise.resolve({}) });
    expect(response.status).toBe(200); expect(mocks.prepare).toHaveBeenCalledWith(intent);
    expect(JSON.stringify(await response.json())).not.toContain(proof.token);
  });
  it("disables dashboard CAPTCHA while public protection is configured", async () => {
    vi.stubEnv("AUTH_CAPTCHA_REQUIRED", "true");
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "public-site-key");
    vi.stubEnv("TURNSTILE_SECRET_KEY", "private-captcha-secret");
    mocks.prepare.mockResolvedValue({ ok: true, value: { decision: { status: "required", methods: ["password"] } } });
    const response = await POST(request({ action: "prepare", intent: { operation: "admin.role.remove", payload: { adminProfileId: id, confirmation: "QA" } } }), { params: Promise.resolve({}) });
    const body = await response.json();
    expect(body.value.captcha).toEqual({ required: false, siteKey: "" });
    expect(JSON.stringify(body)).not.toContain("private-captcha-secret");
  });
  it("sets only a server-resolved read-scope HttpOnly cookie and returns no scope metadata", async () => {
    const response = await POST(request({ action: "email_verify", challengeId: id, code: "123456" }), { params: Promise.resolve({}) });
    const cookie = response.headers.get("Set-Cookie")!;
    expect(cookie).toContain("jnuits-admin-security-read="); expect(cookie).toContain("HttpOnly"); expect(cookie).toContain("SameSite=strict");
    expect(cookie).toContain("Max-Age=300");
    expect(await response.json()).toEqual({ ok: true, value: proof });
    expect(mocks.verify).toHaveBeenCalledWith(id, "123456", "192.0.2.10");
  });
  it("never creates a read cookie from mutation/password proofs", async () => {
    mocks.verify.mockResolvedValue({ ok: true, value: { proof } });
    expect((await POST(request({ action: "email_verify", challengeId: id, code: "123456" }), { params: Promise.resolve({}) })).headers.get("Set-Cookie")).toBeNull();
    const response = await POST(request({ action: "password_verify", intent: { operation: "admin.role.remove", payload: { adminProfileId: id, confirmation: "fixture" } }, password: "disposable-proof-password", captchaToken: "fixture" }), { params: Promise.resolve({}) });
    expect(response.headers.get("Set-Cookie")).toBeNull();
  });
  it("returns bounded denial codes without provider bodies or proof cookies", async () => {
    mocks.verify.mockResolvedValue({ ok: false, code: "delivery_failed" });
    const response = await POST(request({ action: "email_verify", challengeId: id, code: "123456" }), { params: Promise.resolve({}) });
    expect(response.status).toBe(403); expect(await response.json()).toEqual({ ok: false, code: "delivery_failed" });
    expect(response.headers.get("Set-Cookie")).toBeNull();
    mocks.prepare.mockRejectedValue(new Error("private provider response"));
    const failure = await POST(request({ action: "prepare", intent }), { params: Promise.resolve({}) });
    expect(await failure.json()).toEqual({ ok: false, code: "verification_unavailable" });
  });
});
