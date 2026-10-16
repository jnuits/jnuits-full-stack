import { requireAdminPagePermission } from "@/lib/admin/activity/page-access";
import { loadOwnAdminNotices,loadOwnAdminNotificationHealth } from "@/lib/admin/notifications/store";
import { AdminNoticeWorkspaceClient } from "@/components/admin/admin-notice-workspace-client";
import { AdminNotificationHealth } from "@/components/admin/admin-notification-health";

export const metadata = { title: "Security Notices | JnUITS" };
export default async function AdminNotificationsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await requireAdminPagePermission("admin.audit.read", { fallbackPath: "/admin/dashboard" });
  const params = await searchParams;
  let result: Awaited<ReturnType<typeof loadOwnAdminNotices>> | null = null;
  let health:Awaited<ReturnType<typeof loadOwnAdminNotificationHealth>>|null=null;
  try { result = await loadOwnAdminNotices({ page: Number(params.page || 1) }); } catch { /* Preserve an explicit unavailable state. */ }
  try { health=await loadOwnAdminNotificationHealth(); } catch { /* Inbox remains useful if health is unavailable. */ }
  return <div className="grid gap-6"><div className="admin-page-header"><div><p className="admin-page-header__breadcrumb">Admin / Security</p><h1 className="admin-page-header__title">Security notices</h1><p className="admin-page-header__desc">Account changes visible under your current audit permissions. Notices refresh daily.</p></div></div>
    <AdminNotificationHealth health={health}/><AdminNoticeWorkspaceClient notices={result?.items || []} totalItems={result?.totalItems || 0} page={result?.page || 1} pageSize={result?.pageSize || 25} unreadCount={result?.unreadCount ?? null} availability={result ? "available" : "unavailable"} />
  </div>;
}
