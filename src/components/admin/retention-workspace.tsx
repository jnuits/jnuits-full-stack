"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AdminOperationIntent, VerificationProof } from "@/lib/auth/admin-verification/types";
import { AdminVerificationDialog } from "./admin-verification-dialog";
import { AdminVerificationReadGate } from "./admin-verification-read-gate";

type RetentionJob = {
  approvedAt: null | string;
  createdAt: string;
  id: string;
  resourceId: string;
  resourceTitle: null | string;
  retentionEligibleAt: string;
  scope: "event" | "form";
  sourcePiiPurgedAt: null | string;
  status:
    | "archive_requested"
    | "archived"
    | "candidate"
    | "failed"
    | "purge_approved"
    | "purged";
};

type Workspace = {
  archiveConfigured: boolean;
  eventJobs: RetentionJob[];
  formJobs: RetentionJob[];
};

function formatDate(value: null | string) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(date);
}

function actionLabel(job: RetentionJob) {
  if (job.status === "candidate" || job.status === "failed") return "Archive to Drive";
  if (job.status === "archived") return "Approve purge";
  if (job.status === "purge_approved") return "Purge source PII";
  return null;
}

function actionFor(job: RetentionJob) {
  if (job.status === "candidate" || job.status === "failed") return "archive";
  if (job.status === "archived") return "approve_purge";
  if (job.status === "purge_approved") return "purge";
  return null;
}

export function RetentionWorkspace() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [needsRead, setNeedsRead] = useState(false);
  const inFlight = useRef(false);
  const requestRef = useRef<{ intent: AdminOperationIntent; body: Record<string, unknown> } | null>(null);
  const [verification, setVerification] = useState<{ intent: AdminOperationIntent; body: Record<string, unknown> } | null>(null);

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/retention", { cache: "no-store" });
    const payload = (await response.json().catch(() => null)) as
      | (Workspace & { error?: string; code?: string })
      | null;
    if (!response.ok || !payload) {
      if (payload?.code && ["verification_required", "verification_invalid", "verification_expired"].includes(payload.code)) {
        setWorkspace(null); setNeedsRead(true);
      }
      throw new Error(payload?.error || "Retention jobs could not be loaded.");
    }
    setWorkspace(payload);
    setNeedsRead(false);
  }, []);

  useEffect(() => {
    void load().catch((error: unknown) =>
      setMessage(error instanceof Error ? error.message : "Retention jobs could not be loaded.")
    );
  }, [load]);

  async function runAction(
    action: "approve_purge" | "archive" | "discover" | "purge",
    job?: RetentionJob
  ) {
    if (inFlight.current) return;
    if (action === "purge") {
      const confirmation = window.prompt(
        "Archive is complete. Type PURGE to permanently redact source form/registration PII. Cloudinary originals remain retained."
      );
      if (confirmation !== "PURGE") {
        setMessage("Purge cancelled. Exact confirmation phrase was not entered.");
        return;
      }
    }

    const key = job ? `${job.scope}:${job.id}` : "discover";
    setBusyKey(key);
    setMessage(null);
    inFlight.current = true;
    const payload = { ...(job ? { jobId: job.id, scope: job.scope } : {}), ...(action === "purge" ? { confirmation: "PURGE" } : {}) };
    const captured = { intent: { operation: `admin.retention.${action}`, payload } as AdminOperationIntent, body: { action, ...payload } };
    requestRef.current = captured; setVerification(captured);
  }

  async function completeAction(proof?: VerificationProof) {
    const captured = requestRef.current;
    if (!captured) return;
    requestRef.current = null; setVerification(null);

    try {
      const response = await fetch("/api/admin/retention", {
        body: JSON.stringify({
          ...captured.body,
          ...(proof ? { verificationProof: proof.token } : {}),
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as
        | { created?: number; error?: string; success?: boolean }
        | null;
      if (!response.ok || payload?.success !== true) throw new Error(payload?.error || "Retention action failed. Refresh its status before retrying.");
      setMessage(
        captured.body.action === "discover"
          ? `${payload?.created || 0} retention candidate(s) created.`
          : "Retention job updated."
      );
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Retention action failed.");
    } finally {
      setBusyKey(null);
      inFlight.current = false;
    }
  }

  const jobs = workspace ? [...workspace.formJobs, ...workspace.eventJobs] : [];
  if (needsRead) return <AdminVerificationReadGate operation="admin.retention.read" onVerified={async () => { await load(); setMessage(null); }} />;

  return (
    <div className="space-y-6">
      <section className="glass-card p-6 sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <span className="eyebrow">Restricted operations</span>
            <h1 className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
              Data retention
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted-foreground)]">
              Discover records older than three years, archive them to Shared Drive,
              approve purge, then explicitly redact source PII. No automatic deletion.
            </p>
          </div>
          <button
            className="primary-button"
            disabled={busyKey !== null}
            onClick={() => void runAction("discover")}
            type="button"
          >
            {busyKey === "discover" ? "Scanning…" : "Discover candidates"}
          </button>
        </div>

        {workspace && !workspace.archiveConfigured ? (
          <p className="mt-5 rounded-xl border border-amber-300/40 bg-amber-100/10 p-4 text-sm">
            Drive archive or manifest signing is not configured. Discovery remains available;
            archive actions stay disabled.
          </p>
        ) : null}
        {message ? (
          <p aria-live="polite" className="mt-5 text-sm text-[var(--muted-foreground)]">
            {message}
          </p>
        ) : null}
      </section>

      <section className="glass-card p-6 sm:p-8">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">Retention jobs</h2>
          <span className="status-pill">{jobs.length} tracked</span>
        </div>

        {!workspace ? (
          <p className="mt-5 text-sm text-[var(--muted-foreground)]">Loading jobs…</p>
        ) : jobs.length === 0 ? (
          <p className="mt-5 text-sm text-[var(--muted-foreground)]">
            No retention jobs. Run discovery to create eligible candidates only.
          </p>
        ) : (
          <div className="mt-5 grid gap-4">
            {jobs.map((job) => {
              const action = actionFor(job);
              const label = actionLabel(job);
              const busy = busyKey === `${job.scope}:${job.id}`;
              const archiveUnavailable = action === "archive" && !workspace.archiveConfigured;

              return (
                <article className="rounded-2xl border border-[var(--border)] p-4" key={job.id}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium">
                        {job.resourceTitle || job.resourceId}
                      </p>
                      <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                        {job.scope === "form" ? "Form" : "Event"} · eligible {formatDate(job.retentionEligibleAt)}
                        {job.sourcePiiPurgedAt
                          ? ` · purged ${formatDate(job.sourcePiiPurgedAt)}`
                          : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="status-pill">{job.status.replaceAll("_", " ")}</span>
                      {action && label ? (
                        <button
                          className={
                            action === "purge"
                              ? "admin-btn admin-btn--danger"
                              : "secondary-button"
                          }
                          disabled={busyKey !== null || archiveUnavailable}
                          onClick={() => void runAction(action, job)}
                          type="button"
                        >
                          {busy ? "Working…" : label}
                        </button>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
      {verification ? <AdminVerificationDialog intent={verification.intent} onVerified={proof => void completeAction(proof)} onCancel={() => { requestRef.current = null; setVerification(null); setBusyKey(null); inFlight.current = false; }} /> : null}
    </div>
  );
}
