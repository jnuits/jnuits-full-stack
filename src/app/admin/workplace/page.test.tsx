import { beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";

const fixture = vi.hoisted(() => ({ client: null as unknown, fail: false }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => fixture.client }));
vi.mock("@/lib/auth/session", () => ({
  requireAdminPermission: async (permission: string) => {
    if (permission !== "admin.membership.manage") throw new Error("Fixture permission denied");
    return { user: { id: "fixture-admin" }, roles: ["super_admin"] };
  },
}));
import WorkplacePage from "./page";

describe("workplace queue member relationship", () => {
  beforeEach(() => {
    fixture.fail = false;
    fixture.client = createClient("https://fixture.supabase.co", "fixture-key", {
      global: { fetch: async (input, init) => {
        const url = new URL(String(input));
        const select = url.searchParams.get("select") || "";
        if (select.includes("members(")) return Response.json({ code: "PGRST201", message: "Ambiguous member relationship" }, { status: 300 });
        if (select.includes("members!")) {
          if (fixture.fail) return Response.json({ code: "XX000", message: "private database error" }, { status: 500 });
          const rows = url.searchParams.get("status") === "eq.pending" ? [{
            id: "request-1", member_id: "member-1", payload: { currentOrganization: "Fictional Workplace" },
            requested_at: "2026-10-05T00:00:00Z", reviewed_at: null, review_note: null, status: "pending",
            members: { id: "member-1", full_name: "Fictional Alumni", jnuits_id: "JnUITS-2099961", member_type: "alumni" },
          }] : [];
          return Response.json(rows, { headers: { "content-range": `0-0/${rows.length}` } });
        }
        return new Response(init?.method === "HEAD" ? null : "[]", { headers: { "content-range": "*/1" } });
      } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
  });
  it("loads the pending alumni row despite reverse case and appeal relationships", async () => {
    const page = await WorkplacePage({ searchParams: Promise.resolve({}) });
    expect(page.props.requests).toMatchObject([{ fullName: "Fictional Alumni", status: "pending", payload: { currentOrganization: "Fictional Workplace" } }]);
    expect(page.props.totalCount).toBe(1);
  });
  it("fails visibly rather than presenting a failed queue as empty", async () => {
    fixture.fail = true;
    await expect(WorkplacePage({ searchParams: Promise.resolve({}) })).rejects.toThrow(/workplace.*could not be loaded/i);
  });
});
