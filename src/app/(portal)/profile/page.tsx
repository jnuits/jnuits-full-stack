import { redirect } from "next/navigation";

export const metadata = { title: "My Profile | JnUITS Member Portal" };

export default function LegacyProfilePage() {
  redirect("/portal/profile");
}
