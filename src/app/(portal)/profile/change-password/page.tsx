import { ChangePasswordForm } from "@/components/portal/change-password-form";
import { PortalShell } from "@/components/portal/portal-shell";
import { requireAuthenticatedUser } from "@/lib/auth/session";
import { getPortalMemberSnapshot } from "@/lib/portal/member";
import { KeyRound, ShieldAlert } from "lucide-react";

export const metadata = { title: "Change Password | JnUITS Member Portal" };

export default async function ChangePasswordPage() {
  const auth = await requireAuthenticatedUser({ fallbackPath: "/profile/change-password" });
  const user = auth.user;
  const snapshot = user ? await getPortalMemberSnapshot(user.id) : null;
  const member = snapshot?.member ?? null;

  return (
    <PortalShell memberName={member?.full_name ?? null} jnuitsId={member?.jnuits_id ?? null}>
      {/* Page header */}
      <div className="portal-page-header">
        <div>
          <p className="portal-page-header__breadcrumb">Member Services</p>
          <h1 className="portal-page-header__title">Change Password</h1>
          <p className="portal-page-header__desc">
            Update the password for your portal account. Requires reauthentication if Supabase&apos;s
            session policy mandates a fresh identity proof.
          </p>
        </div>
      </div>

      {/* Security notice */}
      <div className="portal-section">
        <div className="portal-section__header">
          <div className="portal-section__header-left">
            <div className="portal-section__icon"><ShieldAlert size={14} /></div>
            <p className="portal-section__title">Security note</p>
          </div>
        </div>
        <div className="portal-section__body">
          <p style={{ fontSize: "0.88rem", color: "var(--muted)", lineHeight: 1.75 }}>
            If Supabase requires reauthentication, an OTP code will be sent to your registered
            email. Paste that code into the <strong>Reauthentication token</strong> field before
            confirming the new password. Your current session remains valid after a successful change.
          </p>
        </div>
      </div>

      {/* Password form */}
      <div className="portal-section">
        <div className="portal-section__header">
          <div className="portal-section__header-left">
            <div className="portal-section__icon"><KeyRound size={14} /></div>
            <p className="portal-section__title">Update password</p>
          </div>
        </div>
        <div className="portal-section__body">
          <ChangePasswordForm />
        </div>
      </div>
    </PortalShell>
  );
}
