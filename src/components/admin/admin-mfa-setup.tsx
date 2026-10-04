"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { safeAdminVerificationReturnPath } from "@/lib/auth/admin-verification/return-path";

export function AdminMFASetup({ onVerified, returnPath = "/admin/dashboard" }: { onVerified?: () => void; returnPath?: string } = {}) {
  const router = useRouter();
  const started = useRef(false);
  const mounted = useRef(false);
  const locked = useRef(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [setupKey, setSetupKey] = useState("");
  const [showKey, setShowKey] = useState(false);

  async function enrollFactor() {
    if (locked.current) return;
    locked.current = true;
    setLoading(true); setError(null); setShowKey(false);
    try {
      const supabase = createClient();
      const factors = await supabase.auth.mfa.listFactors();
      if (!mounted.current) return;
      if (factors.error) { setError("Your authenticators could not be loaded. Try again."); return; }
      const verifiedTotp = factors.data.totp.find(factor => factor.status === "verified");
      if (verifiedTotp) {
        if (onVerified) { onVerified(); return; }
        router.replace(`/admin/mfa/challenge?next=${encodeURIComponent(safeAdminVerificationReturnPath(returnPath))}`);
        router.refresh(); return;
      }
      // The typed totp list contains only verified factors. Pending factors
      // are in all; never remove a verified factor or another MFA method.
      for (const factor of factors.data.all.filter(factor => factor.factor_type === "totp" && factor.status === "unverified")) {
        const result = await supabase.auth.mfa.unenroll({ factorId: factor.id });
        if (!mounted.current) return;
        if (result.error) { setError("The previous unfinished setup could not be cleared. Try again."); return; }
      }
      let enrollment = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "JnUITS Admin", issuer: "JnUITS" });
      if (!mounted.current) return;
      if (enrollment.error?.message.toLowerCase().includes("friendly name")) {
        enrollment = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `JnUITS Admin ${Date.now().toString(36)}`, issuer: "JnUITS" });
      }
      if (!mounted.current) return;
      if (enrollment.error) { setError("Authenticator setup is temporarily unavailable. Try again."); return; }
      setFactorId(enrollment.data.id);
      setQrCode(enrollment.data.totp.qr_code);
      setSetupKey(enrollment.data.totp.secret);
    } catch {
      if (mounted.current) setError("Authenticator setup is temporarily unavailable. Check your connection and try again.");
    } finally {
      locked.current = false;
      if (mounted.current) setLoading(false);
    }
  }

  useEffect(() => {
    mounted.current = true;
    if (!started.current) { started.current = true; void enrollFactor(); }
    return () => { mounted.current = false; };
    // Start one enrollment for this mounted flow, including Strict Mode.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleVerify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (locked.current) return;
    if (!factorId || !/^\d{6}$/.test(code)) { setError("Enter the 6-digit code from your authenticator app."); return; }
    locked.current = true; setError(null); setPending(true);
    try {
      const supabase = createClient();
      const challenge = await supabase.auth.mfa.challenge({ factorId });
      if (challenge.error) { setError("The authenticator challenge could not be started. Try again."); return; }
      const verification = await supabase.auth.mfa.verify({ challengeId: challenge.data.id, code, factorId });
      if (verification.error) { setError("The code was not accepted. Try the current code from your authenticator."); return; }
      const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (assurance.error || assurance.data.currentLevel !== "aal2") {
        setError("Your authenticator session could not be confirmed. Verify again before continuing."); return;
      }
      if (!mounted.current) return;
      setCode(""); setSetupKey(""); setShowKey(false); setQrCode(null);
      // Only the server's trusted factor/session read records enrollment.
      await fetch("/api/admin/mfa-suggestion", { cache: "no-store" }).catch(() => undefined);
      if (!mounted.current) return;
      if (onVerified) { onVerified(); return; }
      router.replace(safeAdminVerificationReturnPath(returnPath)); router.refresh();
    } catch {
      if (mounted.current) setError("Verification could not be completed. Check your connection and try again.");
    } finally {
      locked.current = false;
      if (mounted.current) setPending(false);
    }
  }

  return <section className="grid gap-6">
    <div className="admin-page-header"><div>
      <p className="admin-page-header__breadcrumb">Admin security</p>
      <h1 className="admin-page-header__title">Set up MFA</h1>
      <p className="admin-page-header__desc">Add an authenticator to protect your account and verify sensitive operations. Mandatory workspace protection follows society settings.</p>
    </div></div>
    <article className="glass-card grid gap-5 p-6" aria-busy={loading || pending}>
      {qrCode ? <div className="grid min-w-0 gap-5 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <div className="grid min-w-0 content-start gap-4">
          <h2 className="font-semibold">1. Add your authenticator</h2>
          <p className="section-copy">Scan this QR code with your authenticator app. It will save your JnUITS account and generate a new six-digit code every 30 seconds.</p>
          <div className="rounded-2xl border border-[var(--line)] bg-white p-4">
            {/* The native enrollment QR contains a secret; keep it in this mounted flow only. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img alt="TOTP setup QR code" className="w-full" src={qrCode} />
          </div>
          <button className="ghost-button w-fit" type="button" aria-expanded={showKey} disabled={pending} onClick={() => setShowKey(value => !value)}>{showKey ? "Hide setup key" : "Can't scan? Show setup key"}</button>
          {showKey ? <div className="grid min-w-0 gap-2">
            <p className="section-copy">Choose manual entry in your app: issuer JnUITS, time based (TOTP), six digits, 30 seconds. Keep this key private.</p>
            <code className="break-all rounded-lg border border-[var(--line)] p-3 select-all">{setupKey}</code>
          </div> : null}
        </div>
        <form className="grid content-start gap-4" onSubmit={handleVerify}>
          <h2 className="font-semibold">2. Verify the code</h2>
          <p className="section-copy">Enter the current code from your app to finish setup.</p>
          <label className="input-label" htmlFor="admin-mfa-setup-code">Verification code
            <input autoComplete="one-time-code" id="admin-mfa-setup-code" inputMode="numeric" maxLength={6} pattern="[0-9]{6}" disabled={pending} onChange={event => setCode(event.target.value)} placeholder="123456" required value={code} />
          </label>
          <button className="primary-button" disabled={pending} type="submit">{pending ? "Verifying..." : "Verify and continue"}</button>
        </form>
      </div> : loading ? <p className="section-copy" role="status">Preparing a secure authenticator setup code...</p> : null}
      {error ? <p role="alert" className="text-sm font-semibold text-[var(--brand-rust)]">{error}</p> : null}
      {!qrCode && !loading && error ? <button className="secondary-button w-fit" type="button" onClick={() => void enrollFactor()}>Try again</button> : null}
    </article>
  </section>;
}
