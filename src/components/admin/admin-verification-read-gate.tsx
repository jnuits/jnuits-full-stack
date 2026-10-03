"use client";
import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { AdminOperation } from "@/lib/auth/admin-verification/types";
import { AdminVerificationDialog } from "./admin-verification-dialog";

/** Denied server reads only. Protected children are never mounted here. */
export function AdminVerificationReadGate({ operation, onVerified }: { operation: AdminOperation; children?: ReactNode; onVerified?: () => Promise<void> }) {
  const [open, setOpen] = useState(false); const router = useRouter();
  const [pending, setPending] = useState(false); const [error, setError] = useState("");
  async function verified() {
    setOpen(false);
    if (!onVerified) { router.refresh(); return; }
    setPending(true); setError("");
    try { await onVerified(); }
    catch { setError("Protected information could not be loaded. Verify again or refresh the page; no operation was repeated."); }
    finally { setPending(false); }
  }
  return <section className="flash-panel grid gap-4" data-tone="warning">
    <h1 className="text-xl font-semibold">Verify to view this page</h1>
    <p className="section-copy">Protected information stays hidden until your account is verified.</p>
    <button className="primary-button w-fit" disabled={pending} onClick={() => setOpen(true)} type="button">{pending ? "Loading verified information…" : "Verify account"}</button>
    {error ? <p role="alert">{error}</p> : null}
    {open ? <AdminVerificationDialog intent={{ operation, payload: {} }} onCancel={() => setOpen(false)} onVerified={() => void verified()} /> : null}
  </section>;
}
