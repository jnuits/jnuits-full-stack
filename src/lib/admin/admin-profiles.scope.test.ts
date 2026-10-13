import { createClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminAccountRoleCode } from "./admin-account-policy";

const actor = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
const state = vi.hoisted(() => ({
  client: null as unknown, canManage: false, canManageRoles: false,
  userId: "11111111-1111-4111-8111-111111111111", role: "content_admin" as AdminAccountRoleCode,
  requests: [] as URL[],
}));
function session() { return { user: { id: state.userId, adminRole: state.role }, roles: [state.role] }; }
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => state.client }));
vi.mock("@/lib/auth/session", () => ({
  requireAdminUser: async () => session(),
  requireAdminPermission: async (permission: string) => {
    if (permission !== "admin.admin_profiles.manage" || !state.canManage) throw new Error("Account management denied");
    return session();
  },
  hasPermission: async (permission: string) => permission === "admin.admin_profiles.manage" ? state.canManage : permission === "admin.roles.manage_admin" && state.canManageRoles,
}));
import { loadAdminProfileDirectory } from "./admin-profiles";
import { parseAdminProfileFilters } from "./admin-profile-model";
import { AdminShell } from "@/components/admin/admin-shell";

const profiles = [actor, other].map((userId, i) => ({
  id: i === 0 ? "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" : "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  user_id: userId, admin_code: `ADMIN-${i}`, avatar_secure_url: null,
  display_name: i === 0 ? "Fixture Self" : "Fixture Other", email: `fixture-${i}@example.com`,
  title: null, linked_member_id: null, is_active: true, status: "active", status_reason: null,
  status_updated_at: null, status_updated_by_user_id: null,
  created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
}));
function load(tab: "self" | "directory" | "invitations" | "access", profile = "me", userId = actor) {
  return loadAdminProfileDirectory({
    actorAdminRole: state.role, actorUserId: userId, canManageAdminRoles: state.canManageRoles,
    filters: parseAdminProfileFilters({ tab, profile }), scope: tab === "self" ? "self" : "management",
  });
}

describe("admin self-profile read scope", () => {
  beforeEach(() => {
    state.canManage = false; state.canManageRoles = false; state.role = "content_admin"; state.userId = actor; state.requests = [];
    state.client = createClient("https://fixture.supabase.co", "fixture-key", {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: async (input) => {
        const url = new URL(String(input)); state.requests.push(url);
        const table = url.pathname.split("/").at(-1);
        let rows: unknown[] = [];
        if (table === "admin_profiles") {
          rows = profiles.filter(p => !url.searchParams.get("user_id") || url.searchParams.get("user_id") === `eq.${p.user_id}`);
        }
        if (table === "rbac_user_platform_roles") {
          rows = [actor, other].filter(id => (url.searchParams.get("user_id") || "").includes(id)).map(id => ({
            user_id: id, rbac_platform_roles: { code: id === actor ? state.role : "content_admin", display_name: "Fixture role" },
          }));
        }
        return Response.json(rows, { headers: { "content-range": `0-${rows.length}/${rows.length}` } });
      } },
    });
  });

  it("shows only the authenticated profile when a self bookmark names another profile", async () => {
    const result = await load("self", profiles[1].id);
    expect(result.profiles.map(p => p.userId)).toEqual([actor]);
    expect(result.selectedProfile?.userId).toBe(actor);
    expect(result.actorProfile?.displayName).toBe("Fixture Self");
    expect(state.requests.find(u => u.pathname.endsWith("/admin_profiles"))?.searchParams.get("user_id")).toBe(`eq.${actor}`);
    expect(state.requests.filter(u => u.pathname.endsWith("/rbac_user_platform_roles"))[0]?.searchParams.get("user_id")).toBe(`in.(${actor})`);
  });

  it.each(["directory", "invitations", "access"] as const)("denies the %s management view before querying for a nonmanager", async tab => {
    await expect(load(tab)).rejects.toThrow("Account management denied");
    expect(state.requests).toEqual([]);
  });

  it("does not read invitations or candidates for a manager's own self view", async () => {
    state.canManage = true; state.canManageRoles = true; state.role = "super_admin";
    const result = await load("self");
    expect(result.profiles.map(p => p.userId)).toEqual([actor]);
    expect(result.actorInviteRoles).toEqual([]);
    expect(result.invitations).toEqual([]);
    expect(result.invitationMemberCandidates).toEqual([]);
    expect(state.requests.map(u => u.pathname.split("/").at(-1))).not.toContain("admin_invitations");
    expect(state.requests.map(u => u.pathname.split("/").at(-1))).not.toContain("members");
  });

  it("rejects a stale or forged actor context before any database read", async () => {
    await expect(load("self", "me", other)).rejects.toThrow(/actor|identity|session/i);
    expect(state.requests).toEqual([]);
  });

  it("keeps account-management navigation hidden while self navigation stays available", async () => {
    const shell = await AdminShell({ children: null });
    expect(shell.props.navigationItems.map((i: { href: string }) => i.href)).toContain("/admin/settings/profile");
    expect(shell.props.navigationItems.map((i: { href: string }) => i.href)).not.toContain("/admin/admin-profiles");
  });

  it("preserves the authorized management directory", async () => {
    state.canManage = true; state.canManageRoles = true; state.role = "super_admin";
    const result = await load("directory");
    expect(result.profiles.map(p => p.userId)).toEqual([actor, other]);
  });
});
