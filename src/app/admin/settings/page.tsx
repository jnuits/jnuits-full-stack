import { redirect } from "next/navigation";

export default function AdminSettingsIndexPage() {
  redirect("/admin/settings/profile");
}
