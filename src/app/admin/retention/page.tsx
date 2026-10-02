import { RetentionWorkspace } from "@/components/admin/retention-workspace";
import { authorizeAdminRead, adminReadVerificationNotice } from "@/lib/auth/admin-verification/read-boundary";

export const metadata = { title: "Data Retention — Admin | JnUITS" };

export default async function RetentionPage() {
  const verified = await authorizeAdminRead("admin.retention.read");
  if (!verified.ok) return adminReadVerificationNotice("admin.retention.read", verified.code);
  return <RetentionWorkspace />;
}
