import { ChangePasswordForm } from "@/components/portal/change-password-form";
import { PortalShell } from "@/components/portal/portal-shell";
import { requirePortalIdentity } from "@/lib/auth/session";
import { getPortalMemberSnapshot } from "@/lib/portal/member";
import { getAuthCaptchaUiConfig } from "@/lib/security/captcha";
import { KeyRound } from "lucide-react";

export async function ChangePasswordScreen() {
  const auth = await requirePortalIdentity({
    fallbackPath: "/portal/profile/change-password",
  });
  const user = auth.user;
  const snapshot = user ? await getPortalMemberSnapshot(user.id) : null;
  const member = snapshot?.member ?? null;

  return (
    <PortalShell
      accessMode={user?.portalRole === "advisor" && !snapshot?.membership ? "mutable" : snapshot?.access.mode ?? "blocked"}
      avatarUrl={member?.avatar_secure_url ?? snapshot?.membership?.avatarSecureUrl ?? null}
      jnuitsId={member?.jnuits_id ?? snapshot?.membership?.jnuitsId ?? null}
      memberName={member?.full_name ?? snapshot?.membership?.fullName ?? null}
      portalRole={user?.portalRole ?? null}
    >
      <div className="portal-page-header">
        <div>
          <p className="portal-page-header__breadcrumb">Portal Security</p>
          <h1 className="portal-page-header__title">Change Password</h1>
          <p className="portal-page-header__desc">
            Confirm your current password, then choose a strong new password.
            No email code is required.
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
          <ChangePasswordForm
            captcha={getAuthCaptchaUiConfig()}
            username={user?.email}
          />
        </div>
      </div>
    </PortalShell>
  );
}
