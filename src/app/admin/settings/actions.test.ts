import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  from: vi.fn(),
  revalidatePath: vi.fn(),
  requireAdminPermission: vi.fn(),
  upsert: vi.fn(),
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

vi.mock("@/lib/supabase/flexible", () => ({
  asFlexibleClient: <T>(client: T) => client,
}));

import { saveAdminNotificationSettings } from "@/app/admin/settings/actions";

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
