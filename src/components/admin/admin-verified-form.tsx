"use client";
import { useRef, useState, useTransition, type ReactNode } from "react";
import type { AdminOperationIntent, VerificationProof } from "@/lib/auth/admin-verification/types";
import { adminVerificationUiMessage, captureAdminFormIntent } from "@/lib/auth/admin-verification/client";
import { AdminVerificationDialog } from "./admin-verification-dialog";

export function AdminVerifiedForm({ intent, action, children, className }: {
  intent: AdminOperationIntent; action: (form: FormData) => void | Promise<unknown>; children: ReactNode; className?: string;
}) {
  const locked = useRef(false); const [pending, startTransition] = useTransition();
  const capturedForm = useRef<FormData | null>(null);
  const [submission, setSubmission] = useState<{ intent: AdminOperationIntent; form: FormData } | null>(null);
  const [error, setError] = useState("");
  const busy = pending || submission !== null;
  function cancel() { capturedForm.current = null; setSubmission(null); locked.current = false; }
  function verified(proof?: VerificationProof) {
    if (!submission || pending || !capturedForm.current) return;
    const captured = capturedForm.current;
    capturedForm.current = null;
    if (proof) captured.set("verificationProof", proof.token);
    setSubmission(null);
    startTransition(async () => {
      try { await action(captured); }
      finally { captured.delete("verificationProof"); locked.current = false; }
    });
  }
  return <div className="contents">
    <form className={className} onSubmit={event => {
      event.preventDefault(); if (locked.current) return;
      const form = new FormData(event.currentTarget);
      form.delete("verificationProof");
      const captured = captureAdminFormIntent(intent, form);
      if (!captured.ok) { setError(adminVerificationUiMessage(captured.code)); return; }
      locked.current = true; capturedForm.current = form; setError(""); setSubmission({ intent: captured.value, form });
    }}>
      <fieldset className="contents" disabled={busy}>{children}</fieldset>
      {error ? <p role="alert">{error}</p> : null}
    </form>
    {submission ? <AdminVerificationDialog intent={submission.intent} onVerified={verified} onCancel={cancel} /> : null}
  </div>;
}
