import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  lifecycle: vi.fn(),
  redirect: vi.fn(),
  checkAdminMFA: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: (path: string) => mocks.redirect(path),
}));

vi.mock("@/lib/auth/admin-lifecycle", () => ({
  loadAdminLifecycleAccessState: (userId: string) => mocks.lifecycle(userId),
}));

vi.mock("@/lib/auth/mfa", () => ({
  checkAdminMFA: mocks.checkAdminMFA,
}));

vi.mock("@/lib/supabase/flexible", () => ({
  asFlexibleClient: <T>(client: T) => client,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => mocks.createClient(),
}));

import { requireAdminPermission, requireAdminUser } from "@/lib/auth/session";

function createAuthenticatedClient() {
  return {
    auth: {
      getClaims: vi.fn().mockResolvedValue({
        data: {
          claims: {
            jnuits_admin_role: "admin",
            jnuits_member_id: "member-1",
            jnuits_portal_role: "member",
            jnuits_role_version: 1,
          },
        },
      }),
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: {
            email: "operator@example.com",
            id: "admin-user-1",
          },
        },
      }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    }),
    rpc: vi.fn().mockResolvedValue({ data: true, error: null }),
  };
}

describe("requireAdminUser lifecycle enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createClient.mockResolvedValue(createAuthenticatedClient());
    mocks.redirect.mockImplementation((path: string) => {
      throw new Error(`redirect:${path}`);
    });
  });

  it("allows an active admin identity", async () => {
    mocks.lifecycle.mockResolvedValue("active");

    await expect(requireAdminUser()).resolves.toMatchObject({
      user: { id: "admin-user-1" },
    });
    expect(mocks.lifecycle).toHaveBeenCalledWith("admin-user-1");
  });

  it("redirects frozen admins before protected admin work can continue", async () => {
    mocks.lifecycle.mockResolvedValue("frozen");

    await expect(requireAdminUser()).rejects.toThrow(
      "redirect:/admin/access-pending?access=frozen",
    );
  });

  it("allows privileged handler work only after a fresh successful retry of the permission read", async () => {
    mocks.lifecycle.mockResolvedValue("active");
    const client = createAuthenticatedClient();
    client.rpc.mockResolvedValueOnce({ data: null, error: { message: "Gateway unavailable" }, status: 502 }).mockResolvedValueOnce({ data: true, error: null, status: 200 });
    mocks.createClient.mockResolvedValue(client);
    await expect(requireAdminPermission("admin.membership.manage")).resolves.toMatchObject({ user: { id: "admin-user-1" } });
    expect(client.rpc).toHaveBeenCalledTimes(2);
  });

  it("denies before privileged handler work when both permission reads fail", async () => {
    mocks.lifecycle.mockResolvedValue("active");
    const client = createAuthenticatedClient();
    client.rpc.mockResolvedValue({ data: null, error: { message: "Gateway unavailable" }, status: 502 });
    mocks.createClient.mockResolvedValue(client);
    let handlerRan = false;
    await expect(requireAdminPermission("admin.membership.manage").then(() => { handlerRan = true; })).rejects.toThrow("redirect:/admin/dashboard");
    expect(handlerRan).toBe(false);
    expect(client.rpc).toHaveBeenCalledTimes(2);
  });

  it("requires actual MFA at a protected action even with workspace enforcement off", async () => {
    mocks.lifecycle.mockResolvedValue("active");
    mocks.checkAdminMFA.mockResolvedValue({ ok: true, currentLevel: "aal1", nextLevel: "aal2", enforced: false, redirectTo: null });
    await expect(requireAdminPermission("admin.membership.manage", { requireAal2: true })).rejects.toThrow("redirect:/admin/mfa/challenge");
  });
});
