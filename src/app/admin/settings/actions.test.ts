import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  from: vi.fn(),
  revalidatePath: vi.fn(),
  requireAdminPermission: vi.fn(),
  upsert: vi.fn(),
  authorize: vi.fn(), rpc: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => mocks.revalidatePath(...args),
}));

vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`redirect:${path}`);
  },
}));

vi.mock("@/lib/auth/session", () => ({
  requireAdminPermission: (...args: unknown[]) =>
    mocks.requireAdminPermission(...args),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => mocks.createAdminClient(),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ rpc: mocks.rpc }) }));
vi.mock("@/lib/auth/admin-verification/guard", () => ({ authorizeAdminOperation: mocks.authorize, adminVerificationFailureMessage: () => "Verify this operation." }));

vi.mock("@/lib/supabase/flexible", () => ({
  asFlexibleClient: <T>(client: T) => client,
}));

import { saveAdminNotificationSettings, saveAdminSecuritySettings } from "@/app/admin/settings/actions";

describe("saveAdminNotificationSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdminPermission.mockResolvedValue({
      user: { id: "operator-1", memberId: null },
    });
    mocks.upsert.mockResolvedValue({ error: null });
    mocks.from.mockReturnValue({ upsert: mocks.upsert });
    mocks.createAdminClient.mockReturnValue({ from: mocks.from });
  });

  it("uses the server-only client for the authenticated operator's own preference row", async () => {
    const formData = new FormData();
    formData.set("notificationEmailOptIn", "true");
    formData.set("ticketDigestOptIn", "true");

    await expect(saveAdminNotificationSettings(formData)).rejects.toThrow(
      "redirect:/admin/settings/notifications?message=settings-saved"
    );

    expect(mocks.from).toHaveBeenCalledWith("portal_user_settings");
    expect(mocks.upsert).toHaveBeenCalledWith(
      {
        member_id: null,
        notification_email_opt_in: true,
        ticket_digest_opt_in: true,
        user_id: "operator-1",
      },
      { onConflict: "user_id" }
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith(
      "/admin/settings/notifications"
    );
  });
  it("persists explicit opt-outs when optional checkboxes are omitted", async () => {
    await expect(saveAdminNotificationSettings(new FormData())).rejects.toThrow(
      "redirect:/admin/settings/notifications?message=settings-saved"
    );

    expect(mocks.upsert).toHaveBeenCalledWith(
      {
        member_id: null,
        notification_email_opt_in: false,
        ticket_digest_opt_in: false,
        user_id: "operator-1",
      },
      { onConflict: "user_id" }
    );
  });
});

describe("verified admin security settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdminPermission.mockResolvedValue({ user: { id: "operator-1", adminRole: "super_admin" } });
    mocks.authorize.mockResolvedValue({ ok: true, value: { auth: { user: { id: "operator-1", adminRole: "super_admin" } } } });
    mocks.rpc.mockResolvedValue({ data: { ok: true, value: null }, error: null });
    mocks.from.mockReturnValue({ update: () => ({ eq: async () => ({ error: null }) }) });
  });
  it("does not write settings without exact-operation verification", async () => {
    mocks.authorize.mockResolvedValue({ ok: false, code: "verification_required" });
    await expect(saveAdminSecuritySettings(new FormData())).rejects.toThrow(/error=.*verification_required/);
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("uses the authenticated atomic RPC rather than a parallel service write", async () => {
    const form = new FormData(); form.set("adminTotpEnforced", "true"); form.set("verificationProof", "bound-proof");
    await expect(saveAdminSecuritySettings(form)).rejects.toThrow("redirect:/admin/settings/security?message=security-settings-saved");
    expect(mocks.authorize).toHaveBeenCalledWith({ operation: "admin.security.update", payload: { adminTotpEnforced: true } }, "bound-proof");
    expect(mocks.rpc).toHaveBeenCalledWith("update_admin_security_verified", { p_payload: { adminTotpEnforced: true }, p_proof: "bound-proof" });
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("preserves the super-admin-only disable restriction", async () => {
    mocks.authorize.mockResolvedValue({ ok: true, value: { auth: { user: { id: "operator-1", adminRole: "admin" } } } });
    await expect(saveAdminSecuritySettings(new FormData())).rejects.toThrow(/super-admin-required/);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("does not report RPC denial as a settings save", async () => {
    mocks.rpc.mockResolvedValue({ data: { ok: false, code: "verification_invalid" }, error: null });
    await expect(saveAdminSecuritySettings(new FormData())).rejects.toThrow(/error=/);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
