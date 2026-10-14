import { createClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
const fixture = vi.hoisted(() => ({ client: null as unknown, allowed: true, writes: [] as Record<string, unknown>[] }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => fixture.client }));
vi.mock("@/lib/auth/session", () => ({ requireAdminPermission: async (permission: string) => {
  if (permission !== "admin.committee.manage" || !fixture.allowed) throw new Error("Committee denied");
  return { user: { id: "11111111-1111-4111-8111-111111111111" }, roles: ["super_admin"] };
} }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`Redirect ${url}`); } }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock("@/lib/admin/flash", () => ({ setAdminFlash: vi.fn() }));
import { saveAdvisorProfile } from "./actions";
function form(create = false) {
  const data = new FormData();
  for (const [k,v] of Object.entries({advisorId: create ? "" : "fixture-advisor", advisorJnuitsId: "JNUITS-CA0001", advisorType: "main_advisor", fullName: "Fixture Advisor", dateConfidence: "verified", isCurrent: "true", isPublic: "true", sortOrder: "0", userId: "22222222-2222-4222-8222-222222222222"})) data.set(k,v);
  return data;
}
describe("advisor profile saves preserve separate portal linking", () => {
  beforeEach(() => {
    fixture.allowed = true; fixture.writes = [];
    fixture.client = createClient("https://fixture.supabase.co", "fixture-key", {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: async (input, init) => {
        if (new URL(String(input)).pathname.endsWith("/advisor_profiles") && (init?.method === "POST" || init?.method === "PATCH")) fixture.writes.push(JSON.parse(String(init.body)));
        return Response.json({ id: "fixture-advisor" });
      } },
    });
  });
  it("does not overwrite a concurrently linked account or original creator on profile edit", async () => {
    await expect(saveAdvisorProfile(form())).rejects.toThrow("Redirect");
    expect(fixture.writes).toHaveLength(1);
    expect(fixture.writes[0]).not.toHaveProperty("user_id");
    expect(fixture.writes[0]).not.toHaveProperty("created_by_user_id");
    expect(fixture.writes[0]).toMatchObject({ full_name: "Fixture Advisor", sort_order: 0 });
  });
  it("cannot create a portal link by posting a raw UUID to profile creation", async () => {
    await expect(saveAdvisorProfile(form(true))).rejects.toThrow("Redirect");
    expect(fixture.writes).toHaveLength(1);
    expect(fixture.writes[0].user_id ?? null).toBeNull();
  });
  it("denies a caller lacking committee permission before persistence", async () => {
    fixture.allowed = false;
    await expect(saveAdvisorProfile(form())).rejects.toThrow("Committee denied");
    expect(fixture.writes).toEqual([]);
  });
});
