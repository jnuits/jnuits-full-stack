import { AdminMFASetup } from "@/components/admin/admin-mfa-setup";
import { safeAdminVerificationReturnPath } from "@/lib/auth/admin-verification/return-path";

export const metadata = {
  title: "Set up MFA | JnUITS Admin",
};

export default async function AdminMFASetupPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  return <AdminMFASetup returnPath={safeAdminVerificationReturnPath((await searchParams).next)} />;
}
