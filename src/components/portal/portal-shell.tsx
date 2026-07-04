"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType } from "react";
import { useState, useEffect } from "react";
import {
  BarChart3,
  BookOpen,
  ChevronDown,
  FolderKanban,
  GraduationCap,
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

const ADVISOR_NAV_GROUPS: NavGroup[] = [
  {
    label: "Advisor Workspace",
    items: [
      createNavItem("/portal", "Overview", LayoutDashboard),
      createNavItem("/portal/advisor/profile", "Advisor Profile", GraduationCap),
      createNavItem("/portal/blogs", "Draft Blogs", BookOpen),
      createNavItem("/portal/profile/change-password", "Password", KeyRound),
    ],
  },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/portal") return pathname === "/portal";
  return pathname.startsWith(href);
}

interface PortalShellProps {
  avatarUrl?: null | string;
  children: React.ReactNode;
  memberName?: string | null;
  jnuitsId?: string | null;
  portalRole?: null | string;
}

function getPortalRoleLabel(portalRole: null | string) {
  if (!portalRole) {
    return "Portal workspace";
  }

  return `${portalRole.replaceAll("_", " ")} workspace`;
}

function getDefaultExpandedGroups(groups: NavGroup[]) {
  return new Set(groups.map((group) => group.label));
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
  const navGroups = portalRole === "advisor" ? ADVISOR_NAV_GROUPS : NAV_GROUPS;
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() =>
    getDefaultExpandedGroups(navGroups)
  );

  useEffect(() => {
    if (sidebarOpen) setSidebarOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    setExpandedGroups((current) => {
      const next = new Set(current);
      for (const group of navGroups) {
        next.add(group.label);
      }
      return next;
    });
  }, [navGroups]);

  function toggleGroup(label: string) {
    setExpandedGroups((current) => {
      const next = new Set(current);

      if (next.has(label)) {
        next.delete(label);
      } else {
        next.add(label);
      }

      return next;
    });
  }

  const displayJnuitsId = formatMembershipIdForDisplay(jnuitsId);

  return (
    <>
      <div
        className="portal-sidebar-overlay"
        data-open={sidebarOpen ? "true" : "false"}
        onClick={() => setSidebarOpen(false)}
        aria-hidden="true"
        style={{ display: sidebarOpen ? "block" : "none" }}
      />

      <aside
        className="portal-sidebar"
        data-open={sidebarOpen ? "true" : "false"}
        aria-label={portalRole === "advisor" ? "Advisor portal navigation" : "Member portal navigation"}
        style={{
          transform: sidebarOpen ? "translateX(0)" : undefined,
        }}
      >
        <div className="portal-sidebar__header">
          <div className="portal-sidebar__brand">
            <SiteBrand compact href="/portal" />
            <ThemeToggle />
          </div>

          <div className="portal-id-card">
            <ProfileAvatar
              className="portal-id-card__profile-avatar"
              name={memberName}
              src={avatarUrl}
              size="sm"
            />
            <div className="portal-id-card__info">
              <p className="portal-id-card__name">{memberName ?? (portalRole === "advisor" ? "Advisor" : "Member")}</p>
              {displayJnuitsId && (
                <p className="portal-id-card__id">{displayJnuitsId}</p>
              )}
            </div>
          </div>
        </div>

        <nav className="portal-sidebar__nav">
          {navGroups.map((group) => {
            const expanded = expandedGroups.has(group.label);
            const groupId = `portal-nav-group-${group.label
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-")}`;

            return (
              <div key={group.label} className="portal-nav-group">
                <button
                  aria-controls={groupId}
                  aria-expanded={expanded}
                  className="portal-nav-group__trigger"
                  onClick={() => toggleGroup(group.label)}
                  type="button"
                >
                  <span>{group.label}</span>
                  <ChevronDown
                    aria-hidden="true"
                    className="portal-nav-group__chevron"
                    size={14}
                  />
                </button>
                <div
                  aria-hidden={!expanded}
                  className="portal-nav-group__items"
                  data-open={expanded ? "true" : "false"}
                  id={groupId}
                >
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(pathname, item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="portal-nav-link"
                        data-active={active ? "true" : "false"}
                        tabIndex={expanded ? undefined : -1}
                      >
                        <span className="portal-nav-link__icon" aria-hidden="true">
                          <Icon size={13} />
                        </span>
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

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

      <div className="portal-content">
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

        <main className="portal-main" id="portal-main-content">
          {children}
        </main>
      </div>
    </>
  );
}