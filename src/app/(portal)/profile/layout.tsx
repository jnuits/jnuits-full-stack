import { requirePortalUser } from "@/lib/auth/session";

export default async function MemberProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePortalUser({ fallbackPath: "/profile" });

  return <>{children}</>;
}
