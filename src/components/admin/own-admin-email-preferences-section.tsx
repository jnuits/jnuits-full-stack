import { loadOwnAdminEmailPreferences } from "@/lib/admin/notifications/store";
import { OwnAdminEmailPreferences } from "./admin-notice-workspace-client";

export async function OwnAdminEmailPreferencesSection() {
  let preferences: Awaited<ReturnType<typeof loadOwnAdminEmailPreferences>> | null = null;
  try { preferences = await loadOwnAdminEmailPreferences(); } catch { /* Private unavailable state. */ }
  return <OwnAdminEmailPreferences preferences={preferences} />;
}
