import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ mfa: vi.fn() }));
vi.mock("@/lib/supabase/config", () => ({ getSupabaseUrl: () => "https://example.test", getSupabasePublishableKey: () => "fixture-public-key" }));
vi.mock("@/lib/auth/mfa", () => ({ checkAdminMFA: mocks.mfa }));
vi.mock("@supabase/ssr", () => ({ createServerClient: () => ({
  auth: { getUser: async () => ({ data: { user: { id: "fixture-user" } } }), getClaims: async () => ({ data: { claims: { jnuits_admin_role: "admin", jnuits_role_version: 1 } } }) },
  rpc: async () => ({ data: { jnuits_admin_role: "admin", jnuits_role_version: 1 }, error: null }),
}) }));
import { updateSession } from "./proxy";
beforeEach(() => mocks.mfa.mockResolvedValue({ ok: false, redirectTo: "/admin/mfa/challenge" }));
it("returns a mandatory MFA challenge to the requested queue", async () => {
  const response = await updateSession(new NextRequest("https://example.test/admin/membership?queue=alumni", { headers: { cookie: "sb-fixture=present" } }));
  expect(response.headers.get("location")).toBe("https://example.test/admin/mfa/challenge?next=%2Fadmin%2Fmembership%3Fqueue%3Dalumni");
});
it("retains the allowlisted login destination for an already signed-in AAL1 operator", async () => {
  const response = await updateSession(new NextRequest("https://example.test/admin/login?next=%2Fadmin%2Fsettings%2Fsecurity", { headers: { cookie: "sb-fixture=present" } }));
  expect(response.headers.get("location")).toBe("https://example.test/admin/mfa/challenge?next=%2Fadmin%2Fsettings%2Fsecurity");
});
it("preserves optional-enforcement routine workspace entry", async () => {
  mocks.mfa.mockResolvedValue({ ok: true, currentLevel: "aal1", nextLevel: "aal1", enforced: false, redirectTo: null });
  const response = await updateSession(new NextRequest("https://example.test/admin/membership", { headers: { cookie: "sb-fixture=present" } }));
  expect(response.headers.get("location")).toBeNull();
});
