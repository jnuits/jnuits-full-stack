import { redirect } from "next/navigation";

export const metadata = { title: "Admin Profile Settings | JnUITS" };

export default function AdminProfileSettingsPage() {
  redirect("/admin/admin-profiles?tab=self&profile=me");
}