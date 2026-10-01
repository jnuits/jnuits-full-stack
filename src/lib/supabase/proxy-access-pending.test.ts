import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/supabase/config", () => ({ getSupabaseUrl: () => "https://example.test", getSupabasePublishableKey: () => "fixture-public-key" }));
vi.mock("@/lib/auth/mfa", () => ({ checkAdminMFA: async () => ({ ok: true }) }));
vi.mock("@supabase/ssr", () => ({ createServerClient: () => ({
  auth: { getUser: async () => ({ data: { user: { id: "fixture-user" } } }), getClaims: async () => ({ data: { claims: { jnuits_portal_role: "member", jnuits_role_version: 1 } } }) }, rpc: mocks.rpc,
}) }));
import { updateSession } from "./proxy";
beforeEach(() => mocks.rpc.mockResolvedValue({ data: { jnuits_portal_role: "member", jnuits_role_version: 1 }, error: null }));
it.each(["frozen", "suspended", "deactivated", "deletion_requested", "deleted", "unlinked"])("does not redirect a blocked %s member back into a dashboard loop based only on role", async (state) => {
  const response = await updateSession(new NextRequest(`https://example.test/portal/access-pending?access=${state}`, { headers: { cookie: "sb-fixture=present" } }));
  expect(response.headers.get("location")).toBeNull();
  expect(response.headers.get("x-middleware-next")).toBe("1");
});
