"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType } from "react";
import { useState, useEffect } from "react";
import {
  BarChart3,
  BookOpen,
  FolderKanban,
  KeyRound,
  LayoutDashboard,
  LifeBuoy,
  Menu,
  MessageSquareHeart,
  User,
  UserPen,
  X,
} from "lucide-react";
import { LogoutButton } from "@/components/auth/logout-button";
import { SiteBrand } from "@/components/layout/site-brand";
import { ProfileAvatar } from "@/components/profile/profile-avatar";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { formatMembershipIdForDisplay } from "@/lib/members/jnuits-id";
import { portalNavigation } from "@/lib/site";

// ── Nav structure ─────────────────────────────────────────────────────────────

type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ size?: number; className?: string }>;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const portalNavByHref = new Map(
  portalNavigation.map((item) => [item.href, item])
);

function createNavItem(
  href: string,
  fallbackLabel: string,
  icon: NavItem["icon"]
): NavItem {
  const item = portalNavByHref.get(href);
  return {
    href,
    label: item?.label ?? fallbackLabel,
    icon,
  };
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "My Workspace",
    items: [
      createNavItem("/portal", "Overview", LayoutDashboard),
      createNavItem("/portal/profile", "My Profile", User),
      createNavItem("/portal/profile/edit", "Edit Profile", UserPen),
    ],
  },
  {
    label: "Member Services",
    items: [
      createNavItem("/portal/blogs", "Draft Blogs", BookOpen),
      createNavItem("/portal/tickets", "Tickets", LifeBuoy),
      createNavItem("/portal/mentorship", "Mentorship", MessageSquareHeart),
      createNavItem("/portal/projects", "My Projects", FolderKanban),
      createNavItem("/portal/activity", "Activity", BarChart3),
      createNavItem("/portal/profile/change-password", "Password", KeyRound),
    ],
  },
];

// ── Helper: active state (exact for / paths, prefix for sub-routes) ───────────

function isActive(pathname: string, href: string): boolean {
  if (href === "/portal") return pathname === "/portal";
  return pathname.startsWith(href);
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface PortalShellProps {
  avatarUrl?: null | string;
  children: React.ReactNode;
  /** Member's display name for the sidebar identity card */
  memberName?: string | null;
  /** JNUITS ID for the sidebar identity card */
  jnuitsId?: string | null;
  portalRole?: null | string;
}

// ── Component ─────────────────────────────────────────────────────────────────

function getPortalRoleLabel(portalRole: null | string) {
  if (!portalRole) {
    return "Portal workspace";
  }

  return `${portalRole.replaceAll("_", " ")} workspace`;
}

export function PortalShell({
  avatarUrl = null,
  children,
  memberName,
  jnuitsId,
  portalRole = null,
}: PortalShellProps) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    if (sidebarOpen) setSidebarOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const displayJnuitsId = formatMembershipIdForDisplay(jnuitsId);

  return (
    <>
      {/* ── Mobile overlay ── */}
      <div
        className="portal-sidebar-overlay"
        data-open={sidebarOpen ? "true" : "false"}
        onClick={() => setSidebarOpen(false)}
        aria-hidden="true"
        style={{ display: sidebarOpen ? "block" : "none" }}
      />

      {/* ── Sidebar ── */}
      <aside
        className="portal-sidebar"
        data-open={sidebarOpen ? "true" : "false"}
        aria-label="Member portal navigation"
        style={{
          // On mobile hide off-screen; on desktop always visible
          transform: sidebarOpen ? "translateX(0)" : undefined,
        }}
      >
        {/* Header: brand + identity */}
        <div className="portal-sidebar__header">
          <div className="portal-sidebar__brand">
            <SiteBrand compact href="/portal" />
            <ThemeToggle />
          </div>

          {/* Identity card */}
          <div className="portal-id-card">
            <ProfileAvatar
              className="portal-id-card__profile-avatar"
              name={memberName}
              src={avatarUrl}
              size="sm"
            />
            <div className="portal-id-card__info">
              <p className="portal-id-card__name">{memberName ?? "Member"}</p>
              {displayJnuitsId && (
                <p className="portal-id-card__id">{displayJnuitsId}</p>
              )}
            </div>
          </div>
        </div>

        {/* Nav groups */}
        <nav className="portal-sidebar__nav">
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="portal-nav-group">
              <p className="portal-nav-group__label">{group.label}</p>
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = isActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="portal-nav-link"
                    data-active={active ? "true" : "false"}
                  >
                    <span className="portal-nav-link__icon" aria-hidden="true">
                      <Icon size={13} />
                    </span>
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="portal-sidebar__footer">
          <Link
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="portal-sidebar__view-site"
          >
            View public site ↗
          </Link>
        </div>
      </aside>

      {/* ── Content area (offset from fixed sidebar) ── */}
      <div className="portal-content">
        {/* Top-bar (mobile toggle + breadcrumb) */}
        <div className="portal-topbar">
          <button
            className="portal-sidebar-toggle"
            aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
            aria-expanded={sidebarOpen}
            onClick={() => setSidebarOpen((v) => !v)}
          >
            {sidebarOpen ? <X size={15} /> : <Menu size={15} />}
          </button>
          <div className="ml-auto flex items-center gap-2">
            <span className="portal-badge portal-badge--member">
              {getPortalRoleLabel(portalRole)}
            </span>
            <LogoutButton
              className="secondary-button inline-flex items-center gap-2 text-sm"
              redirectTo="/portal/login"
            />
          </div>
        </div>

        {/* Main scrollable area */}
        <main className="portal-main" id="portal-main-content">
          {children}
        </main>
      </div>
    </>
  );
}
