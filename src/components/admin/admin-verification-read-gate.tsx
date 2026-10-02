"use client";
import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { AdminOperation } from "@/lib/auth/admin-verification/types";
import { AdminVerificationDialog } from "./admin-verification-dialog";

/** Denied server reads only. Protected children are never mounted here. */
export function AdminVerificationReadGate({ operation }: { operation: AdminOperation; children?: ReactNode }) {
  const [open, setOpen] = useState(false); const router = useRouter();
  return <section className="flash-panel grid gap-4" data-tone="warning">
    <h1 className="text-xl font-semibold">Verify to view this page</h1>
    <p className="section-copy">Protected information stays hidden until your account is verified.</p>
    <button className="primary-button w-fit" onClick={() => setOpen(true)} type="button">Verify account</button>
    {open ? <AdminVerificationDialog intent={{ operation, payload: {} }} onCancel={() => setOpen(false)} onVerified={() => { setOpen(false); router.refresh(); }} /> : null}
  </section>;
}
