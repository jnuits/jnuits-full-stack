import { saveAdminNotificationSettings } from "@/app/admin/settings/actions";
import { getAdminSettingsSnapshot } from "@/lib/admin/settings";
import { BellRing, Mail, ShieldCheck } from "lucide-react";

type AdminNotificationSettingsScreenProps = {
  error?: null | string;
  message?: null | string;
};

function resolveMessage(value: null | string) {
  if (value === "settings-saved") {
    return "Notification preferences saved.";
  }

  return value;
}

function resolveError(value: null | string) {
  if (value === "settings-invalid") {
    return "The submitted notification preferences were invalid.";
  }

  return value ? decodeURIComponent(value) : null;
}

export async function AdminNotificationSettingsScreen({
  error = null,
  message = null,
}: AdminNotificationSettingsScreenProps) {
  const snapshot = await getAdminSettingsSnapshot();

  if (!snapshot) {
    return null;
  }

  const feedbackMessage = resolveMessage(message);
  const feedbackError = resolveError(error);

  return (
    <section className="grid gap-6">
      <div className="admin-page-header">
        <div>
          <p className="admin-page-header__breadcrumb">Admin settings</p>
          <h1 className="admin-page-header__title">Notification Settings</h1>
          <p className="admin-page-header__desc">
            Delivery preferences for operator emails, queue digests, and
            branded auth notifications.
          </p>
        </div>
        <span className="status-pill w-fit">
          {snapshot.authUser?.email_confirmed_at ? "Email verified" : "Verification pending"}
        </span>
      </div>

      {feedbackMessage ? (
        <div className="flash-panel" data-tone="success">
          <p style={{ fontSize: "0.84rem", lineHeight: 1.6 }}>{feedbackMessage}</p>
        </div>
      ) : null}
      {feedbackError ? (
        <div className="flash-panel" data-tone="error">
          <p style={{ fontSize: "0.84rem", lineHeight: 1.6 }}>{feedbackError}</p>
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(21rem,0.9fr)]">
        <article className="glass-card grid gap-4 p-6">
          <div className="flex items-center gap-3">
            <BellRing size={18} />
            <div>
              <p className="text-sm font-semibold">Delivery preferences</p>
              <p className="section-copy">
                These toggles control the operator-facing digest and alert lane
                persisted for your authenticated account.
              </p>
            </div>
          </div>

          <form action={saveAdminNotificationSettings} className="grid gap-4">
            <label className="input-label" style={{ gap: "0.7rem" }}>
              <span>Security and operator alerts</span>
              <label style={{ alignItems: "center", display: "flex", gap: "0.6rem" }}>
                <input
                  defaultChecked={
                    snapshot.notificationSettings?.notification_email_opt_in ?? true
                  }
                  name="notificationEmailOptIn"
                  type="checkbox"
                  value="true"
                />
                <span>Receive admin notices and security alerts by email.</span>
              </label>
            </label>

            <label className="input-label" style={{ gap: "0.7rem" }}>
              <span>Queue digests</span>
              <label style={{ alignItems: "center", display: "flex", gap: "0.6rem" }}>
                <input
                  defaultChecked={
                    snapshot.notificationSettings?.ticket_digest_opt_in ?? true
                  }
                  name="ticketDigestOptIn"
                  type="checkbox"
                  value="true"
                />
                <span>Receive digest summaries for ticket and moderation queues.</span>
              </label>
            </label>

            <button className="primary-button" type="submit">
              Save notification settings
            </button>
          </form>
        </article>

        <article className="glass-card grid gap-4 p-6">
          <div className="flex items-center gap-3">
            <Mail size={18} />
            <div>
              <p className="text-sm font-semibold">Delivery channels</p>
              <p className="section-copy">
                Supabase auth emails and app-owned security notices share the
                same verified operator destination.
              </p>
            </div>
          </div>

          <div className="grid gap-3">
            <div className="portal-info-row">
              <span className="portal-info-row__label">Primary email</span>
              <span className="portal-info-row__value">
                {snapshot.auth.email || "Unavailable"}
              </span>
            </div>
            <div className="portal-info-row">
              <span className="portal-info-row__label">Auth delivery</span>
              <span className="portal-info-row__value">
                Supabase + Resend
              </span>
            </div>
            <div className="portal-info-row">
              <span className="portal-info-row__label">Email status</span>
              <span className="portal-info-row__value">
                <span className="portal-badge portal-badge--verified">
                  {snapshot.authUser?.email_confirmed_at ? "Verified" : "Pending"}
                </span>
              </span>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface-2)] p-4">
            <ShieldCheck size={16} className="mt-0.5" />
            <p className="section-copy">
              High-risk security events still depend on an `aal2` session even
              when email delivery is enabled.
            </p>
          </div>
        </article>
      </div>
    </section>
  );
}
