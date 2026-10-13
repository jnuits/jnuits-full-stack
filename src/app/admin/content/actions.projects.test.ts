import { createClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ client: null as unknown, allowed: true, writes: [] as Array<Record<string, unknown>>, flashes: [] as Array<{tone: string}> }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => state.client }));
vi.mock("@/lib/auth/session", () => ({ requireAdminPermission: async (permission: string) => {
  if (permission !== "cms.projects.manage" || !state.allowed) throw new Error("Project permission denied");
  return { user: { id: "11111111-1111-4111-8111-111111111111" }, roles: ["content_admin"] };
} }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`Redirect ${url}`); } }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/admin/flash", () => ({ setAdminFlash: async (flash: {tone: string}) => { state.flashes.push(flash); } }));
vi.mock("@/lib/content/media-assets", () => ({ insertAuditEvent: vi.fn(), upsertCloudinaryMediaAsset: vi.fn() }));
import { createProject, updateProject } from "./actions";
function data(values: Record<string, string>) { const form = new FormData(); for (const [k,v] of Object.entries(values)) form.set(k,v); return form; }

describe("project mutation contract", () => {
  beforeEach(() => {
    state.allowed = true; state.writes = []; state.flashes = [];
    state.client = createClient("https://fixture.supabase.co", "fixture-key", {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: async (_input, init) => {
        if (init?.method === "PATCH" || init?.method === "POST") state.writes.push(JSON.parse(String(init.body)));
        return Response.json(init?.method === "POST" ? { id: "fixture-project" } : []);
      } },
    });
  });
  it("does not clear optional existing values when a caller submits only a title", async () => {
    await expect(updateProject(data({ projectId: "fixture-project", title: "Updated title" }))).rejects.toThrow("Redirect");
    expect(state.flashes.at(-1)?.tone).toBe("success");
    expect(state.writes).toEqual([{ title: "Updated title", updated_at: expect.any(String) }]);
  });
  it("permits deliberate clears and a false featured setting", async () => {
    await expect(updateProject(data({ projectId: "fixture-project", title: "Updated title", coverImageUrl: "", tagline: "", isFeatured: "false" }))).rejects.toThrow("Redirect");
    expect(state.writes[0]).toMatchObject({ cover_image_url: null, tagline: null, is_featured: false });
    expect(state.writes[0]).not.toHaveProperty("slug");
  });
  it("creates a project with supported defaults for omitted optional controls", async () => {
    await expect(createProject(data({ title: "New fixture" }))).rejects.toThrow("Redirect");
    expect(state.flashes.at(-1)?.tone).toBe("success");
    expect(state.writes[0]).toMatchObject({ category: "other", status: "active", is_featured: false, slug: "new-fixture" });
  });
  it.each(["draft", "published"])("rejects unsupported status %s before persistence", async status => {
    await expect(createProject(data({ title: "Fixture", category: "web", status, isFeatured: "false" }))).rejects.toThrow("Redirect");
    expect(state.writes).toEqual([]);
    expect(state.flashes.at(-1)?.tone).toBe("error");
  });
  it("denies an unauthorized caller before persistence", async () => {
    state.allowed = false;
    await expect(updateProject(data({projectId: "fixture-project", title: "Attempt"}))).rejects.toThrow("Project permission denied");
    expect(state.writes).toEqual([]);
  });
});
