"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AdminSecurityNoticesPanel, type AdminSecurityNoticesPanelProps } from "./admin-security-notices-panel";
import { AdminNotificationPreferencesForm, type AdminNotificationPreferences } from "./admin-notification-preferences-form";

async function mutate(body: unknown) {
  const response = await fetch("/api/admin/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const result = await response.json().catch(() => null);
  if (!response.ok || result?.ok !== true) throw new Error("Changes could not be saved. Please retry.");
}
export function AdminNoticeWorkspaceClient(props: Pick<AdminSecurityNoticesPanelProps, "notices" | "page" | "pageSize" | "totalItems" | "unreadCount" | "availability">) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  async function mark(noticeId: string | null) {
    setError(null);
    try { await mutate(noticeId === null ? { action: "mark_all_read" } : { action: "mark_read", noticeId }); router.refresh(); }
    catch { setError("Notice could not be marked read. Please retry."); }
  }
  return <div className="grid gap-4">{error && <p role="alert">{error}</p>}<AdminSecurityNoticesPanel {...props}
    onMarkRead={id => mark(id)} onMarkAllRead={() => mark(null)} onPageChange={page => router.push(`/admin/notifications?page=${page}`)} /></div>;
}
export function OwnAdminEmailPreferences({ preferences }: { preferences: AdminNotificationPreferences | null }) {
  return <AdminNotificationPreferencesForm ready={preferences !== null} {...(preferences || {})}
    error={preferences === null ? "Email preferences unavailable. Refresh to retry." : null}
    onSave={async value => { await mutate({ action: "preferences", preferences: value }); return { success: true, message: "Email preferences saved." }; }} />;
}
