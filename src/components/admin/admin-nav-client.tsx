"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType } from "react";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  BarChart2,
  BellRing,
  BookOpen,
  ChevronDown,
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
import type {
  AdminBadgeCounts,
  AdminShellNavigationItem,
} from "./admin-shell";

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

const collapsibleGroups = new Set([
  "Membership",
  "Content",
  "Organization",
  "Settings",
]);

const iconByKey: Record<AdminShellNavigationItem["iconKey"], NavItem["icon"]> = {
  barChart: BarChart2,
  bell: BellRing,
  book: BookOpen,
  clipboard: ClipboardList,
  code: FileCode2,
  dashboard: LayoutDashboard,
  file: FileText,
  folder: FolderOpen,
  image: ImageIcon,
  mail: Mail,
  phone: Phone,
  refresh: RefreshCcw,
  scroll: ScrollText,
  shield: ShieldCheck,
  userCheck: UserCheck,
  userCog: UserCog,
  users: Users,
};

function buildNavGroups(
  counts: AdminBadgeCounts,
  navigationItems: AdminShellNavigationItem[]
): NavGroup[] {
  const groups: NavGroup[] = [];

  for (const item of navigationItems) {
    let group = groups.find((candidate) => candidate.label === item.group);

    if (!group) {
      group = { label: item.group, items: [] };
      groups.push(group);
    }

    group.items.push({
      badge: item.badgeKey ? counts[item.badgeKey] : undefined,
      href: item.href,
      icon: iconByKey[item.iconKey],
      label: item.label,
    });
  }

  return groups;
}

interface Props {
  badgeCounts: AdminBadgeCounts;
  navigationItems: AdminShellNavigationItem[];
}

export function AdminNavClient({ badgeCounts, navigationItems }: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    () => new Set()
  );
  const [toggleSlot, setToggleSlot] = useState<HTMLElement | null>(null);
  const groups = buildNavGroups(badgeCounts, navigationItems);

  useEffect(() => {
    setToggleSlot(document.getElementById("admin-sidebar-toggle-slot"));
  }, []);

  function isActive(href: string): boolean {
    if (href === "/admin") return pathname === "/admin";
    return pathname.startsWith(href);
  }

  const activeGroupLabel = groups.find((group) =>
    group.items.some((item) => isActive(item.href))
  )?.label;

  useEffect(() => {
    if (open) setOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    if (!activeGroupLabel || !collapsibleGroups.has(activeGroupLabel)) {
      return;
    }

    setExpandedGroups((current) => {
      if (current.has(activeGroupLabel)) {
        return current;
      }

      const next = new Set(current);
      next.add(activeGroupLabel);
      return next;
    });
  }, [activeGroupLabel]);

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

  function renderItems(group: NavGroup, expanded = true) {
    return group.items.map((item) => {
      const Icon = item.icon;
      const active = isActive(item.href);
      return (
        <Link
          key={item.href}
          href={item.href}
          className="admin-nav-link"
          data-active={active ? "true" : "false"}
          tabIndex={expanded ? undefined : -1}
        >
          <span className="admin-nav-link__icon" aria-hidden="true">
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
    });
  }

  return (
    <>
      <div
        className="admin-sidebar-overlay"
        data-open={open ? "true" : "false"}
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />

      <aside
        className="admin-sidebar"
        data-open={open ? "true" : "false"}
        aria-label="Admin navigation"
      >
        <div className="admin-sidebar__brand">
          <SiteBrand compact href="/admin" />
          <span className="admin-sidebar__brand-badge">Admin</span>
        </div>

        <nav className="admin-sidebar__nav">
          {groups.map((group) => {
            const collapsible = collapsibleGroups.has(group.label);
            const expanded = !collapsible || expandedGroups.has(group.label);
            const groupBadgeCount = group.items.reduce(
              (total, item) => total + (item.badge || 0),
              0
            );
            const groupId = `admin-nav-group-${group.label
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-")}`;

            return (
              <div key={group.label} className="admin-nav-group">
                {collapsible ? (
                  <>
                    <button
                      aria-controls={groupId}
                      aria-expanded={expanded}
                      className="admin-nav-group__trigger"
                      data-active={group.label === activeGroupLabel ? "true" : "false"}
                      onClick={() => toggleGroup(group.label)}
                      type="button"
                    >
                      <span>{group.label}</span>
                      {groupBadgeCount > 0 ? (
                        <span className="admin-nav-group__badge">
                          {groupBadgeCount > 99 ? "99+" : groupBadgeCount}
                        </span>
                      ) : null}
                      <ChevronDown
                        aria-hidden="true"
                        className="admin-nav-group__chevron"
                        size={14}
                      />
                    </button>
                    <div
                      aria-hidden={!expanded}
                      className="admin-nav-group__items"
                      data-open={expanded ? "true" : "false"}
                      id={groupId}
                    >
                      {renderItems(group, expanded)}
                    </div>
                  </>
                ) : (
                  <>
                    <p className="admin-nav-group__label">{group.label}</p>
                    {renderItems(group)}
                  </>
                )}
              </div>
            );
          })}
        </nav>

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

      {toggleSlot ? createPortal(
        <button
          id="admin-sidebar-toggle"
          className="admin-sidebar-toggle"
          aria-label={open ? "Close sidebar" : "Open sidebar"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          type="button"
        >
          {open ? <X size={16} /> : <Menu size={16} />}
        </button>,
        toggleSlot
      ) : (
        <button
          id="admin-sidebar-toggle"
          className="admin-sidebar-toggle"
          aria-label={open ? "Close sidebar" : "Open sidebar"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          type="button"
        >
          {open ? <X size={16} /> : <Menu size={16} />}
        </button>
      )}
    </>
  );
}