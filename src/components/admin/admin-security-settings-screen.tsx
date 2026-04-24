import Link from "next/link";
import { AdminPasswordForm } from "@/components/admin/admin-password-form";
import { getAdminSettingsSnapshot } from "@/lib/admin/settings";
import { ShieldCheck, ShieldQuestion, Smartphone, UserLock } from "lucide-react";

function formatDate(value: null | string | undefined) {
  if (!value) {
    return "Unavailable";
  }

  return new Date(value).toLocaleString("en-BD", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export async function AdminSecuritySettingsScreen() {
  const snapshot = await getAdminSettingsSnapshot();

  if (!snapshot) {
    return null;
  }

  const sessionState =
    snapshot.mfaState.currentLevel === "aal2" ? "Verified" : "Step-up required";
  const mfaActionHref =
    snapshot.mfaState.redirectTo || "/admin/mfa/challenge";
  const mfaActionLabel =
    snapshot.mfaState.redirectTo === "/admin/mfa/setup"
      ? "Set up MFA"
      : snapshot.mfaState.redirectTo === "/admin/mfa/challenge"
        ? "Verify MFA"
        : "Review MFA";

  return (
    <section className="grid gap-6">
      <div className="admin-page-header">
        <div>
          <p className="admin-page-header__breadcrumb">Admin settings</p>
          <h1 className="admin-page-header__title">Security Settings</h1>
          <p className="admin-page-header__desc">
            Live MFA state, password controls, and recent security events for
            this operator account.
          </p>
        </div>
        <span className="status-pill w-fit">{sessionState}</span>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <article className="glass-card grid gap-3 p-6">
          <div className="flex items-center gap-3">
            <ShieldCheck size={18} />
            <p className="text-sm font-semibold">Authenticator assurance</p>
          </div>
          <p className="text-2xl font-semibold tracking-[-0.03em]">
            {snapshot.mfaState.currentLevel || "aal1"}
          </p>
          <p className="section-copy">
            Target assurance: {snapshot.mfaState.nextLevel || "aal2"}
          </p>
        </article>

        <article className="glass-card grid gap-3 p-6">
          <div className="flex items-center gap-3">
            <UserLock size={18} />
            <p className="text-sm font-semibold">Email verification</p>
          </div>
          <p className="text-2xl font-semibold tracking-[-0.03em]">
            {snapshot.authUser?.email_confirmed_at ? "Confirmed" : "Pending"}
          </p>
          <p className="section-copy">
            Confirmed at {formatDate(snapshot.authUser?.email_confirmed_at)}
          </p>
        </article>

        <article className="glass-card grid gap-3 p-6">
          <div className="flex items-center gap-3">
            <ShieldQuestion size={18} />
            <p className="text-sm font-semibold">Security events</p>
          </div>
          <p className="text-2xl font-semibold tracking-[-0.03em]">
            {snapshot.securityEvents.length}
          </p>
          <p className="section-copy">Recent rows visible through current RLS.</p>
        </article>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,0.9fr)]">
        <article className="glass-card grid gap-4 p-6">
          <div className="flex items-center gap-3">
            <Smartphone size={18} />
            <div>
              <p className="text-sm font-semibold">MFA control plane</p>
              <p className="section-copy">
                Admin routes beyond login require a verified TOTP session.
              </p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface-2)] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">Current level</p>
              <p className="mt-2 text-sm font-semibold text-[var(--foreground)]">
                {snapshot.mfaState.currentLevel || "aal1"}
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface-2)] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">Next required level</p>
              <p className="mt-2 text-sm font-semibold text-[var(--foreground)]">
                {snapshot.mfaState.nextLevel || "aal2"}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link className="primary-button" href={mfaActionHref}>
              {mfaActionLabel}
            </Link>
            <Link className="secondary-button" href="/admin/mfa/challenge">
              Open challenge
            </Link>
          </div>
        </article>

        <article className="glass-card grid gap-4 p-6">
          <p className="text-sm font-semibold">Password management</p>
          <p className="section-copy">
            Password changes run through the authenticated Supabase session and
            can request reauthentication when the provider requires it.
          </p>
          <AdminPasswordForm />
        </article>
      </div>

      <article className="glass-card grid gap-4 p-6">
        <p className="text-sm font-semibold">Recent security activity</p>
        {snapshot.securityEvents.length === 0 ? (
          <p className="section-copy">
            No security events are visible for this account yet.
          </p>
        ) : (
          <div className="grid gap-3">
            {snapshot.securityEvents.map((event) => (
              <div key={event.id} className="portal-info-row">
                <span className="portal-info-row__label">
                  {event.event_type.replaceAll("_", " ")}
                </span>
                <span className="portal-info-row__value">
                  <span className={`portal-badge portal-badge--${event.severity === "critical" ? "returned" : event.severity === "warning" ? "pending" : "draft"}`}>
                    {event.severity}
                  </span>
                  <span className="mt-2 block text-xs text-[var(--muted-foreground)]">
                    {formatDate(event.created_at)}
                  </span>
                </span>
              </div>
            ))}
          </div>
        )}
      </article>
    </section>
  );
}
