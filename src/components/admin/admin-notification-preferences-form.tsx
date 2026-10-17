"use client";

import { useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Info,
  Mail,
  ShieldCheck,
} from "lucide-react";

export type AdminNotificationPreferences = {
  admin_security_email_opt_in: boolean;
  admin_recommendation_email_opt_in: boolean;
};

export type AdminNotificationPreferencesFormProps = {
  ready?: boolean;
  admin_security_email_opt_in?: boolean;
  admin_recommendation_email_opt_in?: boolean;
  onSave?: (
    preferences: AdminNotificationPreferences
  ) => Promise<{ success: boolean; message?: string } | void>;
  pending?: boolean;
  error?: string | null;
  feedback?: string | null;
  className?: string;
};

export function AdminNotificationPreferencesForm({
  ready = true,
  admin_security_email_opt_in = false,
  admin_recommendation_email_opt_in = false,
  onSave,
  pending = false,
  error: externalError = null,
  feedback: externalFeedback = null,
  className = "",
}: AdminNotificationPreferencesFormProps) {
  const [securityOptIn, setSecurityOptIn] = useState(admin_security_email_opt_in);
  const [recommendationOptIn, setRecommendationOptIn] = useState(
    admin_recommendation_email_opt_in
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [internalError, setInternalError] = useState<string | null>(null);
  const [internalFeedback, setInternalFeedback] = useState<string | null>(null);

  const activeError = externalError || internalError;
  const activeFeedback = externalFeedback || internalFeedback;
  const isBusy = pending || isSubmitting;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!onSave || !ready || isBusy) return;

    setInternalError(null);
    setInternalFeedback(null);
    setIsSubmitting(true);

    try {
      const result = await onSave({
        admin_security_email_opt_in: securityOptIn,
        admin_recommendation_email_opt_in: recommendationOptIn,
      });
      if (result && "success" in result && !result.success) {
        setInternalError(result.message || "Failed to update notification preferences.");
      } else {
        setInternalFeedback(
          (result && "message" in result && result.message) ||
            "Notification preferences updated successfully."
        );
      }
    } catch {
      setInternalError("An unexpected error occurred while saving preferences.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section
      aria-labelledby="notification-preferences-heading"
      className={`rounded-[0.9rem] border border-[var(--line)] bg-[var(--card)] p-4 sm:p-5 shadow-sm ${className}`}
      data-testid="admin-notification-preferences-form"
    >
      <div className="flex items-center gap-2.5">
        <div
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--line)] bg-[color-mix(in_oklab,var(--background)_80%,var(--card))]"
          aria-hidden="true"
        >
          <Mail size={16} className="text-[var(--primary,#0284c7)]" />
        </div>
        <div>
          <h2
            id="notification-preferences-heading"
            className="font-[family-name:var(--font-heading)] text-base font-semibold text-[var(--foreground)]"
          >
            Admin Notification &amp; Email Preferences
          </h2>
          <p className="text-xs text-[var(--muted-foreground)]">
            Manage optional email alerts and personal monthly accountability recommendations.
          </p>
        </div>
      </div>

      {/* Mandatory Account Security Mail Notice */}
      <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-sky-200/60 bg-sky-50/60 p-3 text-xs text-sky-950 dark:border-sky-900/50 dark:bg-sky-950/20 dark:text-sky-200">
        <ShieldCheck size={16} className="mt-0.5 shrink-0 text-sky-600 dark:text-sky-400" aria-hidden="true" />
        <div className="space-y-0.5 leading-relaxed">
          <p className="font-semibold">Your own account security mail is separate</p>
          <p className="opacity-90">
            Password-change messages follow the authentication provider&apos;s security settings and
            verified account address. These preferences control optional peer security alerts
            and monthly recommendations.
          </p>
        </div>
      </div>

      {!ready ? (
        <div className="mt-4 rounded-lg border border-[var(--line)] bg-[color-mix(in_oklab,var(--background)_80%,var(--card))] p-4 text-center text-xs text-[var(--muted-foreground)]">
          <Info size={16} className="mx-auto text-[var(--muted-foreground)]" aria-hidden="true" />
          <p className="mt-1 font-medium">Notification preferences will be available shortly</p>
          <p className="mt-0.5 text-[11px]">
            Backend mail provider configuration is currently pending activation.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="space-y-3 divide-y divide-[var(--line)]">
            {/* Peer Security Notice Opt-in */}
            <div className="pt-1">
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  name="admin_security_email_opt_in"
                  checked={securityOptIn}
                  onChange={(e) => setSecurityOptIn(e.target.checked)}
                  disabled={isBusy}
                  className="mt-1 h-4 w-4 rounded border-[var(--line)] text-[var(--primary,#0284c7)] focus:ring-2 focus:ring-[var(--primary,#0284c7)]"
                />
                <div className="space-y-0.5 text-xs">
                  <span className="font-medium text-[var(--foreground)]">
                    Receive peer security email alerts
                  </span>
                  <p className="text-[11px] text-[var(--muted-foreground)]">
                    Receive email notifications when other administrator accounts undergo role changes,
                    privilege modifications, or invitation updates. Requires active audit read permission.
                  </p>
                </div>
              </label>
            </div>

            {/* Monthly Recommendations Opt-in */}
            <div className="pt-3">
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  name="admin_recommendation_email_opt_in"
                  checked={recommendationOptIn}
                  onChange={(e) => setRecommendationOptIn(e.target.checked)}
                  disabled={isBusy}
                  className="mt-1 h-4 w-4 rounded border-[var(--line)] text-[var(--primary,#0284c7)] focus:ring-2 focus:ring-[var(--primary,#0284c7)]"
                />
                <div className="space-y-0.5 text-xs">
                  <span className="font-medium text-[var(--foreground)]">
                    Receive monthly personal recommendations digest
                  </span>
                  <p className="text-[11px] text-[var(--muted-foreground)]">
                    Receive at most one personalized digest per month highlighting remaining profile
                    checks, authenticator setup status, and pending review queues. No email is sent when there are no
                    remaining recommendations.
                  </p>
                </div>
              </label>
            </div>
          </div>

          {activeFeedback && (
            <div
              className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50/70 p-3 text-xs text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-200"
              role="status"
            >
              <CheckCircle2 size={14} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>{activeFeedback}</span>
            </div>
          )}

          {activeError && (
            <div
              className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50/70 p-3 text-xs text-red-900 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-200"
              role="alert"
            >
              <AlertCircle size={14} className="shrink-0 text-red-600 dark:text-red-400" />
              <span>{activeError}</span>
            </div>
          )}

          <div className="flex items-center justify-end pt-2">
            <button
              type="submit"
              disabled={isBusy}
              className="primary-button text-xs"
            >
              {isBusy ? "Saving preferences..." : "Save notification preferences"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
