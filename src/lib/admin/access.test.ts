import { describe, expect, it } from "vitest";
import { getAdminRouteAccess } from "./access";

describe("admin protected read routing", () => {
  it.each([
    ["/admin/settings/security", "admin.security.read", "admin.security.read"],
    ["/admin/system-health", "admin.security.read", "admin.system_health.read"],
    ["/admin/retention", "admin.retention.manage", "admin.retention.read"],
  ])("preserves permission and named verification for %s", (path, permission, operation) => {
    expect(getAdminRouteAccess(`${path}?fixture=1`)).toMatchObject({
      requiredPermission: permission,
      requireAal2: false,
      readOperation: operation,
    });
  });

  it("does not add protected-read scope to ordinary membership pages", () => {
    expect(getAdminRouteAccess("/admin/membership")).toMatchObject({
      requiredPermission: "admin.membership.manage",
      requireAal2: false,
    });
    expect(getAdminRouteAccess("/admin/membership")).not.toHaveProperty("readOperation");
  });
});


describe("admin profile route separation", () => {
  it("permits the canonical own profile without settings/account-management permission", () => {
    expect(getAdminRouteAccess("/admin/settings/profile").requiredPermission).toBeNull();
  });
  it("keeps legacy self bookmarks self-service while protecting management views", () => {
    expect(getAdminRouteAccess("/admin/admin-profiles?tab=self&profile=me").requiredPermission).toBeNull();
    expect(getAdminRouteAccess("/admin/admin-profiles?tab=directory").requiredPermission).toBe("admin.admin_profiles.manage");
    expect(getAdminRouteAccess("/admin/admin-profiles?tab=self&tab=access").requiredPermission).toBe("admin.admin_profiles.manage");
  });
});
