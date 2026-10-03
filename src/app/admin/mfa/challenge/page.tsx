import { AdminMFAChallenge } from "@/components/admin/admin-mfa-challenge";
import { safeAdminVerificationReturnPath } from "@/lib/auth/admin-verification/return-path";

export const metadata = {
  title: "Verify MFA | JnUITS Admin",
};

export default async function AdminMFAChallengePage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  return <AdminMFAChallenge returnPath={safeAdminVerificationReturnPath((await searchParams).next)} />;
}
