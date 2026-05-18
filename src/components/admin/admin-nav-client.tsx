"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType } from "react";
import { useState, useEffect } from "react";
import {
  BarChart2,
  BellRing,
  BookOpen,
  ClipboardList,
  FileCode2,
  FileText,
  FolderOpen,
  ImageIcon,
  LayoutDashboard,
  Mail,
  Menu,
  Phone,
  RefreshCcw,
  ScrollText,
  ShieldCheck,
  UserCog,
  Users,
  UserCheck,
  X,
} from "lucide-react";
import { SiteBrand } from "@/components/layout/site-brand";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { adminNavigation } from "@/lib/site";
import type { AdminBadgeCounts } from "./admin-shell";

// ── Nav structure (defined client-side to avoid RSC serialization issues) ─────

type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  badge?: number;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const adminNavByHref = new Map(
  adminNavigation.map((item) => [item.href, item])
);

function createNavItem(
  href: string,
  fallbackLabel: string,
  icon: NavItem["icon"],
  badge?: number
): NavItem {
  const item = adminNavByHref.get(href);
  return {
    href,
    label: item?.label ?? fallbackLabel,
    icon,
    badge,
  };
}

function buildNavGroups(
  counts: AdminBadgeCounts,
  adminRole: null | string
): NavGroup[] {
  const groups: NavGroup[] = [
    {
      label: "Overview",
      items: [createNavItem("/admin", "Dashboard", LayoutDashboard)],
    },
    {
      label: "Content",
      items: [
        createNavItem("/admin/content", "Content Hub", FolderOpen),
        createNavItem("/admin/content/about", "About page", FileText),
        createNavItem("/admin/content/slider", "Slider images", ImageIcon),
        createNavItem("/admin/content/media", "Media", ImageIcon),
        createNavItem("/admin/content/blogs", "Blogs", FileText),
        createNavItem("/admin/content/notices", "Notices", ScrollText),
        createNavItem("/admin/content/events", "Events", BookOpen),
        createNavItem("/admin/content/gallery", "Gallery", ImageIcon),
        createNavItem("/admin/content/projects", "Projects", FileCode2),
        createNavItem("/admin/content/pages", "Page Singletons", ScrollText),
      ],
    },
  ];

  if (adminRole !== "content_admin") {
    groups.splice(1, 0, {
      label: "Membership",
      items: [
        createNavItem(
          "/admin/applications",
          "Applications",
          UserCheck,
          counts.pendingApps
        ),
        createNavItem("/admin/invitations", "Invitations", Mail),
        createNavItem(
          "/admin/workplace",
          "Workplace",
          ClipboardList,
          counts.pendingWorkplace
        ),
        createNavItem(
          "/admin/profile-changes",
          "Profile Changes",
          Users,
          counts.pendingProfile
        ),
        createNavItem("/admin/membership", "Membership DB", ShieldCheck),
        createNavItem("/admin/bulk-operations", "Bulk Operations", ClipboardList),
      ],
    });

    groups.push({
      label: "Organization",
      items: [
        createNavItem("/admin/committee", "Committee", ShieldCheck),
        createNavItem("/admin/reports", "Reports", BarChart2),
        createNavItem("/admin/reconcile", "Reconcile", RefreshCcw),
        createNavItem("/admin/certificates", "Certificates", ScrollText),
        createNavItem("/admin/decisions", "Decisions Log", ClipboardList),
      ],
    });

    groups.push({
      label: "Settings",
      items: [
        createNavItem("/admin/admin-profiles", "Admin Profiles", UserCog),
        createNavItem("/admin/settings/profile", "Profile Settings", UserCog),
        createNavItem(
          "/admin/settings/security",
          "Security Settings",
          ShieldCheck
        ),
        createNavItem(
          "/admin/settings/notifications",
          "Notification Settings",
          BellRing
        ),
        createNavItem(
          "/admin/settings/contact",
          "Contact Settings",
          Phone
        ),
      ],
    });
  }

  return groups;
}


// ── Component ──────────────────────────────────────────────────────────────────

interface Props {
  adminRole?: null | string;
  badgeCounts: AdminBadgeCounts;
}

export function AdminNavClient({ adminRole = null, badgeCounts }: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close sidebar when route changes (mobile) ─ gated so it doesn't cascade
  useEffect(() => {
    if (open) setOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const groups = buildNavGroups(badgeCounts, adminRole);

  function isActive(href: string): boolean {
    // "/admin" should only match exactly (not every admin sub-route)
    if (href === "/admin") return pathname === "/admin";
    // all other routes: match if pathname starts with the href
    return pathname.startsWith(href);
  }


  return (
    <>
      {/* Backdrop overlay — closes sidebar on mobile */}
      <div
        className="admin-sidebar-overlay"
        data-open={open ? "true" : "false"}
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />

      {/* ── Sidebar ── */}
      <aside
        className="admin-sidebar"
        data-open={open ? "true" : "false"}
        aria-label="Admin navigation"
      >
        {/* Brand */}
        <div className="admin-sidebar__brand">
          <SiteBrand compact href="/admin" />
          <span className="admin-sidebar__brand-badge">Admin</span>
        </div>

        {/* Nav groups */}
        <nav className="admin-sidebar__nav">
          {groups.map((group) => (
            <div key={group.label} className="admin-nav-group">
              <p className="admin-nav-group__label">{group.label}</p>
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="admin-nav-link"
                    data-active={active ? "true" : "false"}
                  >
                    <span className="admin-nav-link__icon">
                      <Icon size={15} />
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>{item.label}</span>
                    {item.badge != null && item.badge > 0 ? (
                      <span className="admin-nav-link__badge">
                        {item.badge > 99 ? "99+" : item.badge}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="admin-sidebar__footer">
          <ThemeToggle />
          <Link
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="admin-sidebar__view-site"
          >
            View site ↗
          </Link>
        </div>
      </aside>

      {/* ── Mobile hamburger (CSS-positioned into topbar) ── */}
      <button
        id="admin-sidebar-toggle"
        className="admin-sidebar-toggle"
        aria-label={open ? "Close sidebar" : "Open sidebar"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <X size={16} /> : <Menu size={16} />}
      </button>
    </>
  );
}
