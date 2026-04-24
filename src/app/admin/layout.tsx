import { headers } from "next/headers";
import { AdminShell } from "@/components/admin/admin-shell";
import {
  requireAdminPermission,
  requireAdminUser,
} from "@/lib/auth/session";

function getAdminPermissionForPath(pathname: string) {
  if (
    pathname === "/admin" ||
    pathname === "/admin/dashboard" ||
    pathname.startsWith("/admin/mfa/")
  ) {
    return null;
  }

  if (
    pathname === "/admin/applications" ||
    pathname === "/admin/invitations" ||
    pathname === "/admin/workplace" ||
    pathname === "/admin/profile-changes" ||
    pathname === "/admin/membership"
  ) {
    return "admin.membership.manage";
  }

  if (pathname === "/admin/content" || pathname.startsWith("/admin/content?")) {
    return "admin.dashboard.read";
  }

  if (pathname.startsWith("/admin/content/media")) {
    return "cms.media.manage";
  }

  if (pathname.startsWith("/admin/content/blogs")) {
    return "cms.blogs.review";
  }

  if (pathname.startsWith("/admin/content/events")) {
    return "cms.events.manage";
  }

  if (pathname.startsWith("/admin/content/gallery")) {
    return "cms.gallery.manage";
  }

  if (pathname.startsWith("/admin/content/projects")) {
    return "cms.projects.manage";
  }

  if (pathname.startsWith("/admin/content/pages")) {
    return "cms.pages.manage";
  }

  if (pathname.startsWith("/admin/committee")) {
    return "admin.committee.manage";
  }

  if (pathname.startsWith("/admin/reports")) {
    return "admin.reports.read";
  }

  if (pathname.startsWith("/admin/reconcile")) {
    return "admin.reconcile.manage";
  }

  if (pathname.startsWith("/admin/certificates")) {
    return "admin.certificates.manage";
  }

  if (pathname.startsWith("/admin/decisions")) {
    return "admin.decisions.read";
  }

  if (pathname.startsWith("/admin/settings/security")) {
    return "admin.security.read";
  }

  if (pathname.startsWith("/admin/settings")) {
    return "admin.settings.read";
  }

  return "admin.dashboard.read";
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const auth = await requireAdminUser({ fallbackPath: "/admin" });
  const requestHeaders = await headers();
  const requestedPath =
    requestHeaders.get("x-jnuits-return-to")?.split("?")[0] || "/admin";
  const requiredPermission = getAdminPermissionForPath(requestedPath);

  if (requiredPermission) {
    await requireAdminPermission(requiredPermission, {
      fallbackPath: "/admin/dashboard",
      requireAal2: requestedPath.startsWith("/admin/settings/security"),
    });
  }

  return <AdminShell adminRole={auth.user?.adminRole}>{children}</AdminShell>;
}
