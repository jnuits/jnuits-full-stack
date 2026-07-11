"use client";

import { checkPasswordExposure } from "@/lib/security/pwned-passwords";
import { getPasswordPolicyError } from "@/lib/security/password-policy";
import { useState } from "react";

type PasswordSecurityFieldProps = {
  autoComplete?: "new-password";
  id: string;
  name: string;
  placeholder: string;
  required?: boolean;
};

export function PasswordSecurityField({
  autoComplete = "new-password",
  id,
  name,
  placeholder,
  required = false,
}: PasswordSecurityFieldProps) {
  const [message, setMessage] = useState<string | null>(null);
  const [status, setStatus] = useState<
    "checking" | "idle" | "invalid" | "pwned" | "safe" | "unavailable"
  >("idle");

  async function checkPassword(value: string) {
    setMessage(null);

    if (!value) {
      setStatus("idle");
      return;
    }

    const policyError = getPasswordPolicyError(value);
    if (policyError) {
      setStatus("invalid");
      setMessage(policyError);
      return;
    }

    setStatus("checking");
    const result = await checkPasswordExposure(value);

    if (result.status === "pwned") {
      setStatus("pwned");
      setMessage("This password has appeared in known data breaches. Choose a different password.");
      return;
    }

    if (result.status === "unavailable") {
      setStatus("unavailable");
      setMessage("Password security verification is temporarily unavailable. The server will check again when you submit.");
      return;
    }

    setStatus("safe");
    setMessage("Password security check passed.");
  }

  return (
    <div className="grid gap-1.5">
      <input
        aria-describedby={`${id}-security-status`}
        aria-invalid={status === "invalid" || status === "pwned" ? true : undefined}
        autoComplete={autoComplete}
        id={id}
        name={name}
        onBlur={(event) => void checkPassword(event.currentTarget.value)}
        placeholder={placeholder}
        required={required}
        type="password"
      />
      <p
        aria-live="polite"
        className={
          status === "invalid" || status === "pwned"
            ? "text-xs font-medium text-[var(--brand-rust)]"
            : "text-xs text-[var(--muted-foreground)]"
        }
        id={`${id}-security-status`}
      >
        {status === "checking" ? "Checking password security..." : message}
      </p>
    </div>
  );
}
