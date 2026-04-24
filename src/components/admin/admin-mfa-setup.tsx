"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";
import { createClient } from "@/utils/supabase/client";

export function AdminMFASetup() {
  const router = useRouter();
  const enrolledRef = useRef(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<null | string>(null);
  const [factorId, setFactorId] = useState<null | string>(null);
  const [pending, setPending] = useState(false);
  const [qrCode, setQrCode] = useState<null | string>(null);

  useEffect(() => {
    if (enrolledRef.current) {
      return;
    }

    enrolledRef.current = true;

    async function enrollFactor() {
      const supabase = createClient();
      const factors = await supabase.auth.mfa.listFactors();

      if (factors.error) {
        setError(factors.error.message);
        return;
      }

      const verifiedTotp = factors.data.totp.find(
        (factor) => factor.status === "verified"
      );

      if (verifiedTotp) {
        router.replace("/admin/mfa/challenge");
        router.refresh();
        return;
      }

      const staleTotpFactors = factors.data.totp.filter(
        (factor) => factor.status !== "verified"
      );

      for (const factor of staleTotpFactors) {
        const { error: unenrollError } = await supabase.auth.mfa.unenroll({
          factorId: factor.id,
        });

        if (unenrollError) {
          setError(unenrollError.message);
          return;
        }
      }

      let enrollment = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "JnUITS Admin",
      });

      if (
        enrollment.error?.message
          .toLowerCase()
          .includes("friendly name")
      ) {
        enrollment = await supabase.auth.mfa.enroll({
          factorType: "totp",
          friendlyName: `JnUITS Admin ${Date.now().toString(36)}`,
        });
      }

      const { data, error: enrollError } = enrollment;

      if (enrollError) {
        setError(enrollError.message);
        return;
      }

      setFactorId(data.id);
      setQrCode(data.totp.qr_code);
    }

    void enrollFactor();
  }, [router]);

  async function handleVerify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!factorId || !code.trim()) {
      setError("Enter the 6-digit code from your authenticator app.");
      return;
    }

    setError(null);
    setPending(true);

    try {
      const supabase = createClient();
      const challenge = await supabase.auth.mfa.challenge({ factorId });

      if (challenge.error) {
        setError(challenge.error.message);
        return;
      }

      const verification = await supabase.auth.mfa.verify({
        challengeId: challenge.data.id,
        code: code.trim(),
        factorId,
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
          <h1 className="admin-page-header__title">Set up MFA</h1>
          <p className="admin-page-header__desc">
            Admin accounts require a verified TOTP authenticator before entering
            the operator workspace.
          </p>
        </div>
      </div>

      <article className="glass-card grid gap-5 p-6">
        {qrCode ? (
          <div className="grid gap-5 lg:grid-cols-[18rem_minmax(0,1fr)]">
            <div className="rounded-2xl border border-[var(--line)] bg-white p-4">
              {/* Supabase returns a data URL SVG QR code for TOTP enrollment. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img alt="TOTP setup QR code" className="w-full" src={qrCode} />
            </div>
            <form className="grid content-start gap-4" onSubmit={handleVerify}>
              <label className="input-label" htmlFor="admin-mfa-setup-code">
                Verification code
                <input
                  autoComplete="one-time-code"
                  id="admin-mfa-setup-code"
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
          </div>
        ) : (
          <p className="section-copy">
            {error || "Preparing a secure authenticator setup code..."}
          </p>
        )}
      </article>
    </section>
  );
}
