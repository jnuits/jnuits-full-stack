"use client";
import { useEffect, useRef, useState } from "react";

export function AdminMfaSuggestion() {
  const [show, setShow] = useState(false); const [pending, setPending] = useState(false); const locked = useRef(false);
  useEffect(() => {
    let active = true;
    void fetch("/api/admin/mfa-suggestion", { cache: "no-store" }).then(async response => {
      const data = await response.json(); if (active && response.ok && data?.ok === true && data.value?.show === true) setShow(true);
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);
  async function snooze() {
    if (locked.current) return; locked.current = true; setPending(true);
    try {
      const response = await fetch("/api/admin/mfa-suggestion", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "snooze" }), cache: "no-store" });
      const data = await response.json(); if (response.ok && data?.ok === true && data.value?.show === false) setShow(false);
    } catch { /* Suggestion failure must never block routine work. */ }
    finally { locked.current = false; setPending(false); }
  }
  if (!show) return null;
  return <aside className="flash-panel flex flex-wrap items-center justify-between gap-3" aria-label="Optional account protection">
    <p className="text-sm">Protect your admin account — enable MFA.</p>
    <div className="flex flex-wrap gap-3"><a className="admin-btn admin-btn--secondary" href="/admin/mfa/setup">Set up authenticator</a><button className="admin-btn admin-btn--ghost" disabled={pending} onClick={() => void snooze()} type="button">Remind me in 7 days</button></div>
  </aside>;
}
