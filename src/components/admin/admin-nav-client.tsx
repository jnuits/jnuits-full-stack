"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import {
  BarChart2,
  BookOpen,
  ClipboardList,
  FileCode2,
  FileText,
  FolderOpen,
  ImageIcon,
  LayoutDashboard,
  Mail,
  Menu,
  RefreshCcw,
  ScrollText,
  ShieldCheck,
  Users,
  UserCheck,
  X,
} from "lucide-react";
import { SiteBrand } from "@/components/layout/site-brand";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import type { AdminBadgeCounts } from "./admin-shell";

// ── Nav structure (defined client-side to avoid RSC serialization issues) ─────

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  badge?: number;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

function buildNavGroups(counts: AdminBadgeCounts): NavGroup[] {
  return [
    {
      label: "Overview",
      items: [
        { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
      ],
    },
    {
      label: "Membership",
      items: [
        {
          href: "/admin/applications",
          label: "Applications",
          icon: UserCheck,
          badge: counts.pendingApps,
        },
        {
          href: "/admin/invitations",
          label: "Invitations",
          icon: Mail,
        },
        {
          href: "/admin/workplace",
          label: "Workplace",
          icon: ClipboardList,
          badge: counts.pendingWorkplace,
        },
        {
          href: "/admin/profile-changes",
          label: "Profile Changes",
          icon: Users,
          badge: counts.pendingProfile,
        },
        {
          href: "/admin/membership",
          label: "Membership DB",
          icon: ShieldCheck,
        },
      ],
    },
    {
      label: "Content",
      items: [
        { href: "/admin/content", label: "Content Hub", icon: FolderOpen },
        { href: "/admin/content/media", label: "Media", icon: ImageIcon },
        { href: "/admin/content/blogs", label: "Blogs", icon: FileText },
        { href: "/admin/content/events", label: "Events", icon: BookOpen },
        { href: "/admin/content/gallery", label: "Gallery", icon: ImageIcon },
        { href: "/admin/content/projects", label: "Projects", icon: FileCode2 },
        { href: "/admin/content/pages", label: "Page Singletons", icon: ScrollText },
      ],
    },
    {
      label: "Organization",
      items: [
        { href: "/admin/committee", label: "Committee", icon: ShieldCheck },
        { href: "/admin/reports", label: "Reports", icon: BarChart2 },
        { href: "/admin/reconcile", label: "Reconcile", icon: RefreshCcw },
        { href: "/admin/certificates", label: "Certificates", icon: ScrollText },
        { href: "/admin/decisions", label: "Decisions Log", icon: ClipboardList },
      ],
    },
  ];
}


// ── Component ──────────────────────────────────────────────────────────────────

interface Props {
  badgeCounts: AdminBadgeCounts;
}

export function AdminNavClient({ badgeCounts }: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close sidebar when route changes (mobile) ─ gated so it doesn't cascade
  useEffect(() => {
    if (open) setOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const groups = buildNavGroups(badgeCounts);

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
