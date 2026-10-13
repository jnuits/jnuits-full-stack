import { createClient } from "@supabase/supabase-js";
import { createElement } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ client: null as unknown, upload: false }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => state.client }));
vi.mock("@/lib/auth/session", () => ({
  requireAdminPermission: async (permission: string) => {
    if (permission !== "cms.projects.manage") throw new Error("Fixture permission denied");
    return { user: { id: "11111111-1111-4111-8111-111111111111" }, roles: ["content_admin"] };
  },
  hasPermission: async (permission: string) => permission === "cms.media.manage" && state.upload,
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("next/image", () => ({ default: ({ src, alt }: { src: string; alt: string }) => createElement("img", { src, alt }) }));
vi.mock("@/app/admin/content/actions", () => ({ createProject: vi.fn(), updateProject: vi.fn(), deleteProject: vi.fn(), saveDeveloperProfile: vi.fn() }));
import ProjectsPage from "./page";

const cover = "https://res.cloudinary.com/fixture/image/upload/current.jpg";
const projects = [{
  id: "project-a", slug: "project-a", title: "Fixture Project A", tagline: "Existing tagline", description: "Existing description",
  tech_stack: ["TypeScript"], category: "web", status: "active", cover_image_url: cover,
  github_url: "https://github.com/example/fixture", demo_url: "https://example.com", is_featured: true,
  started_at: "2026-03-04", completed_at: "2026-05-06", created_at: "2026-01-01T00:00:00Z", project_contributors: [],
}, {
  id: "project-b", slug: "project-b", title: "Fixture Project B", tagline: "Second tagline", description: "Second description",
  tech_stack: [], category: "mobile", status: "completed", cover_image_url: null, github_url: null, demo_url: null,
  is_featured: false, started_at: null, completed_at: null, created_at: "2026-01-01T00:00:00Z", project_contributors: [],
}];
const media = [{ id: "asset-next", title: "Next cover", public_id: "fixture/next", media_kind: "image", secure_url: "https://res.cloudinary.com/fixture/image/upload/next.jpg", thumbnail_url: null, alt_text: "Fixture cover" }];
async function view(project = "project-a", developer = "") {
  return ProjectsPage({ searchParams: Promise.resolve({ editProject: project, editDeveloper: developer }) });
}
function form() { return screen.getAllByLabelText("Title").find(e => e.getAttribute("name") === "title")!.closest("form")!; }

describe("project editor submission contract", () => {
  beforeEach(() => {
    state.upload = false;
    state.client = createClient("https://fixture.supabase.co", "fixture-key", {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: async input => {
        const table = new URL(String(input)).pathname.split("/").at(-1);
        const rows = table === "projects" ? projects : table === "media_assets" ? media : table === "developer_profiles" ? [{
          id: "developer-a", name: "Fixture Developer", role: "Developer", focus: "Fixture", bio: "Fixture biography",
          status: "published", is_lead: false, sort_order: 0, media_asset_id: "legacy-developer-cover", updated_at: "2026-01-01T00:00:00Z",
        }] : [];
        return Response.json(rows);
      } },
    });
  });

  it("preserves a stored cover that is outside the current media window", async () => {
    render(await view());
    expect(new FormData(form()).get("coverImageUrl")).toBe(cover);
  });
  it("submits every existing optional project value instead of clearing omitted fields", async () => {
    render(await view()); const data = new FormData(form());
    expect(Object.fromEntries(["tagline", "category", "startedAt", "completedAt", "isFeatured"].map(k => [k, data.get(k)]))).toEqual({
      tagline: "Existing tagline", category: "web", startedAt: "2026-03-04", completedAt: "2026-05-06", isFeatured: "true",
    });
    expect(data.get("status")).toBe("active");
  });
  it("resets a dirty editor when the selected project changes", async () => {
    const rendered = render(await view());
    fireEvent.change(within(form()).getByLabelText("Title"), { target: { value: "Unsaved A" } });
    rendered.rerender(await view("project-b"));
    expect(within(form()).getByLabelText("Title")).toHaveValue("Fixture Project B");
    expect(new FormData(form()).get("status")).toBe("completed");
  });
  it("keeps a genuine developer sort order of zero", async () => {
    render(await view("project-a", "developer-a"));
    const developerForm = screen.getByLabelText("Name").closest("form")!;
    expect(new FormData(developerForm).get("sortOrder")).toBe("0");
  });
  it("preserves a developer's linked media outside the current media window", async () => {
    render(await view("project-a", "developer-a"));
    const developerForm = screen.getByLabelText("Name").closest("form")!;
    expect(new FormData(developerForm).get("mediaAssetId")).toBe("legacy-developer-cover");
  });
  it("selects or explicitly clears the actual cover URL", async () => {
    render(await view()); const editor = form();
    fireEvent.change(within(editor).getByLabelText("Cover image"), { target: { value: "asset-next" } });
    expect(new FormData(editor).get("coverImageUrl")).toBe(media[0].secure_url);
    fireEvent.change(within(editor).getByLabelText("Cover image"), { target: { value: "" } });
    expect(new FormData(editor).get("coverImageUrl")).toBe("");
  });
  it("offers inline upload only to an authorized media manager", async () => {
    state.upload = true; render(await view());
    expect(within(form()).getByRole("button", { name: "Upload cover" })).toBeEnabled();
  });
  it("requires confirmation before hiding a public project", async () => {
    render(await view());
    fireEvent.change(within(form()).getByLabelText("Status"), { target: { value: "archived" } });
    fireEvent.click(within(form()).getByRole("button", { name: "Update project" }));
    expect(screen.getByRole("dialog", { name: "Archive this project?" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(new FormData(form()).get("status")).toBe("archived");
  });
  it("submits an explicit false when featured is unchecked", async () => {
    render(await view("project-b"));
    expect(new FormData(form()).get("isFeatured")).toBe("false");
    expect(within(form()).queryByRole("button", { name: "Upload cover" })).not.toBeInTheDocument();
  });
});
