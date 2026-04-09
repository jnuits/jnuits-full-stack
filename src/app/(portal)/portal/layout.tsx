import { requireAuthenticatedUser } from "@/lib/auth/session";

export default async function MemberPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAuthenticatedUser({ fallbackPath: "/portal" });

  return <>{children}</>;
}
