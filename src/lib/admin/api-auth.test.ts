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
    mocks.checkAdminMFA.mockResolvedValue({ ok: true });
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
});
