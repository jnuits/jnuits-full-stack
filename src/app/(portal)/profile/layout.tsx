import { requireAuthenticatedUser } from "@/lib/auth/session";

export default async function MemberProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAuthenticatedUser({ fallbackPath: "/profile" });

  return <>{children}</>;
}
