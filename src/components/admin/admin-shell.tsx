import {
  adminAccessItems,
  getAdminNavPermissionCodes,
  type AdminAccessItem,
} from "@/lib/admin/access";
import { hasPermission } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminNavClient } from "./admin-nav-client";
import { AdminMfaSuggestion } from "./admin-mfa-suggestion";

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * Only plain serializable data crosses the RSC→Client boundary.
 * Icons are defined inside the client component.
 */
export type AdminBadgeCounts = {
  pendingApps: number;
  pendingWorkplace: number;
  pendingProfile: number;
  pendingProfileRequests: number;
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
  const navigationItems = await getAllowedNavigationItems();
  const showPendingApps = navigationItems.some(
    (item) => item.badgeKey === "pendingApps"
  );
  const showPendingWorkplace = navigationItems.some(
    (item) => item.badgeKey === "pendingWorkplace"
  );
  const showPendingProfile = navigationItems.some(
    (item) => item.badgeKey === "pendingProfile"
  );
  const showPendingProfileRequests = navigationItems.some(
    (item) => item.badgeKey === "pendingProfileRequests"
  );

  const admin = createAdminClient();
  const [
    { count: pendingApps },
    { count: pendingWorkplace },
    { count: pendingProfile },
    { count: pendingProfileRequests },
  ] = await Promise.all([
    showPendingApps
      ? admin
          .from("membership_applications")
          .select("*", { count: "exact", head: true })
          .eq("status", "pending")
      : Promise.resolve({ count: 0 }),
    showPendingWorkplace
      ? admin
          .from("profile_update_requests")
          .select("*", { count: "exact", head: true })
          .eq("request_type", "workplace_update")
          .eq("status", "pending")
      : Promise.resolve({ count: 0 }),
    showPendingProfile
      ? admin
          .from("profile_update_requests")
          .select("*", { count: "exact", head: true })
          .eq("request_type", "profile_change")
          .eq("status", "pending")
      : Promise.resolve({ count: 0 }),
    showPendingProfileRequests
      ? admin
          .from("profile_update_requests")
          .select("*", { count: "exact", head: true })
          .in("request_type", [
            "workplace_update",
            "profile_change",
            "email_change",
            "jnuits_id_change",
          ])
          .eq("status", "pending")
      : Promise.resolve({ count: 0 }),
  ]);

  const badgeCounts: AdminBadgeCounts = {
    pendingApps: pendingApps ?? 0,
    pendingWorkplace: pendingWorkplace ?? 0,
    pendingProfile: pendingProfile ?? 0,
    pendingProfileRequests: pendingProfileRequests ?? 0,
  };

  return (
    <AdminNavClient
      badgeCounts={badgeCounts}
      navigationItems={navigationItems}
    >
      <AdminMfaSuggestion />
      {children}
    </AdminNavClient>
  );
}
