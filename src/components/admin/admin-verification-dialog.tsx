"use client";

import { useEffect, useId, useRef, useState } from "react";
import { TurnstileField } from "@/components/auth/turnstile-field";
import { createClient } from "@/utils/supabase/client";
import { adminOperationRegistry } from "@/lib/auth/admin-verification/operations";
import { adminVerificationUiMessage, emailChallengeResponse, requestAdminVerification, verificationDecisionResponse, verificationProofResponse } from "@/lib/auth/admin-verification/client";
import type { AdminOperationIntent, VerificationProof } from "@/lib/auth/admin-verification/types";
import { AdminMFASetup } from "./admin-mfa-setup";

export function AdminVerificationDialog({ intent, onVerified, onCancel }: {
  intent: AdminOperationIntent; onVerified: (proof?: VerificationProof) => void; onCancel: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const mounted = useRef(false); const locked = useRef(false);
  const verifiedCallback = useRef(onVerified); verifiedCallback.current = onVerified;
  const [phase, setPhase] = useState<"loading" | "choice" | "email" | "totp" | "password" | "setup">("loading");
  const [pending, setPending] = useState(false); const [error, setError] = useState("");
  const [emailAllowed, setEmailAllowed] = useState(false);
  const [code, setCode] = useState(""); const [password, setPassword] = useState("");
  const [challengeId, setChallengeId] = useState(""); const [factorId, setFactorId] = useState("");
  const [resendAt, setResendAt] = useState(0);
  const [captcha, setCaptcha] = useState({ required: true, siteKey: "" });
  const [captchaToken, setCaptchaToken] = useState(""); const [captchaRevision, setCaptchaRevision] = useState(0);
  const title = useId();
  const roleOperation = adminOperationRegistry[intent.operation].kind === "admin_role";

  async function prepare() {
    const result = await requestAdminVerification({ action: "prepare", intent }, verificationDecisionResponse);
    if (!mounted.current) return;
    if (!result.ok) { setError(adminVerificationUiMessage(result.code)); setPhase("choice"); setEmailAllowed(false); return; }
    const decision = result.value.decision;
    if (decision.status === "allowed" && !roleOperation) { verifiedCallback.current(); return; }
    if (decision.status === "denied" || decision.status === "allowed") {
      setError(adminVerificationUiMessage(decision.status === "denied" ? decision.code : "verification_unavailable"));
      setPhase("choice"); setEmailAllowed(false); return;
    }
    setEmailAllowed(!roleOperation && decision.methods.includes("email"));
    setCaptcha(result.value.captcha ?? { required: true, siteKey: "" });
    setPhase(decision.methods.includes("password") && roleOperation ? "password" : "choice");
  }

  useEffect(() => {
    mounted.current = true;
    const element = dialog.current; const previous = document.activeElement as HTMLElement | null;
    if (element?.showModal) element.showModal(); else element?.setAttribute("open", "");
    void prepare();
    return () => { mounted.current = false; if (element?.open && element.close) element.close(); previous?.focus(); };
    // The parent keys this dialog by one immutable captured intent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function work(task: () => Promise<void>) {
    if (locked.current) return;
    locked.current = true; setPending(true); setError("");
    try { await task(); } catch { if (mounted.current) setError(adminVerificationUiMessage("verification_unavailable")); }
    finally { locked.current = false; if (mounted.current) setPending(false); }
  }
  async function sendEmail() {
    if (!emailAllowed || roleOperation) return;
    if (Date.now() < resendAt) { setError("Wait at least 60 seconds before requesting another code."); return; }
    const result = await requestAdminVerification({ action: "email_send", intent }, emailChallengeResponse);
    if (!mounted.current) return;
    if (!result.ok) { setError(adminVerificationUiMessage(result.code)); return; }
    setChallengeId(result.value.challengeId); setResendAt(Date.now() + 60_000); setCode(""); setPhase("email");
  }
  async function chooseAuthenticator() {
    const result = await createClient().auth.mfa.listFactors();
    if (!mounted.current) return;
    if (result.error) { setError(adminVerificationUiMessage("verification_unavailable")); return; }
    const factor = result.data.totp.find(item => item.status === "verified");
    if (!factor) { setPhase("setup"); return; }
    setFactorId(factor.id); setCode(""); setPhase("totp");
  }
  async function verifyCode() {
    if (!/^\d{6}$/.test(code)) { setError("Enter the six-digit code."); return; }
    if (phase === "email") {
      const result = await requestAdminVerification({ action: "email_verify", challengeId, code }, verificationProofResponse);
      if (!mounted.current) return;
      if (!result.ok) { setError(adminVerificationUiMessage(result.code)); return; }
      if (Date.parse(result.value.expiresAt) <= Date.now()) { setError(adminVerificationUiMessage("verification_expired")); return; }
      setCode(""); verifiedCallback.current(result.value); return;
    }
    const supabase = createClient();
    const challenge = await supabase.auth.mfa.challenge({ factorId });
    if (challenge.error) { setError("The authenticator challenge could not be started. Try again."); return; }
    const verified = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.data.id, code });
    if (verified.error) { setError("The authenticator code was not accepted. Try the current code."); return; }
    setCode(""); await prepare(); // Original session now has real MFA; server rechecks policy.
  }
  async function verifyPassword() {
    if (!password) { setError("Enter your current password."); return; }
    const result = await requestAdminVerification({ action: "password_verify", intent, password, captchaToken }, verificationProofResponse);
    setPassword(""); setCaptchaToken(""); setCaptchaRevision(value => value + 1);
    if (!mounted.current) return;
    if (!result.ok) { setError(adminVerificationUiMessage(result.code)); return; }
    if (Date.parse(result.value.expiresAt) <= Date.now()) { setError(adminVerificationUiMessage("verification_expired")); return; }
    verifiedCallback.current(result.value);
  }

  return <dialog ref={dialog} aria-modal="true" aria-labelledby={title} aria-busy={pending || phase === "loading"} className="admin-verification-dialog" onCancel={event => { event.preventDefault(); event.stopPropagation(); if (!locked.current) onCancel(); }} onKeyDown={event => {
    if (event.key !== "Tab") return;
    const controls = [...(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), a[href]') ?? [])].filter(element => !element.hasAttribute("hidden") && element.getAttribute("type") !== "hidden");
    const first = controls[0]; const last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }}>
    <h2 id={title} className="text-xl font-semibold">Verify your account</h2>
    <p className="section-copy">{adminOperationRegistry[intent.operation].label}. {roleOperation ? "Admin access changes require your authenticator and current password." : "Verification applies only to this operation."}</p>
    {phase === "loading" ? <p role="status">Checking account protection…</p> : null}
    {phase === "choice" ? <div className="flex flex-wrap gap-3">
      <button className="primary-button" disabled={pending} onClick={() => void work(chooseAuthenticator)} type="button">Verify authenticator</button>
      {emailAllowed && !roleOperation ? <button className="secondary-button" disabled={pending} onClick={() => void work(sendEmail)} type="button">Verify by email</button> : null}
    </div> : null}
    {phase === "email" || phase === "totp" ? <form className="grid gap-4" onSubmit={event => { event.preventDefault(); void work(verifyCode); }}>
      <label className="input-label">{phase === "email" ? "Email code" : "Authenticator code"}<input autoFocus autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required value={code} disabled={pending} onChange={event => setCode(event.target.value)} /></label>
      {phase === "email" ? <p className="section-copy">Sent to your confirmed account email. The code expires in five minutes.</p> : null}
      <button className="primary-button" disabled={pending} type="submit">{pending ? "Verifying…" : "Verify and continue"}</button>
      {phase === "email" ? <button className="ghost-button" disabled={pending} onClick={() => void work(sendEmail)} type="button">Send a new code</button> : null}
    </form> : null}
    {phase === "password" ? <form className="grid gap-4" onSubmit={event => { event.preventDefault(); void work(verifyPassword); }}>
      <label className="input-label">Current password<input autoFocus autoComplete="current-password" type="password" value={password} required disabled={pending} onChange={event => setPassword(event.target.value)} /></label>
      {captcha.required && captcha.siteKey ? <TurnstileField key={captchaRevision} siteKey={captcha.siteKey} onTokenChange={setCaptchaToken} /> : null}
      {captcha.required && !captcha.siteKey ? <p role="alert">Account verification is temporarily unavailable. Contact an administrator.</p> : null}
      <button className="primary-button" disabled={pending || (captcha.required && !captchaToken)} type="submit">{pending ? "Verifying…" : "Verify password and continue"}</button>
    </form> : null}
    {phase === "setup" ? <AdminMFASetup onVerified={() => void work(prepare)} /> : null}
    {error ? <p role="alert" className="text-sm text-[var(--brand-rust)]">{error}</p> : null}
    <button className="ghost-button" disabled={pending} onClick={onCancel} type="button">Cancel verification</button>
  </dialog>;
}
