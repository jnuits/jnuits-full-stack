import AdminProfilesPage from "@/app/admin/admin-profiles/page";

export const metadata = { title: "My Admin Profile | JnUITS" };

export default async function AdminProfileSettingsPage() {
  return AdminProfilesPage({ searchParams: Promise.resolve({ tab: "self", profile: "me" }) });
}
