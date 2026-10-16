import {
  adminAccessItems,
  getAdminNavPermissionCodes,
  type AdminAccessItem,
} from "@/lib/admin/access";
import { hasPermission, requireAdminUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { IDENTITY_PROFILE_REQUEST_TYPES } from "@/lib/admin/profile-request-types";
import { AdminNavClient } from "./admin-nav-client";
import { AdminMfaSuggestion } from "./admin-mfa-suggestion";
import { recordCurrentAdminWorkspaceAccess } from "@/lib/admin/activity/capture-server";
import { loadOwnAdminNotices } from "@/lib/admin/notifications/store";

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * Only plain serializable data crosses the RSC→Client boundary.
 * Icons are defined inside the client component.
 */
export type AdminBadgeCounts = {
  pendingApps: number | null;
  pendingProfileRequests: number | null;
};

export type AdminShellNavigationItem = Pick<
  AdminAccessItem,
  "badgeKey" | "group" | "href" | "iconKey" | "label"
>;

async function getAllowedNavigationItems(): Promise<AdminShellNavigationItem[]> {
  const permissionCodes = getAdminNavPermissionCodes();
  const permissionResults = await Promise.all(
    permissionCodes.map(async (permission) => [
      permission,
      await hasPermission(permission),
    ] as const)
  );
  const allowedPermissions = new Set(
    permissionResults
      .filter(([, allowed]) => allowed)
      .map(([permission]) => permission)
  );

  return adminAccessItems
    .filter(
      (item) =>
        !item.requiredPermission || allowedPermissions.has(item.requiredPermission)
    )
    .map(({ badgeKey, group, href, iconKey, label }) => ({
      badgeKey,
      group,
      href,
      iconKey,
      label,
    }));
}

// ── Server component ──────────────────────────────────────────────────────────

export async function AdminShell({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdminUser({ fallbackPath: "/admin" });
  await recordCurrentAdminWorkspaceAccess();
  const navigationItems = await getAllowedNavigationItems();
  const showPendingApps = navigationItems.some(item => item.badgeKey === "pendingApps");
  const showPendingProfileRequests = navigationItems.some(item => item.badgeKey === "pendingProfileRequests");
  const admin = createAdminClient();
  const [appsResult, profilesResult] = await Promise.all([
    showPendingApps
      ? admin.from("membership_applications").select("id", { count: "exact", head: true }).eq("status", "pending")
      : Promise.resolve({ count: 0, error: null }),
    showPendingProfileRequests
      ? admin.from("profile_update_requests").select("id", { count: "exact", head: true }).in("request_type", IDENTITY_PROFILE_REQUEST_TYPES).eq("status", "pending")
      : Promise.resolve({ count: 0, error: null }),
  ]);
  const badgeCounts: AdminBadgeCounts = {
    pendingApps: appsResult.error ? null : appsResult.count,
    pendingProfileRequests: profilesResult.error ? null : profilesResult.count,
  };
  const queueCountsUnavailable = (showPendingApps && badgeCounts.pendingApps === null) || (showPendingProfileRequests && badgeCounts.pendingProfileRequests === null);
  let unreadNoticesCount: number | null = null;
  if (navigationItems.some(item => item.href === "/admin/notifications")) {
    try { unreadNoticesCount = (await loadOwnAdminNotices({ pageSize: 1 })).unreadCount; } catch { /* Unknown must not be reported as zero. */ }
  }
  return (
    <AdminNavClient badgeCounts={badgeCounts} navigationItems={navigationItems} queueCountsUnavailable={queueCountsUnavailable} unreadNoticesCount={unreadNoticesCount}>
      <AdminMfaSuggestion />
      {children}
    </AdminNavClient>
  );
}
