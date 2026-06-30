import { describe, expect, it } from "vitest";
import { resolveAdminAccountCapabilities } from "./admin-account-policy";

describe("admin account lifecycle capability policy", () => {
  it("allows super admins to invite and manage lower admin roles", () => {
    const capabilities = resolveAdminAccountCapabilities({
      actorRole: "super_admin",
      actorUserId: "super-user",
      hasManageAdminRoles: true,
      targetLifecycleStatus: "active",
      targetRole: "admin",
      targetUserId: "admin-user",
    });

    expect(capabilities.allowedInviteRoles).toEqual([
      "super_admin",
      "admin",
      "content_admin",
    ]);
    expect(capabilities.canChangeRole).toBe(true);
    expect(capabilities.canFreeze).toBe(true);
    expect(capabilities.canRemove).toBe(true);
  });

  it("limits normal admins to content-admin management", () => {
    expect(
      resolveAdminAccountCapabilities({
        actorRole: "admin",
        actorUserId: "admin-user",
        hasManageAdminRoles: true,
        targetLifecycleStatus: "active",
        targetRole: "content_admin",
        targetUserId: "content-user",
      })
    ).toMatchObject({
      allowedInviteRoles: ["content_admin"],
      canEditProfile: true,
      canFreeze: true,
      canInvite: true,
      canRemove: true,
    });

    expect(
      resolveAdminAccountCapabilities({
        actorRole: "admin",
        actorUserId: "admin-user",
        hasManageAdminRoles: true,
        targetLifecycleStatus: "active",
        targetRole: "admin",
        targetUserId: "peer-admin-user",
      })
    ).toMatchObject({
      canChangeRole: false,
      canFreeze: false,
      canRemove: false,
    });
  });

  it("keeps content admins limited to self-profile edits", () => {
    const own = resolveAdminAccountCapabilities({
      actorRole: "content_admin",
      actorUserId: "content-user",
      hasManageAdminRoles: false,
      targetLifecycleStatus: "active",
      targetRole: "content_admin",
      targetUserId: "content-user",
    });
    const other = resolveAdminAccountCapabilities({
      actorRole: "content_admin",
      actorUserId: "content-user",
      hasManageAdminRoles: false,
      targetLifecycleStatus: "active",
      targetRole: "content_admin",
      targetUserId: "other-content-user",
    });

    expect(own.canEditProfile).toBe(true);
    expect(own.canInvite).toBe(false);
    expect(other.canEditProfile).toBe(false);
    expect(other.canFreeze).toBe(false);
  });
});