import { saveAdminNotificationSettings } from "@/app/admin/settings/actions";
import { getAdminSettingsSnapshot } from "@/lib/admin/settings";
import { BellRing, Mail, ShieldCheck } from "lucide-react";

type AdminNotificationSettingsScreenProps = {
  error?: null | string;
  message?: null | string;
};

function resolveMessage(value: null | string) {
  return value === "settings-saved" ? "Notification preferences saved." : value;
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
            Choose which optional operational emails reach this admin account.
            Required sign-in, recovery, and security messages remain enabled.
          </p>
        </div>
        <span className="status-pill w-fit">
          {snapshot.authUser?.email_confirmed_at ? "Email verified" : "Verification pending"}
        </span>
      </div>

      {feedbackMessage ? (
        <div className="flash-panel" data-tone="success" role="status">
          <p style={{ fontSize: "0.84rem", lineHeight: 1.6 }}>{feedbackMessage}</p>
        </div>
      ) : null}
      {feedbackError ? (
        <div className="flash-panel" data-tone="error" role="alert">
          <p style={{ fontSize: "0.84rem", lineHeight: 1.6 }}>{feedbackError}</p>
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(21rem,0.86fr)]">
        <article className="glass-card grid gap-5 p-6">
          <div className="flex items-start gap-3">
            <BellRing className="mt-0.5 shrink-0" size={18} />
            <div>
              <p className="text-sm font-semibold">Optional operational email</p>
              <p className="section-copy">
                These preferences are saved to your authenticated account and
                apply only to noncritical product updates.
              </p>
            </div>
          </div>

          <form action={saveAdminNotificationSettings} className="grid gap-3">
            <fieldset className="grid gap-3">
              <legend className="sr-only">Optional email preferences</legend>
              <label
                className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-4 transition-colors hover:bg-[var(--card)]"
                htmlFor="notification-email-opt-in"
              >
                <input
                  className="mt-1 h-4 w-4 shrink-0 rounded border-[var(--line)]"
                  defaultChecked={
                    snapshot.notificationSettings?.notification_email_opt_in ?? true
                  }
                  id="notification-email-opt-in"
                  name="notificationEmailOptIn"
                  type="checkbox"
                  value="true"
                />
                <span className="grid gap-1">
                  <span className="text-sm font-semibold">Operational summaries</span>
                  <span className="section-copy">
                    Receive the summary email after a bulk operation you start
                    finishes successfully.
                  </span>
                </span>
              </label>

              <label
                className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-4 transition-colors hover:bg-[var(--card)]"
                htmlFor="ticket-digest-opt-in"
              >
                <input
                  className="mt-1 h-4 w-4 shrink-0 rounded border-[var(--line)]"
                  defaultChecked={
                    snapshot.notificationSettings?.ticket_digest_opt_in ?? true
                  }
                  id="ticket-digest-opt-in"
                  name="ticketDigestOptIn"
                  type="checkbox"
                  value="true"
                />
                <span className="grid gap-1">
                  <span className="text-sm font-semibold">Ticket updates</span>
                  <span className="section-copy">
                    Receive update notices for support tickets you open or are
                    assigned to. Email never includes the reply content.
                  </span>
                </span>
              </label>
            </fieldset>

            <div className="admin-action-row mt-1">
              <button className="primary-button w-fit" type="submit">
                Save notification settings
              </button>
            </div>
          </form>
        </article>

        <article className="glass-card grid content-start gap-4 p-6">
          <div className="flex items-start gap-3">
            <Mail className="mt-0.5 shrink-0" size={18} />
            <div>
              <p className="text-sm font-semibold">Delivery destination</p>
              <p className="section-copy">
                Optional app emails use this operator account&rsquo;s verified
                address. Required account-protection messages are managed by
                Supabase Auth and are not controlled by these toggles.
              </p>
            </div>
          </div>

          <div className="grid gap-3">
            <div className="portal-info-row">
              <span className="portal-info-row__label">Primary email</span>
              <span className="portal-info-row__value admin-wrap-anywhere">
                {snapshot.auth.email || "Unavailable"}
              </span>
            </div>
            <div className="portal-info-row">
              <span className="portal-info-row__label">Optional delivery</span>
              <span className="portal-info-row__value">Resend</span>
            </div>
            <div className="portal-info-row">
              <span className="portal-info-row__label">Account protection</span>
              <span className="portal-info-row__value">Supabase Auth</span>
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

          <div className="flex items-start gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-4">
            <ShieldCheck className="mt-0.5 shrink-0" size={16} />
            <p className="section-copy">
              MFA, password recovery, verification, and high-risk account
              protection workflows stay available even when optional email is
              disabled.
            </p>
          </div>
        </article>
      </div>
    </section>
  );
}