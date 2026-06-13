import type { AdminNavIconKey, AdminPermission } from "@/lib/admin/access";
import { hasPermission } from "@/lib/auth/session";

export type AdminDashboardCapabilityKey =
  | "auditRead"
  | "bulkManage"
  | "certificatesManage"
  | "committeeManage"
  | "contentManage"
  | "decisionsRead"
  | "membershipManage"
  | "reconcileManage"
  | "reportsRead";

export type AdminDashboardCapabilities = Record<
  AdminDashboardCapabilityKey,
  boolean
>;

export type AdminDashboardQuickLink = {
  capability: AdminDashboardCapabilityKey;
  href: string;
  iconKey: AdminNavIconKey;
  label: string;
};

const capabilityPermissions = {
  auditRead: "admin.audit.read",
  bulkManage: "admin.bulk.manage",
  certificatesManage: "admin.certificates.manage",
  committeeManage: "admin.committee.manage",
  contentManage: [
    "admin.dashboard.read",
    "cms.blogs.review",
    "cms.events.manage",
    "cms.gallery.manage",
    "cms.media.manage",
    "cms.notices.manage",
    "cms.pages.manage",
    "cms.projects.manage",
  ],
  decisionsRead: "admin.decisions.read",
  membershipManage: "admin.membership.manage",
  reconcileManage: "admin.reconcile.manage",
  reportsRead: "admin.reports.read",
} satisfies Record<
  AdminDashboardCapabilityKey,
  AdminPermission | AdminPermission[]
>;

export const adminDashboardQuickLinks = [
  {
    capability: "membershipManage",
    href: "/admin/membership",
    iconKey: "shield",
    label: "Membership DB",
  },
  {
    capability: "committeeManage",
    href: "/admin/committee",
    iconKey: "users",
    label: "Committee",
  },
  {
    capability: "contentManage",
    href: "/admin/content",
    iconKey: "folder",
    label: "Content",
  },
  {
    capability: "reportsRead",
    href: "/admin/reports",
    iconKey: "barChart",
    label: "Reports",
  },
  {
    capability: "membershipManage",
    href: "/admin#applications",
    iconKey: "userCheck",
    label: "Applications",
  },
  {
    capability: "membershipManage",
    href: "/admin/invitations",
    iconKey: "mail",
    label: "Invitations",
  },
  {
    capability: "reconcileManage",
    href: "/admin/reconcile",
    iconKey: "refresh",
    label: "Reconcile",
  },
  {
    capability: "certificatesManage",
    href: "/admin/certificates",
    iconKey: "scroll",
    label: "Certificates",
  },
  {
    capability: "contentManage",
    href: "/admin/content/blogs",
    iconKey: "file",
    label: "Manage Blogs",
  },
  {
    capability: "contentManage",
    href: "/admin/content/projects",
    iconKey: "code",
    label: "Projects",
  },
  {
    capability: "contentManage",
    href: "/admin/content/events",
    iconKey: "book",
    label: "Events",
  },
  {
    capability: "decisionsRead",
    href: "/admin/decisions",
    iconKey: "clipboard",
    label: "Decisions Log",
  },
] satisfies AdminDashboardQuickLink[];

export function getAdminDashboardQuickLinks(
  capabilities: AdminDashboardCapabilities
) {
  return adminDashboardQuickLinks.filter((link) => capabilities[link.capability]);
}

export function canShowDashboardActivity(
  capabilities: AdminDashboardCapabilities
) {
  return capabilities.auditRead || capabilities.decisionsRead;
}

export function canShowDashboardDecisionCards(
  capabilities: AdminDashboardCapabilities
) {
  return (
    capabilities.certificatesManage ||
    capabilities.decisionsRead ||
    capabilities.membershipManage ||
    capabilities.reconcileManage
  );
}

export async function resolveAdminDashboardCapabilities(): Promise<AdminDashboardCapabilities> {
  const entries = await Promise.all(
    Object.entries(capabilityPermissions).map(async ([key, permission]) => [
      key,
      await hasPermission(permission),
    ])
  );

  return Object.fromEntries(entries) as AdminDashboardCapabilities;
}
