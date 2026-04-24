import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { LogoutButton } from "@/components/auth/logout-button";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminNavClient } from "./admin-nav-client";

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * Only plain serializable data crosses the RSC→Client boundary.
 * Icons are defined inside the client component.
 */
export type AdminBadgeCounts = {
  pendingApps: number;
  pendingWorkplace: number;
  pendingProfile: number;
};

// ── Server component ──────────────────────────────────────────────────────────

export async function AdminShell({
  adminRole = null,
  children,
}: {
  adminRole?: null | string;
  children: React.ReactNode;
}) {
  // Fetch badge counts — only plain numbers cross the RSC boundary
  const admin = createAdminClient();
  const [
    { count: pendingApps },
    { count: pendingWorkplace },
    { count: pendingProfile },
  ] = await Promise.all([
    admin
      .from("membership_applications")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending"),
    admin
      .from("profile_update_requests")
      .select("*", { count: "exact", head: true })
      .eq("request_type", "workplace_update")
      .eq("status", "pending"),
    admin
      .from("profile_update_requests")
      .select("*", { count: "exact", head: true })
      .eq("request_type", "profile_change")
      .eq("status", "pending"),
  ]);

  const badgeCounts: AdminBadgeCounts = {
    pendingApps: pendingApps ?? 0,
    pendingWorkplace: pendingWorkplace ?? 0,
    pendingProfile: pendingProfile ?? 0,
  };

  return (
    <div className="admin-layout">
      {/* Client component renders sidebar (with icons defined client-side) */}
      <AdminNavClient adminRole={adminRole} badgeCounts={badgeCounts} />

      {/* Right-side page wrapper */}
      <div className="admin-page-wrap">
        {/* Sticky topbar */}
        <header className="admin-topbar">
          <div className="admin-topbar__left">
            {/* Mobile toggle is rendered by AdminNavClient and CSS-positioned here */}
            <span className="admin-topbar__title">
              JnUITS — Operator Workspace
            </span>
          </div>
          <div className="admin-topbar__right">
            <Link
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className="admin-sidebar__view-site"
              style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}
            >
              View site <ExternalLink size={11} />
            </Link>
            <LogoutButton
              className="secondary-button inline-flex items-center gap-2 text-sm"
              redirectTo="/admin/login"
            />
            <ThemeToggle />
          </div>
        </header>

        {/* Page content */}
        <main className="admin-content">{children}</main>
      </div>
    </div>
  );
}
