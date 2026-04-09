"use client";

import { startTransition, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function ChangePasswordForm() {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [reauthPending, setReauthPending] = useState(false);

  async function handleUpdate(formData: FormData) {
    const password = String(formData.get("password") || "");
    const confirmPassword = String(formData.get("confirmPassword") || "");
    const nonce = String(formData.get("nonce") || "").trim();

    setError(null);
    setMessage(null);

    if (password.length < 8) {
      setError("Use a password with at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("New password and confirmation do not match.");
      return;
    }

    setPending(true);

    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({
      password,
      nonce: nonce || undefined,
    });

    if (updateError) {
      setError(updateError.message);
      setPending(false);
      return;
    }

    setMessage("Password updated successfully for the current signed-in session.");
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
      "A reauthentication code has been sent to your confirmed email address. Paste that code into the nonce field before retrying the password change."
    );
    setReauthPending(false);
  }

  return (
    <div className="grid gap-5">
      <form
        action={(formData) => startTransition(() => void handleUpdate(formData))}
        className="portal-form-grid"
        id="change-password-form"
      >
        <label className="input-label sm:col-span-2" htmlFor="cp-new-password">
          New password
          <input
            id="cp-new-password"
            autoComplete="new-password"
            name="password"
            placeholder="Enter a strong new password (min. 8 characters)"
            type="password"
          />
        </label>
        <label className="input-label sm:col-span-2" htmlFor="cp-confirm-password">
          Confirm new password
          <input
            id="cp-confirm-password"
            autoComplete="new-password"
            name="confirmPassword"
            placeholder="Re-enter the new password"
            type="password"
          />
        </label>
        <label className="input-label sm:col-span-2" htmlFor="cp-nonce">
          Reauthentication code
          <input
            id="cp-nonce"
            autoComplete="one-time-code"
            name="nonce"
            placeholder="Only required if Supabase asks for reauthentication"
          />
        </label>
        <div className="flex flex-wrap gap-3 sm:col-span-2">
          <button className="primary-button" disabled={pending} type="submit">
            {pending ? "Updating..." : "Update password"}
          </button>
          <button
            className="secondary-button"
            disabled={reauthPending}
            onClick={() => startTransition(() => void requestReauthenticationCode())}
            type="button"
          >
            {reauthPending ? "Sending code..." : "Send reauthentication code"}
          </button>
        </div>
      </form>

      {message ? <p className="portal-message portal-message--success">{message}</p> : null}
      {error ? <p className="portal-message portal-message--error">{error}</p> : null}
    </div>
  );
}
