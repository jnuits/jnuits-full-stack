import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  checkAdminMFA: vi.fn(),
  createClient: vi.fn(),
  getAuthContext: vi.fn(),
  hasAdminRole: vi.fn(),
  hasPermission: vi.fn(),
  loadAdminLifecycleAccessState: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthContext: mocks.getAuthContext,
  hasAdminRole: mocks.hasAdminRole,
  hasPermission: mocks.hasPermission,
}));

vi.mock("@/lib/auth/admin-lifecycle", () => ({
  loadAdminLifecycleAccessState: mocks.loadAdminLifecycleAccessState,
}));
vi.mock("@/lib/auth/mfa", () => ({ checkAdminMFA: mocks.checkAdminMFA }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));

import { requireAdminApiPermission } from "./api-auth";

describe("requireAdminApiPermission", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createClient.mockResolvedValue({});
    mocks.getAuthContext.mockResolvedValue({
      roles: ["admin"],
      user: { id: "11111111-1111-4111-8111-111111111111" },
    });
    mocks.hasAdminRole.mockReturnValue(true);
    mocks.hasPermission.mockResolvedValue(true);
    mocks.loadAdminLifecycleAccessState.mockResolvedValue("active");
    mocks.checkAdminMFA.mockResolvedValue({ ok: true, currentLevel: "aal2", nextLevel: "aal2", error: null });
  });

  it("requires AAL2 when a protected API operation asks for it", async () => {
    const result = await requireAdminApiPermission("admin.retention.manage", {
      requireAal2: true,
    });

    expect(result).toMatchObject({
      auth: { user: { id: "11111111-1111-4111-8111-111111111111" } },
    });
    expect(mocks.checkAdminMFA).toHaveBeenCalledWith({});
  });

  it("blocks protected operations before database work when AAL2 is missing", async () => {
    mocks.checkAdminMFA.mockResolvedValue({ ok: false });

    const result = await requireAdminApiPermission("admin.retention.manage", {
      requireAal2: true,
    });

    expect(result.response?.status).toBe(403);
    await expect(result.response?.json()).resolves.toMatchObject({
      message: "Complete multi-factor verification before this action.",
    });
  });

  it("does not use disabled entry enforcement as proof of AAL2", async () => {
    mocks.checkAdminMFA.mockResolvedValue({ ok: true, enforced: false, currentLevel: "aal1", nextLevel: "aal1", error: null });
    expect((await requireAdminApiPermission("admin.retention.manage", { requireAal2: true })).response?.status).toBe(403);
  });

  it.each([
    [false, "aal1", "aal1"],
    [false, "aal2", "aal2"],
    [true, "aal2", "aal2"],
  ])("allows valid routine API assurance with enforcement=%s and %s/%s", async (enforced, currentLevel, nextLevel) => {
    mocks.checkAdminMFA.mockResolvedValue({ ok: true, enforced, currentLevel, nextLevel, error: null });
    expect((await requireAdminApiPermission("cms.events.manage")).auth?.user.id).toBe("11111111-1111-4111-8111-111111111111");
  });

  it.each([
    { ok: false, enforced: true, currentLevel: "aal1", nextLevel: "aal2", error: null },
    { ok: false, enforced: false, currentLevel: null, nextLevel: null, error: "Session assurance could not be verified." },
    { ok: false, enforced: true, currentLevel: null, nextLevel: null, error: "Admin security policy could not be verified." },
    { ok: true, enforced: true, currentLevel: "aal1", nextLevel: "aal2", error: null },
    { ok: true, enforced: true, currentLevel: "aal2", nextLevel: "aal1", error: null },
  ])("denies a protected handler before work for invalid policy/assurance %j", async (state) => {
    mocks.checkAdminMFA.mockResolvedValue(state);
    const permission = await requireAdminApiPermission("cms.events.manage");
    expect(permission.response?.status).toBe(403);
    expect(permission.auth).toBeUndefined();
  });

  it("fails closed when policy transport throws", async () => {
    mocks.checkAdminMFA.mockRejectedValue(new Error("Unavailable transport"));
    const permission = await requireAdminApiPermission("cms.events.manage");
    expect(permission.response?.status).toBe(503);
    expect(permission.auth).toBeUndefined();
  });

  it.each(["frozen", "removed", "pending_invite"])("denies lifecycle %s without policy work", async (state) => {
    mocks.loadAdminLifecycleAccessState.mockResolvedValue(state);
    expect((await requireAdminApiPermission("cms.events.manage")).response?.status).toBe(403);
    expect(mocks.checkAdminMFA).not.toHaveBeenCalled();
  });

  it("denies a user lacking permission without policy work", async () => {
    mocks.hasPermission.mockResolvedValue(false);
    expect((await requireAdminApiPermission("cms.events.manage")).response?.status).toBe(403);
    expect(mocks.checkAdminMFA).not.toHaveBeenCalled();
  });

});
