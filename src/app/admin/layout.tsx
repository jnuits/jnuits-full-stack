import { AdminShell } from "@/components/admin/admin-shell";
import { requireAdminUser } from "@/lib/auth/session";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdminUser();

  return <AdminShell>{children}</AdminShell>;
}
