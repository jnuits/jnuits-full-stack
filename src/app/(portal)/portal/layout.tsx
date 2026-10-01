import { headers } from "next/headers";
import {
  requirePortalPermission,
  requirePortalIdentity,
  requirePortalUser,
} from "@/lib/auth/session";

function getPortalPermissionForPath(pathname: string) {
  if (pathname === "/portal" || pathname === "/portal/dashboard") {
    return null;
  }

  if (pathname === "/portal/profile" || pathname === "/portal/profile/change-password") {
    return null;
  }

  if (pathname.startsWith("/portal/profile")) {
    return "portal.profile.manage_self";
  }

  if (pathname.startsWith("/portal/blogs")) {
    return "portal.blogs.submit";
  }

  if (pathname.startsWith("/portal/tickets")) {
    return [
      "portal.tickets.create_self",
      "portal.tickets.manage_member",
      "portal.tickets.manage_alumni",
      "admin.support.manage",
    ];
  }

  if (pathname.startsWith("/portal/mentorship")) {
    return [
      "portal.mentorship.request",
      "portal.mentorship.participate",
      "portal.community.moderate",
      "admin.support.manage",
    ];
  }

  return null;
}

export default async function MemberPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const requestHeaders = await headers();
  const requestedPath =
    requestHeaders.get("x-jnuits-return-to")?.split("?")[0] || "/portal";
  const identityOnly = ["/portal", "/portal/dashboard", "/portal/membership", "/portal/profile/change-password"].includes(requestedPath);
  if (identityOnly) await requirePortalIdentity({ fallbackPath: "/portal" });
  else await requirePortalUser({ fallbackPath: "/portal" });

  const requiredPermission = getPortalPermissionForPath(requestedPath);

  if (requiredPermission) {
    await requirePortalPermission(requiredPermission, {
      fallbackPath: "/portal/dashboard",
    });
  }

  return <>{children}</>;
}
