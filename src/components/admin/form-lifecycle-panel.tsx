"use client";

import { useState } from "react";
import {
  availableFormLifecycleActions,
  formLifecycleActionLabel,
  type FormLifecycleAction,
  type ManagedFormLifecycle,
} from "@/lib/forms/lifecycle-actions";
import {
  useFormInventory,
  type FormInventoryItem,
} from "@/components/admin/form-inventory-context";

export function FormLifecyclePanel() {
  const { error, forms, loading, refresh } = useFormInventory();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function transition(form: FormInventoryItem, target: FormLifecycleAction) {
    const destructive = target === "archived";
    if (
      destructive &&
      !window.confirm(
        `Archive ${form.title}? Archived forms cannot be reopened or edited.`
      )
    ) {
      return;
    }

    setPendingId(form.id);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/forms/${form.id}/lifecycle`, {
        body: JSON.stringify({ target }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as
        | { error?: string; lifecycle?: ManagedFormLifecycle; success?: boolean }
        | null;
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || "The form lifecycle could not be updated.");
      }

      setMessage(`${form.title} is now ${payload.lifecycle}.`);
      // Shared inventory, so the studio and review panels update together.
      await refresh();
    } catch (caught) {
      setMessage(
        caught instanceof Error
          ? caught.message
          : "The form lifecycle could not be updated."
      );
    } finally {
      setPendingId(null);
    }
  }

  const notice = message || error;

  return (
    <section className="admin-review-card mt-6" aria-labelledby="form-lifecycle-heading">
      <p className="admin-section-label">Intake controls</p>
      <h2 className="admin-card-row__title" id="form-lifecycle-heading">
        Close, reopen, or archive forms
      </h2>
      <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
        Closing preserves the published version and existing submissions while hiding
        new public intake. Archiving is terminal.
      </p>

      {notice ? (
        <p
          className={error ? "status-pill status-pill--danger mt-4" : "status-pill mt-4"}
          role={error ? "alert" : "status"}
          aria-live="polite"
        >
          {notice}
        </p>
      ) : null}

      {loading ? (
        <p className="mt-4 text-sm text-[var(--muted-foreground)]">Loading forms…</p>
      ) : forms.length ? (
        <div className="mt-4 grid gap-3">
          {forms.map((form) => {
            const actions = availableFormLifecycleActions(
              form.lifecycle,
              Boolean(form.currentPublishedVersionId)
            );
            return (
              <article className="rounded-xl border border-[var(--line)] p-4" key={form.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-[var(--brand-ink)]">{form.title}</h3>
                    <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                      {form.kind.replaceAll("_", " ")} · {form.lifecycle}
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    {actions.map((action) => (
                      <button
                        className={
                          action === "archived"
                            ? "admin-btn admin-btn--danger"
                            : "admin-btn admin-btn--ghost"
                        }
                        disabled={pendingId === form.id}
                        key={action}
                        onClick={() => void transition(form, action)}
                        type="button"
                      >
                        {pendingId === form.id
                          ? "Updating…"
                          : formLifecycleActionLabel(action)}
                      </button>
                    ))}
                    {!actions.length ? (
                      <span className="status-pill status-pill--danger">No further actions</span>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <p className="mt-4 text-sm text-[var(--muted-foreground)]">
          No form definitions exist yet.
        </p>
      )}
    </section>
  );
}
