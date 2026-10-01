import { requirePortalIdentity } from "@/lib/auth/session";

export default async function MemberProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Legacy routes only redirect; their destination leaf enforces mutation access.
  // Identity-only access lets former members reach the password-change redirect.
  await requirePortalIdentity({ fallbackPath: "/profile" });

  return <>{children}</>;
}
