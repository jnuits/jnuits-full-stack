import { headers } from "next/headers";
import { AdminShell } from "@/components/admin/admin-shell";
import {
  requireAdminPermission,
  requireAdminUser,
} from "@/lib/auth/session";
import { getAdminRouteAccess } from "@/lib/admin/access";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdminUser({ fallbackPath: "/admin" });
  const requestHeaders = await headers();
  const requestedPath =
    requestHeaders.get("x-jnuits-return-to")?.split("?")[0] || "/admin";
  const routeAccess = getAdminRouteAccess(requestedPath);
  const requiredPermission = routeAccess.requiredPermission;

  if (requiredPermission) {
    await requireAdminPermission(requiredPermission, {
      fallbackPath: "/admin/dashboard",
      requireAal2: routeAccess.requireAal2,
    });
  }

  return <AdminShell>{children}</AdminShell>;
}
