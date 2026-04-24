import { redirect } from "next/navigation";

export const metadata = { title: "Change Password | JnUITS Member Portal" };

export default function LegacyChangePasswordPage() {
  redirect("/portal/profile/change-password");
}
