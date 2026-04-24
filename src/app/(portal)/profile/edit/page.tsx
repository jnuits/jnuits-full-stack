import { redirect } from "next/navigation";

export const metadata = { title: "Edit Profile | JnUITS Member Portal" };

export default function LegacyEditProfilePage() {
  redirect("/portal/profile/edit");
}
