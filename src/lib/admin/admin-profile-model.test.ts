import { describe, expect, it } from "vitest";

import type { AdminAccountCapabilities } from "@/lib/admin/admin-account-policy";
import {
  buildAdminProfileStats,
  combineAdminProfileActivities,
  filterAdminProfiles,
  parseAdminProfileFilters,
  type AdminProfileDirectoryProfile,
  type AdminProfileFilters,
} from "@/lib/admin/admin-profile-model";

const defaultCapabilities: AdminAccountCapabilities = {
  allowedInviteRoles: [],
  allowedRoleTargets: [],
  canChangeRole: false,
  canEditProfile: true,
  canFreeze: false,
  canInvite: false,
  canRemove: false,
  canUnfreeze: false,
};

function filters(
  overrides: Partial<AdminProfileFilters> = {},
): AdminProfileFilters {
  return {
    profile: "",
    q: "",
    role: "",
    status: "",
    tab: "directory",
    ...overrides,
  };
}

function profile(
  overrides: Partial<AdminProfileDirectoryProfile>,
): AdminProfileDirectoryProfile {
  return {
    adminCode: "JNUITS-ADMIN-0001",
    avatarSecureUrl: null,
    canEdit: true,
    capabilities: defaultCapabilities,
    createdAt: "2026-01-01T00:00:00.000Z",
    displayName: "Default Admin",
    email: "admin@example.com",
    id: "profile-1",
    isActive: true,
    isSuperAdmin: false,
    lifecycleLabel: "Active",
    lifecycleStatus: "active",
    linkedMember: null,
    linkedMemberId: null,
    primaryRole: { code: "admin", displayName: "Admin" },
    roles: [{ code: "admin", displayName: "Admin" }],
    statusReason: null,
    statusUpdatedAt: null,
    statusUpdatedByUserId: null,
    title: "Admin",
    updatedAt: "2026-01-02T00:00:00.000Z",
    userId: "user-1",
    ...overrides,
  };
}

describe("admin profile model", () => {
  it("parses and sanitizes supported filters", () => {
    expect(
      parseAdminProfileFilters({
        profile: " profile-1 ",
        q: " Redwan() ",
        role: "content_admin",
        status: "deleted",
        tab: "self",
      }),
    ).toEqual({
      profile: "profile-1",
      q: "Redwan",
      role: "content_admin",
      status: "",
      tab: "self",
    });

    expect(parseAdminProfileFilters({ status: "inactive" }).status).toBe(
      "inactive",
    );
    expect(parseAdminProfileFilters({ tab: "unknown" }).tab).toBe(
      "directory",
    );
  });

  it("filters by search, role, status, and linked member metadata", () => {
    const profiles = [
      profile({
        adminCode: "JNUITS-ADMIN-0002",
        displayName: "Redwan Content Admin",
        email: "content@example.com",
        id: "content-profile",
        linkedMember: {
          email: "member@example.com",
          fullName: "Linked Member",
          id: "member-1",
          jnuitsId: "JnUITS-2024-001",
          memberType: "member",
        },
        primaryRole: { code: "content_admin", displayName: "Content Admin" },
        roles: [{ code: "content_admin", displayName: "Content Admin" }],
      }),
      profile({
        displayName: "Inactive Admin",
        id: "inactive-profile",
        isActive: false,
        lifecycleLabel: "Removed",
        lifecycleStatus: "removed",
      }),
    ];

    expect(
      filterAdminProfiles(
        profiles,
        filters({ q: "2024-001" }),
      ),
    ).toHaveLength(1);
    expect(
      filterAdminProfiles(
        profiles,
        filters({ role: "content_admin" }),
      ),
    ).toHaveLength(1);
    expect(
      filterAdminProfiles(
        profiles,
        filters({ status: "inactive" }),
      ),
    ).toHaveLength(1);
    expect(
      filterAdminProfiles(
        profiles,
        filters({ q: "missing" }),
      ),
    ).toHaveLength(0);
  });

  it("builds visible directory stats", () => {
    const stats = buildAdminProfileStats([
      profile({
        id: "super",
        isSuperAdmin: true,
        primaryRole: { code: "super_admin", displayName: "Super Admin" },
        roles: [{ code: "super_admin", displayName: "Super Admin" }],
      }),
      profile({
        id: "content",
        primaryRole: { code: "content_admin", displayName: "Content Admin" },
        roles: [{ code: "content_admin", displayName: "Content Admin" }],
      }),
      profile({
        id: "inactive",
        isActive: false,
        lifecycleLabel: "Removed",
        lifecycleStatus: "removed",
      }),
    ]);

    expect(stats).toEqual({
      active: 2,
      admins: 1,
      contentAdmins: 1,
      frozen: 0,
      inactive: 1,
      pendingInvites: 0,
      removed: 1,
      superAdmins: 1,
      total: 3,
    });
  });

  it("combines recent activity without preserving raw metadata payloads", () => {
    const activities = combineAdminProfileActivities(
      [
        {
          action: "admin_profile.updated",
          actor_user_id: "actor-1",
          created_at: "2026-01-02T00:00:00.000Z",
          entity_id: "profile-1",
          entity_type: "admin_profile",
          id: "audit-1",
        },
      ],
      [
        {
          actor_user_id: "actor-2",
          created_at: "2026-01-03T00:00:00.000Z",
          event_type: "admin_profile.updated",
          id: "security-1",
          severity: "info",
          target_user_id: "user-1",
        },
      ],
    );

    expect(activities).toHaveLength(2);
    expect(activities[0]).toMatchObject({ id: "security-1", kind: "security" });
    expect(JSON.stringify(activities)).not.toContain("payload");
    expect(JSON.stringify(activities)).not.toContain("metadata");
  });
});
