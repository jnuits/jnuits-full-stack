"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import {
  BarChart3,
  BookOpen,
  FolderKanban,
  KeyRound,
  LayoutDashboard,
  Menu,
  User,
  UserPen,
  X,
} from "lucide-react";
import { SiteBrand } from "@/components/layout/site-brand";
import { ThemeToggle } from "@/components/theme/theme-toggle";

// ── Nav structure ─────────────────────────────────────────────────────────────

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    label: "My Workspace",
    items: [
      { href: "/portal", label: "Overview", icon: LayoutDashboard },
      { href: "/profile", label: "My Profile", icon: User },
      { href: "/profile/edit", label: "Edit Profile", icon: UserPen },
    ],
  },
  {
    label: "Member Services",
    items: [
      { href: "/portal/blogs", label: "Draft Blogs", icon: BookOpen },
      { href: "/portal/projects", label: "My Projects", icon: FolderKanban },
      { href: "/portal/activity", label: "Activity", icon: BarChart3 },
      { href: "/profile/change-password", label: "Password", icon: KeyRound },
    ],
  },
];

// ── Helper: active state (exact for / paths, prefix for sub-routes) ───────────

function isActive(pathname: string, href: string): boolean {
  if (href === "/portal") return pathname === "/portal";
  if (href === "/profile") return pathname === "/profile";
  return pathname.startsWith(href);
}

// Helper: initials from a name string
function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface PortalShellProps {
  children: React.ReactNode;
  /** Member's display name for the sidebar identity card */
  memberName?: string | null;
  /** JNUITS ID for the sidebar identity card */
  jnuitsId?: string | null;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function PortalShell({ children, memberName, jnuitsId }: PortalShellProps) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    if (sidebarOpen) setSidebarOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const initials = memberName ? getInitials(memberName) : "M";

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
            <div className="portal-id-card__avatar" aria-hidden="true">
              {initials}
            </div>
            <div className="portal-id-card__info">
              <p className="portal-id-card__name">{memberName ?? "Member"}</p>
              {jnuitsId && (
                <p className="portal-id-card__id">{jnuitsId}</p>
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
          <span className="portal-badge portal-badge--member">Member workspace</span>
        </div>

        {/* Main scrollable area */}
        <main className="portal-main" id="portal-main-content">
          {children}
        </main>
      </div>
    </>
  );
}
