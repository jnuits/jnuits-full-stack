"use client";

import { updateCurrentPassword } from "@/app/(auth)/actions";
import { getPasswordPolicyError } from "@/lib/security/password-policy";
import { startTransition, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function AdminPasswordForm() {
  const [message, setMessage] = useState<null | string>(null);
  const [error, setError] = useState<null | string>(null);
  const [pending, setPending] = useState(false);
  const [reauthPending, setReauthPending] = useState(false);

  async function handleUpdate(formData: FormData) {
    const password = String(formData.get("password") || "");
    const confirmPassword = String(formData.get("confirmPassword") || "");
    const nonce = String(formData.get("nonce") || "").trim();

    setError(null);
    setMessage(null);

    const policyError = getPasswordPolicyError(password);
    if (policyError) {
      setError(policyError);
      return;
    }

    if (password !== confirmPassword) {
      setError("New password and confirmation do not match.");
      return;
    }

    setPending(true);
    const result = await updateCurrentPassword({
      confirmPassword,
      nonce,
      password,
    });

    if (!result.ok) {
      setError(result.message);
      setPending(false);
      return;
    }

    setMessage(result.message);
    setPending(false);
  }

  async function requestReauthenticationCode() {
    setError(null);
    setMessage(null);
    setReauthPending(true);

    const supabase = createClient();
    const { error: reauthError } = await supabase.auth.reauthenticate();

    if (reauthError) {
      setError(reauthError.message);
      setReauthPending(false);
      return;
    }

    setMessage(
      "A reauthentication code has been sent to your confirmed admin email address."
    );
    setReauthPending(false);
  }

  return (
    <div className="grid gap-5">
      <form
        action={(formData) => startTransition(() => void handleUpdate(formData))}
        className="grid gap-4 sm:grid-cols-2"
      >
        <label className="input-label sm:col-span-2" htmlFor="admin-password">
          New password
          <input
            autoComplete="new-password"
            id="admin-password"
            name="password"
            placeholder="Use 12 or more characters"
            type="password"
          />
        </label>
        <p className="-mt-2 text-xs leading-5 text-[var(--muted-foreground)] sm:col-span-2">
          Use a long, unique passphrase. Common passwords and passwords based on
          your email are rejected.
        </p>
        <label className="input-label sm:col-span-2" htmlFor="admin-confirm-password">
          Confirm password
          <input
            autoComplete="new-password"
            id="admin-confirm-password"
            name="confirmPassword"
            placeholder="Re-enter the new password"
            type="password"
          />
        </label>
        <label className="input-label sm:col-span-2" htmlFor="admin-password-nonce">
          Reauthentication code
          <input
            autoComplete="one-time-code"
            id="admin-password-nonce"
            name="nonce"
            placeholder="Paste the code if Supabase asks for reauthentication"
          />
        </label>
        <div className="flex flex-wrap gap-3 sm:col-span-2">
          <button className="primary-button" disabled={pending} type="submit">
            {pending ? "Updating..." : "Update password"}
          </button>
          <button
            className="secondary-button"
            disabled={reauthPending}
            onClick={() =>
              startTransition(() => void requestReauthenticationCode())
            }
            type="button"
          >
            {reauthPending ? "Sending code..." : "Send reauthentication code"}
          </button>
        </div>
      </form>

      {message ? (
        <p className="text-sm font-medium text-emerald-600">{message}</p>
      ) : null}
      {error ? (
        <p className="text-sm font-medium text-[var(--brand-rust)]">{error}</p>
      ) : null}
    </div>
  );
}