import { AdminNotificationSettingsScreen } from "@/components/admin/admin-notification-settings-screen";

export const metadata = { title: "Admin Notification Settings | JnUITS" };

export default async function AdminNotificationSettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolved = await searchParams;

  return (
    <AdminNotificationSettingsScreen
      error={typeof resolved.error === "string" ? resolved.error : null}
      message={typeof resolved.message === "string" ? resolved.message : null}
    />
  );
}
