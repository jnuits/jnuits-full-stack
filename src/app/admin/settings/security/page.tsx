import { AdminSecuritySettingsScreen } from "@/components/admin/admin-security-settings-screen";
import { authorizeAdminRead, adminReadVerificationNotice } from "@/lib/auth/admin-verification/read-boundary";

export const metadata = { title: "Admin Security Settings | JnUITS" };

export default async function AdminSecuritySettingsPage() {
  const verified = await authorizeAdminRead("admin.security.read");
  if (!verified.ok) return adminReadVerificationNotice("admin.security.read", verified.code);
  return <AdminSecuritySettingsScreen />;
}
