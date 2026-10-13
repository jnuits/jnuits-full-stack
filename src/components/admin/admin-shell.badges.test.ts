import { createClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
const fixture = vi.hoisted(() => ({ client: null as unknown, membership: true, active: true, fail: false, requests: [] as URL[] }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => fixture.client }));
vi.mock("@/lib/auth/session", () => ({
  requireAdminUser: async () => { if (!fixture.active) throw new Error("Admin session denied"); return {user: {id: "fixture-admin"}, roles: ["admin"]}; },
  hasPermission: async (permission: string) => permission === "admin.membership.manage" && fixture.membership,
}));
import { AdminShell } from "./admin-shell";
const rows = ["profile_change", "email_change", "jnuits_id_change", "workplace_update", "account_deletion"].map(request_type => ({ request_type, status: "pending" }));
describe("sidebar queue counts", () => {
  beforeEach(() => {
    fixture.membership = true; fixture.active = true; fixture.fail = false; fixture.requests = [];
    fixture.client = createClient("https://fixture.supabase.co", "fixture-key", {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: async input => {
        const url = new URL(String(input)); fixture.requests.push(url);
        if (url.pathname.endsWith("/profile_update_requests")) {
          if (fixture.fail) return Response.json({code: "XX000", message: "Fixture count unavailable"}, {status: 500});
          const types = url.searchParams.get("request_type") || "";
          const count = rows.filter(row => types.includes(row.request_type)).length;
          return new Response(null, {headers: {"content-range": `*/${count}`}});
        }
        return new Response(null, {headers: {"content-range": "*/1"}});
      } },
    });
  });
  it("counts exactly the identity queue while preserving separate legacy/account handling", async () => {
    const shell = await AdminShell({children: null});
    expect(shell.props.badgeCounts.pendingProfileRequests).toBe(3);
    expect(fixture.requests.filter(u => u.pathname.endsWith("/profile_update_requests"))).toHaveLength(1);
    expect(shell.props.badgeCounts).not.toHaveProperty("pendingWorkplace");
    expect(shell.props.badgeCounts).not.toHaveProperty("pendingProfile");
  });
  it("represents a failed counter as unknown without blocking dashboard navigation", async () => {
    fixture.fail = true;
    const shell = await AdminShell({children: null});
    expect(shell.props.badgeCounts.pendingProfileRequests).toBeNull();
    expect(shell.props.queueCountsUnavailable).toBe(true);
    expect(shell.props.navigationItems.some((i: {href: string}) => i.href === "/admin/profile-changes")).toBe(true);
  });
  it("rejects an inactive session before any sidebar counter read", async () => {
    fixture.active = false;
    await expect(AdminShell({children: null})).rejects.toThrow("Admin session denied");
    expect(fixture.requests).toEqual([]);
  });
  it("never fetches membership counters for an unauthorized role", async () => {
    fixture.membership = false;
    await AdminShell({children: null});
    expect(fixture.requests).toEqual([]);
  });
});
