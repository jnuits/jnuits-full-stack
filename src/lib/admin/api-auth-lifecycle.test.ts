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

describe("admin API lifecycle boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAuthContext.mockResolvedValue({
      roles: ["admin"],
      user: { id: "11111111-1111-4111-8111-111111111111" },
    });
    mocks.hasAdminRole.mockReturnValue(true);
    mocks.hasPermission.mockResolvedValue(true);
    mocks.loadAdminLifecycleAccessState.mockResolvedValue("active");
  });

  it("blocks authenticated users without an admin role", async () => {
    mocks.hasAdminRole.mockReturnValue(false);

    const result = await requireAdminApiPermission("admin.dashboard.read");

    expect(result.response?.status).toBe(403);
    expect(mocks.loadAdminLifecycleAccessState).not.toHaveBeenCalled();
    expect(mocks.hasPermission).not.toHaveBeenCalled();
  });

  it("blocks inactive admins before checking their permissions", async () => {
    mocks.loadAdminLifecycleAccessState.mockResolvedValue("suspended");

    const result = await requireAdminApiPermission("admin.dashboard.read");

    expect(result.response?.status).toBe(403);
    expect(mocks.loadAdminLifecycleAccessState).toHaveBeenCalledWith(
      "11111111-1111-4111-8111-111111111111"
    );
    expect(mocks.hasPermission).not.toHaveBeenCalled();
  });

  it("allows active admins with the requested permission", async () => {
    const result = await requireAdminApiPermission("admin.dashboard.read");

    expect(result).toMatchObject({
      auth: { user: { id: "11111111-1111-4111-8111-111111111111" } },
    });
    expect(mocks.hasPermission).toHaveBeenCalledWith("admin.dashboard.read");
  });
});
