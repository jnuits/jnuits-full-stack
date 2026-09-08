import { ChangePasswordForm } from "@/components/portal/change-password-form";
import { PortalShell } from "@/components/portal/portal-shell";
import { requirePortalUser } from "@/lib/auth/session";
import { getPortalMemberSnapshot } from "@/lib/portal/member";
import { getAuthCaptchaUiConfig } from "@/lib/security/captcha";
import { KeyRound, ShieldAlert } from "lucide-react";

export async function ChangePasswordScreen() {
  const auth = await requirePortalUser({
    fallbackPath: "/portal/profile/change-password",
  });
  const user = auth.user;
  const snapshot = user ? await getPortalMemberSnapshot(user.id) : null;
  const member = snapshot?.member ?? null;

  return (
    <PortalShell
      avatarUrl={member?.avatar_secure_url ?? null}
      jnuitsId={member?.jnuits_id ?? null}
      memberName={member?.full_name ?? null}
      portalRole={user?.portalRole ?? null}
    >
      <div className="portal-page-header">
        <div>
          <p className="portal-page-header__breadcrumb">Portal Security</p>
          <h1 className="portal-page-header__title">Change Password</h1>
          <p className="portal-page-header__desc">
            Update the password for your portal account. Reauthentication may be
            required depending on the current Supabase session policy.
          </p>
        </div>
      </div>

      <div className="portal-section">
        <div className="portal-section__header">
          <div className="portal-section__header-left">
            <div className="portal-section__icon"><ShieldAlert size={14} /></div>
            <p className="portal-section__title">Security note</p>
          </div>
        </div>
        <div className="portal-section__body">
          <p style={{ color: "var(--muted-foreground)", fontSize: "0.88rem", lineHeight: 1.75 }}>
            If Supabase requires reauthentication, an OTP code will be sent to your registered
            email. Paste that code into the <strong>Reauthentication token</strong> field before
            confirming the new password.
          </p>
        </div>
      </div>

      <div className="portal-section">
        <div className="portal-section__header">
          <div className="portal-section__header-left">
            <div className="portal-section__icon"><KeyRound size={14} /></div>
            <p className="portal-section__title">Update password</p>
          </div>
        </div>
        <div className="portal-section__body">
          <ChangePasswordForm captcha={getAuthCaptchaUiConfig()} />
        </div>
      </div>
    </PortalShell>
  );
}
