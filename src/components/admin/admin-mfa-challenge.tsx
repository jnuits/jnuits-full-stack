"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { safeAdminVerificationReturnPath } from "@/lib/auth/admin-verification/return-path";

type TOTPFactor = { friendly_name?: null | string; id: string; status: string };

export function AdminMFAChallenge({ returnPath = "/admin/dashboard" }: { returnPath?: string } = {}) {
  const router = useRouter();
  const mounted = useRef(false);
  const locked = useRef(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [factor, setFactor] = useState<TOTPFactor | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);

  async function loadFactors() {
    setLoading(true); setError(null);
    try {
      const result = await createClient().auth.mfa.listFactors();
      if (!mounted.current) return;
      if (result.error) { setError("Your authenticators are temporarily unavailable. Try again."); return; }
      setFactor(result.data.totp.find(candidate => candidate.status === "verified") || null);
    } catch {
      if (mounted.current) setError("Your authenticators are temporarily unavailable. Check your connection and try again.");
    } finally { if (mounted.current) setLoading(false); }
  }

  useEffect(() => {
    mounted.current = true; void loadFactors();
    return () => { mounted.current = false; };
  }, []);

  async function handleVerify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (locked.current) return;
    if (!factor || !/^\d{6}$/.test(code)) { setError("Enter the 6-digit code from your authenticator app."); return; }
    locked.current = true; setError(null); setPending(true);
    try {
      const supabase = createClient();
      const challenge = await supabase.auth.mfa.challenge({ factorId: factor.id });
      if (challenge.error) { setError("The authenticator challenge could not be started. Try again."); return; }
      const verification = await supabase.auth.mfa.verify({ challengeId: challenge.data.id, code, factorId: factor.id });
      if (verification.error) { setError("The code was not accepted. Try the current code from your authenticator."); return; }
      const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (assurance.error || assurance.data.currentLevel !== "aal2") {
        setError("Your authenticator session could not be confirmed. Verify again before continuing."); return;
      }
      if (!mounted.current) return;
      setCode("");
      await fetch("/api/security/events", { body: JSON.stringify({ eventType: "auth.mfa.challenge_verified", payload: { factorId: factor.id } }), headers: { "Content-Type": "application/json" }, method: "POST" }).catch(() => undefined);
      await fetch("/api/admin/mfa-suggestion", { cache: "no-store" }).catch(() => undefined);
      if (!mounted.current) return;
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
      <h1 className="admin-page-header__title">Verify MFA</h1>
      <p className="admin-page-header__desc">Enter the current six-digit code from your authenticator app to finish verification and return to your work.</p>
    </div></div>
    <article className="glass-card grid gap-5 p-6" aria-busy={loading || pending}>
      {loading ? <p className="section-copy" role="status">Checking your enrolled factors...</p> : factor ? <form className="grid max-w-md gap-4" onSubmit={handleVerify}>
        <p className="status-pill w-fit">{factor.friendly_name || "Verified authenticator"}</p>
        <label className="input-label" htmlFor="admin-mfa-code">Verification code
          <input autoComplete="one-time-code" id="admin-mfa-code" inputMode="numeric" maxLength={6} pattern="[0-9]{6}" disabled={pending} onChange={event => setCode(event.target.value)} placeholder="123456" required value={code} />
        </label>
        <button className="primary-button" disabled={pending} type="submit">{pending ? "Verifying..." : "Verify and continue"}</button>
      </form> : !error ? <div className="grid gap-4">
        <p className="section-copy">No verified authenticator is enrolled for this account. Set one up to continue.</p>
        <Link className="primary-button w-fit" href={`/admin/mfa/setup?next=${encodeURIComponent(safeAdminVerificationReturnPath(returnPath))}`}>Set up MFA</Link>
      </div> : null}
      {error ? <p role="alert" className="text-sm font-semibold text-[var(--brand-rust)]">{error}</p> : null}
      {!loading && !factor && error ? <button className="secondary-button w-fit" type="button" onClick={() => void loadFactors()}>Try again</button> : null}
    </article>
  </section>;
}
