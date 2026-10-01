import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), permission: vi.fn(), read: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/auth/session", async (original) => ({ ...await original<typeof import("@/lib/auth/session")>(), getAuthContext: mocks.auth, hasPermission: mocks.permission }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc: mocks.rpc, from: () => ({ select: () => ({ eq: () => ({ maybeSingle: mocks.read }) }) }) }) }));
vi.mock("@/lib/supabase/flexible", () => ({ asFlexibleClient: (client: unknown) => client }));
import { authorizeAvatarTarget } from "./avatar-access";
const id = "11111111-1111-4111-8111-111111111111";
const current = { id, user_id: "owner", lifecycle_status: "current", portal_access_status: "active", current_membership_path_status: "open" };
describe("member avatar lifecycle authorization", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.auth.mockResolvedValue({ user: { id: "owner" }, roles: ["member"] }); mocks.permission.mockResolvedValue(false); mocks.read.mockResolvedValue({ data: current, error: null }); mocks.rpc.mockResolvedValue({ data: { status: "reconciled", transitioned: 0 }, error: null }); });
  it("allows an active current member with an open path to upload their own photo", async () => {
    expect(await authorizeAvatarTarget("member", id)).toMatchObject({ ok: true, target: { targetId: id } });
  });
  it.each(["departure_requested", "closed_appealable", "closed_final"])("refuses a direct photo upload from path %s", async (path) => {
    mocks.read.mockResolvedValue({ data: { ...current, current_membership_path_status: path }, error: null });
    expect(await authorizeAvatarTarget("member", id)).toMatchObject({ ok: false, status: 403 });
  });
  it("does not treat missing lifecycle or security as active current", async () => {
    mocks.read.mockResolvedValue({ data: { id, user_id: "owner", current_membership_path_status: "open" }, error: null });
    expect(await authorizeAvatarTarget("member", id)).toMatchObject({ ok: false, status: 403 });
  });
  it("reconciles before permitting an apparently-current photo upload", async () => {
    mocks.read.mockResolvedValueOnce({ data: current, error: null }).mockResolvedValue({ data: { ...current, lifecycle_status: "former" }, error: null });
    expect(await authorizeAvatarTarget("member", id)).toMatchObject({ ok: false, status: 403 });
  });
  it("keeps membership administration authorized for an unclaimed/restricted member", async () => {
    mocks.read.mockResolvedValue({ data: { ...current, user_id: null, lifecycle_status: "former", portal_access_status: "frozen" }, error: null });
    mocks.permission.mockResolvedValue(true);
    expect(await authorizeAvatarTarget("member", id)).toMatchObject({ ok: true, target: { targetUserId: null } });
  });
});
