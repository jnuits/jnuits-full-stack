export type AdminPermission =
  | "admin.admin_profiles.manage"
  | "admin.audit.read"
  | "admin.bulk.manage"
  | "admin.certificates.manage"
  | "admin.committee.manage"
  | "admin.dashboard.read"
  | "admin.decisions.read"
  | "admin.membership.manage"
  | "admin.reconcile.manage"
  | "admin.reports.read"
  | "admin.roles.manage_admin"
  | "admin.roles.manage_portal"
  | "admin.roles.read"
  | "admin.security.read"
  | "admin.security.write"
  | "admin.settings.read"
  | "admin.settings.write"
  | "admin.support.manage"
  | "cms.blogs.publish"
  | "cms.blogs.review"
  | "cms.contacts.manage"
  | "cms.email_marketing.manage"
  | "cms.events.manage"
  | "cms.gallery.manage"
  | "cms.media.manage"
  | "cms.notices.manage"
  | "cms.pages.manage"
  | "cms.projects.manage";

export type AdminNavGroup =
  | "Content"
  | "Membership"
  | "Organization"
  | "Overview"
  | "Settings";

export type AdminNavIconKey =
  | "barChart"
  | "bell"
  | "book"
  | "clipboard"
  | "code"
  | "dashboard"
  | "file"
  | "folder"
  | "image"
  | "mail"
  | "phone"
  | "refresh"
  | "scroll"
  | "shield"
  | "userCheck"
  | "userCog"
  | "users";

export type AdminBadgeKey =
  | "pendingApps"
  | "pendingProfile"
  | "pendingProfileRequests"
  | "pendingWorkplace";

export type AdminAccessItem = {
  badgeKey?: AdminBadgeKey;
  group: AdminNavGroup;
  href: string;
  iconKey: AdminNavIconKey;
  label: string;
  requiredPermission: AdminPermission | null;
  requireAal2?: boolean;
};

export type AdminRouteAccess = {
  requiredPermission: AdminPermission | null;
  requireAal2: boolean;
};

export const adminAccessItems: readonly AdminAccessItem[] = [
  {
    group: "Overview",
    href: "/admin",
    iconKey: "dashboard",
    label: "Dashboard",
    requiredPermission: null,
  },
  {
    badgeKey: "pendingApps",
    group: "Membership",
    href: "/admin/applications",
    iconKey: "userCheck",
    label: "Applications",
    requiredPermission: "admin.membership.manage",
  },
  {
    group: "Membership",
    href: "/admin/invitations",
    iconKey: "mail",
    label: "Invitations",
    requiredPermission: "admin.membership.manage",
  },
  {
    badgeKey: "pendingProfileRequests",
    group: "Membership",
    href: "/admin/profile-changes",
    iconKey: "users",
    label: "Profile Requests",
    requiredPermission: "admin.membership.manage",
  },
  {
    group: "Membership",
    href: "/admin/membership",
    iconKey: "shield",
    label: "Membership DB",
    requiredPermission: "admin.membership.manage",
  },
  {
    group: "Membership",
    href: "/admin/bulk-operations",
    iconKey: "clipboard",
    label: "Bulk Operations",
    requiredPermission: "admin.bulk.manage",
  },
  {
    group: "Content",
    href: "/admin/content",
    iconKey: "folder",
    label: "Content Hub",
    requiredPermission: "admin.dashboard.read",
  },
  {
    group: "Content",
    href: "/admin/content/about",
    iconKey: "file",
    label: "About page",
    requiredPermission: "cms.pages.manage",
  },
  {
    group: "Content",
    href: "/admin/content/slider",
    iconKey: "image",
    label: "Slider images",
    requiredPermission: "cms.pages.manage",
  },
  {
    group: "Content",
    href: "/admin/content/media",
    iconKey: "image",
    label: "Media",
    requiredPermission: "cms.media.manage",
  },
  {
    group: "Content",
    href: "/admin/content/blogs",
    iconKey: "file",
    label: "Blogs",
    requiredPermission: "cms.blogs.review",
  },
  {
    group: "Content",
    href: "/admin/content/notices",
    iconKey: "scroll",
    label: "Notices",
    requiredPermission: "cms.notices.manage",
  },
  {
    group: "Content",
    href: "/admin/content/events",
    iconKey: "book",
    label: "Events",
    requiredPermission: "cms.events.manage",
  },
  {
    group: "Content",
    href: "/admin/content/gallery",
    iconKey: "image",
    label: "Gallery",
    requiredPermission: "cms.gallery.manage",
  },
  {
    group: "Content",
    href: "/admin/content/projects",
    iconKey: "code",
    label: "Projects",
    requiredPermission: "cms.projects.manage",
  },
  {
    group: "Organization",
    href: "/admin/committee",
    iconKey: "shield",
    label: "Committee",
    requiredPermission: "admin.committee.manage",
  },
  {
    group: "Organization",
    href: "/admin/audit",
    iconKey: "shield",
    label: "Audit Explorer",
    requiredPermission: "admin.audit.read",
  },
  {
    group: "Organization",
    href: "/admin/reports",
    iconKey: "barChart",
    label: "Reports",
    requiredPermission: "admin.reports.read",
  },
  {
    group: "Organization",
    href: "/admin/certificates",
    iconKey: "scroll",
    label: "Certificates",
    requiredPermission: "admin.certificates.manage",
  },
  {
    group: "Organization",
    href: "/admin/decisions",
    iconKey: "clipboard",
    label: "Decisions Log",
    requiredPermission: "admin.decisions.read",
  },
  {
    group: "Settings",
    href: "/admin/system-health",
    iconKey: "shield",
    label: "System Health",
    requiredPermission: "admin.security.read",
    requireAal2: true,
  },
  {
    group: "Settings",
    href: "/admin/admin-profiles",
    iconKey: "userCog",
    label: "Admin Accounts",
    requiredPermission: null,
  },
  {
    group: "Settings",
    href: "/admin/settings/security",
    iconKey: "shield",
    label: "Security Settings",
    requiredPermission: "admin.security.read",
    requireAal2: true,
  },
  {
    group: "Settings",
    href: "/admin/settings/notifications",
    iconKey: "bell",
    label: "Notification Settings",
    requiredPermission: "admin.settings.read",
  },
  {
    group: "Settings",
    href: "/admin/settings/contact",
    iconKey: "phone",
    label: "Contact Settings",
    requiredPermission: "admin.settings.read",
  },
];

const hiddenAdminRoutes: Array<{ href: string; access: AdminRouteAccess }> = [
  {
    href: "/admin/dashboard",
    access: { requiredPermission: null, requireAal2: false },
  },
  {
    href: "/admin/settings",
    access: { requiredPermission: "admin.settings.read", requireAal2: false },
  },
  {
    href: "/admin/workplace",
    access: {
      requiredPermission: "admin.membership.manage",
      requireAal2: false,
    },
  },
  {
    href: "/admin/content/pages",
    access: { requiredPermission: "cms.pages.manage", requireAal2: false },
  },
  {
    href: "/admin/reconcile",
    access: {
      requiredPermission: "admin.reconcile.manage",
      requireAal2: false,
    },
  },
];

function cleanPathname(pathname: string) {
  const clean = pathname.split("?")[0]?.replace(/\/+$/, "") || "/admin";
  return clean === "" ? "/admin" : clean;
}

function routeMatches(pathname: string, href: string) {
  if (href === "/admin") {
    return pathname === "/admin";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function getAdminRouteAccess(pathname: string): AdminRouteAccess {
  const clean = cleanPathname(pathname);

  if (clean === "/admin" || clean.startsWith("/admin/mfa/")) {
    return { requiredPermission: null, requireAal2: false };
  }

  const hiddenRoute = hiddenAdminRoutes.find((route) =>
    routeMatches(clean, route.href)
  );

  if (hiddenRoute) {
    return hiddenRoute.access;
  }

  const item = [...adminAccessItems]
    .sort((left, right) => right.href.length - left.href.length)
    .find((candidate) => routeMatches(clean, candidate.href));

  if (item) {
    return {
      requiredPermission: item.requiredPermission,
      requireAal2: Boolean(item.requireAal2),
    };
  }

  return { requiredPermission: "admin.dashboard.read", requireAal2: false };
}

export function getAdminNavigationLinks() {
  return adminAccessItems.map(({ href, label }) => ({ href, label }));
}

export function getAdminNavPermissionCodes() {
  return Array.from(
    new Set(
      adminAccessItems
        .map((item) => item.requiredPermission)
        .filter((permission): permission is AdminPermission => Boolean(permission))
    )
  );
}
