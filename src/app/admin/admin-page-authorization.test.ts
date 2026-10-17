import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const denial = vi.hoisted(() => ({
  permission: vi.fn(async (permission: string) => { throw new Error(`Denied: ${permission}`); }),
  user: vi.fn(async () => { throw new Error("Denied: active admin"); }),
  database: vi.fn(() => { throw new Error("Privileged read before authorization"); }),
}));
vi.mock("@/lib/auth/session", () => ({
  requireAdminPermission: denial.permission,
  requireAdminUser: denial.user,
  hasPermission: vi.fn(async () => false),
  getCurrentSession: denial.user,
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: denial.database }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined, getAll: () => [] }),
  headers: async () => new Headers(),
}));

// A missing or wrong page guard must fail before any privileged reader runs.
const pages = [
  ["/admin/content", "admin.dashboard.read", () => import("./content/page")],
  ["/admin/content/about", "cms.pages.manage", () => import("./content/about/page")],
  ["/admin/content/slider", "cms.pages.manage", () => import("./content/slider/page")],
  ["/admin/content/pages", "cms.pages.manage", () => import("./content/pages/page")],
  ["/admin/content/media", "cms.media.manage", () => import("./content/media/page")],
  ["/admin/content/projects", "cms.projects.manage", () => import("./content/projects/page")],
  ["/admin/content/blogs", "cms.blogs.review", () => import("./content/blogs/page")],
  ["/admin/content/events", "cms.events.manage", () => import("./content/events/page")],
  ["/admin/content/events/new", "cms.events.manage", () => import("./content/events/new/page")],
  ["/admin/content/events/event", "cms.events.manage", () => import("./content/events/[eventId]/page")],
  ["/admin/content/events/event/operations", "cms.events.manage", () => import("./content/events/[eventId]/operations/page")],
  ["/admin/content/notices", "cms.notices.manage", () => import("./content/notices/page")],
  ["/admin/content/notices/new", "cms.notices.manage", () => import("./content/notices/new/page")],
  ["/admin/content/notices/notice", "cms.notices.manage", () => import("./content/notices/[noticeId]/page")],
  ["/admin/content/gallery", "cms.gallery.manage", () => import("./content/gallery/page")],
  ["/admin/content/gallery/album", "cms.gallery.manage", () => import("./content/gallery/[albumId]/page")],
  ["/admin/content/forms", "cms.forms.manage", () => import("./content/forms/page")],
  ["/admin/workplace", "admin.membership.manage", () => import("./workplace/page")],
  ["/admin/profile-changes", "admin.membership.manage", () => import("./profile-changes/page")],
  ["/admin/invitations", "admin.membership.manage", () => import("./invitations/page")],
  ["/admin/decisions", "admin.decisions.read", () => import("./decisions/page")],
  ["/admin/reconcile", "admin.reconcile.manage", () => import("./reconcile/page")],
  ["/admin/reports", "admin.reports.read", () => import("./reports/page")],
  ["/admin/committee", "admin.committee.manage", () => import("./committee/page")],
  ["/admin/certificates", "admin.certificates.manage", () => import("./certificates/page")],
  ["/admin/audit", "admin.audit.read", () => import("./audit/page")],
] as const;

describe("admin page authorization before privileged reads", () => {
  const loadedPages = new Map<string, (props: unknown) => unknown>();
  let dashboard: () => Promise<unknown>;
  // Cold transforms of whole server pages are fixture setup, not guard work.
  // Keep each actual authorization assertion under the normal five-second limit.
  beforeAll(async () => {
    await Promise.all(pages.map(async ([path, , load]) => {
      loadedPages.set(path, (await load()).default as (props: unknown) => unknown);
    }));
    dashboard = (await import("./page")).default;
  }, 60_000);
  beforeEach(() => vi.clearAllMocks());
  it.each(pages)("denies %s with its own permission before privileged work", async (path, permission) => {
    const page = loadedPages.get(path)!;
    await expect(Promise.resolve().then(() => page({
      searchParams: Promise.resolve({}),
      params: Promise.resolve({ eventId: "fixture", noticeId: "fixture", albumId: "fixture" }),
    }))).rejects.toThrow(`Denied: ${permission}`);
    expect(denial.database).not.toHaveBeenCalled();
  });
  it("denies the general dashboard before its privileged readers", async () => {
    await expect(dashboard()).rejects.toThrow("Denied: active admin");
    expect(denial.database).not.toHaveBeenCalled();
  });
});
