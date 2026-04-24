"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";

type TOTPFactor = {
  friendly_name?: null | string;
  id: string;
  status: string;
};

export function AdminMFAChallenge() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<null | string>(null);
  const [factor, setFactor] = useState<null | TOTPFactor>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    async function loadFactors() {
      const supabase = createClient();
      const { data, error: factorsError } = await supabase.auth.mfa.listFactors();

      if (factorsError) {
        setError(factorsError.message);
        setLoading(false);
        return;
      }

      const verifiedTotp = data.totp.find(
        (candidate) => candidate.status === "verified"
      );

      setFactor(verifiedTotp || null);
      setLoading(false);
    }

    void loadFactors();
  }, []);

  async function handleVerify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!factor || !code.trim()) {
      setError("Enter the 6-digit code from your authenticator app.");
      return;
    }

    setError(null);
    setPending(true);

    try {
      const supabase = createClient();
      const challenge = await supabase.auth.mfa.challenge({
        factorId: factor.id,
      });

      if (challenge.error) {
        setError(challenge.error.message);
        return;
      }

      const verification = await supabase.auth.mfa.verify({
        challengeId: challenge.data.id,
        code: code.trim(),
        factorId: factor.id,
      });

      if (verification.error) {
        setError(verification.error.message);
        return;
      }

      router.replace("/admin/dashboard");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="grid gap-6">
      <div className="admin-page-header">
        <div>
          <p className="admin-page-header__breadcrumb">Admin security</p>
          <h1 className="admin-page-header__title">Verify MFA</h1>
          <p className="admin-page-header__desc">
            Enter the current code from your authenticator app to continue to
            the operator workspace.
          </p>
        </div>
      </div>

      <article className="glass-card grid gap-5 p-6">
        {loading ? (
          <p className="section-copy">Checking your enrolled factors...</p>
        ) : factor ? (
          <form className="grid max-w-md gap-4" onSubmit={handleVerify}>
            <p className="status-pill w-fit">
              {factor.friendly_name || "Verified authenticator"}
            </p>
            <label className="input-label" htmlFor="admin-mfa-code">
              Verification code
              <input
                autoComplete="one-time-code"
                id="admin-mfa-code"
                inputMode="numeric"
                maxLength={8}
                onChange={(event) => setCode(event.target.value)}
                placeholder="123456"
                required
                value={code}
              />
            </label>
            {error ? (
              <p className="text-sm font-semibold text-[var(--brand-rust)]">
                {error}
              </p>
            ) : null}
            <button className="primary-button" disabled={pending} type="submit">
              {pending ? "Verifying..." : "Verify and continue"}
            </button>
          </form>
        ) : (
          <div className="grid gap-4">
            <p className="section-copy">
              No verified authenticator factor is enrolled for this admin
              account.
            </p>
            <Link className="primary-button w-fit" href="/admin/mfa/setup">
              Set up MFA
            </Link>
          </div>
        )}
      </article>
    </section>
  );
}
