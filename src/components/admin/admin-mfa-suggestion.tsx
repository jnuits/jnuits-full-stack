"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ShieldAlert, ShieldCheck } from "lucide-react";

import type { AdminSecurityGuidance } from "@/lib/admin/security-guidance";
export type { AdminSecurityGuidance } from "@/lib/admin/security-guidance";

export type MfaSuggestionValue = {
  show: boolean;
  snoozedUntil: string | null;
  guidance?: AdminSecurityGuidance;
};

export function AdminMfaSuggestion() {
  const [show, setShow] = useState(false);
  const [guidance, setGuidance] = useState<AdminSecurityGuidance | null>(null);
  const [pending, setPending] = useState(false);
  const locked = useRef(false);

  useEffect(() => {
    let active = true;
    void fetch("/api/admin/mfa-suggestion", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (active && response.ok && data?.ok === true && data.value?.show === true) {
          setShow(true);
          if (data.value.guidance) {
            setGuidance(data.value.guidance);
          }
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  async function snooze() {
    if (locked.current) return;
    locked.current = true;
    setPending(true);
    try {
      const response = await fetch("/api/admin/mfa-suggestion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "snooze" }),
        cache: "no-store",
      });
      const data = await response.json();
      if (response.ok && data?.ok === true && data.value?.show === false) {
        setShow(false);
      }
    } catch {
      /* Suggestion failure must never block routine work. */
    } finally {
      locked.current = false;
      setPending(false);
    }
  }

  if (!show) return null;

  // If guidance is absent, preserve exact neutral reminder for backward compatibility
  if (!guidance) {
    return (
      <aside
        className="flash-panel flex flex-wrap items-center justify-between gap-3"
        aria-label="Optional account protection"
      >
        <p className="text-sm">Protect your admin account — enable MFA.</p>
        <div className="flex flex-wrap gap-3">
          <a className="admin-btn admin-btn--secondary" href="/admin/mfa/setup">
            Set up authenticator
          </a>
          <button
            className="admin-btn admin-btn--ghost"
            disabled={pending}
            onClick={() => void snooze()}
            type="button"
          >
            Remind me in 7 days
          </button>
        </div>
      </aside>
    );
  }

  const isVerified = guidance.state === "verified";
  const isVerifyNeeded = guidance.state === "verify";
  const actionHref =
    guidance.href || (isVerifyNeeded ? "/admin/mfa/challenge" : "/admin/mfa/setup");
  const actionLabel = isVerifyNeeded
    ? "Verify session"
    : isVerified
      ? "View security settings"
      : guidance.state === "unknown" ? "View security settings" : "Set up authenticator";

  return (
    <aside
      className="flash-panel flex flex-col gap-3 rounded-[0.9rem] border border-[var(--line)] bg-[var(--card)] p-4 shadow-sm"
      aria-label="Account security guidance"
      data-testid="admin-mfa-suggestion"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <div
            className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[var(--line)] bg-[color-mix(in_oklab,var(--background)_80%,var(--card))]"
            aria-hidden="true"
          >
            {isVerified ? (
              <ShieldCheck size={16} className="text-emerald-600 dark:text-emerald-400" />
            ) : (
              <ShieldAlert size={16} className="text-[var(--primary,#0284c7)]" />
            )}
          </div>
          <div>
            <h3 className="font-[family-name:var(--font-heading)] text-sm font-semibold text-[var(--foreground)]">
              {guidance.title || "Admin account security guidance"}
            </h3>
            <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
              {guidance.description || "Permissions remain role-bound. Privilege changes require step-up verification."}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {actionHref && (
            <a className="admin-btn admin-btn--secondary text-xs" href={actionHref}>
              {actionLabel}
            </a>
          )}
          {!isVerified && (
            <button
              className="admin-btn admin-btn--ghost text-xs"
              disabled={pending}
              onClick={() => void snooze()}
              type="button"
            >
              Remind me in 7 days
            </button>
          )}
        </div>
      </div>

      {guidance.capabilities && guidance.capabilities.length > 0 && (
        <details className="group mt-1 rounded-md border border-[var(--line)] bg-[color-mix(in_oklab,var(--background)_85%,var(--card))] p-2.5 text-xs">
          <summary className="flex cursor-pointer list-none items-center justify-between font-medium text-[var(--foreground)]">
            <span>Capability requirements &amp; proofs</span>
            <ChevronDown
              size={13}
              className="text-[var(--muted-foreground)] transition-transform group-open:rotate-180"
              aria-hidden="true"
            />
          </summary>
          <div className="mt-2.5 space-y-2 border-t border-[var(--line)] pt-2 text-[var(--muted-foreground)]">
            <p className="text-[11px] leading-relaxed">
              Permissions are role-bound. A configured authenticator must be verified in the current session for native AAL2;
              role invitations, grants, and removals also require current-password and exact
              intent proof.
            </p>
            <ul className="space-y-1.5 pl-2">
              {guidance.capabilities.map((cap) => (
                <li key={cap.operation} className="flex flex-col gap-0.5">
                  <span className="font-medium text-[var(--foreground)]">{cap.label}</span>
                  <span className="text-[11px]">
                    Requires: {cap.requirements.join(", ")}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </details>
      )}
    </aside>
  );
}
