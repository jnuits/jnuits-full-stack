"use client";

import { useState } from "react";
import { FormDefinitionSchema, type FormDefinition } from "@/lib/forms/definition";
import { moveItem } from "@/lib/forms/field-order";

type EditorPayload = {
  id: string;
  version: { applicationBehavior: unknown; fieldSchema: unknown; id: string; lifecycle: "draft" | "published" } | null;
};

export function FormFieldOrderPanel() {
  const [formId, setFormId] = useState("");
  const [definition, setDefinition] = useState<FormDefinition | null>(null);
  const [applicationBehavior, setApplicationBehavior] = useState<unknown>({});
  const [versionId, setVersionId] = useState<string | null>(null);
  const [draft, setDraft] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    setLoading(true); setMessage(null);
    try {
      const response = await fetch(`/api/admin/forms/${encodeURIComponent(formId)}/versions`, { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as (EditorPayload & { error?: string }) | null;
      if (!response.ok || !payload?.version) throw new Error(payload?.error || "The form could not be loaded.");
      const parsed = FormDefinitionSchema.safeParse(payload.version.fieldSchema);
      if (!parsed.success) throw new Error("The stored form schema is invalid.");
      setDefinition(parsed.data); setApplicationBehavior(payload.version.applicationBehavior); setVersionId(payload.version.id); setDraft(payload.version.lifecycle === "draft");
    } catch (error) { setMessage(error instanceof Error ? error.message : "The form could not be loaded."); }
    finally { setLoading(false); }
  }

  async function save() {
    if (!definition || !versionId) return;
    setLoading(true); setMessage(null);
    try {
      const response = await fetch(`/api/admin/forms/${encodeURIComponent(formId)}/versions`, {
        body: JSON.stringify({ applicationBehavior, definition, ...(draft ? { formVersionId: versionId } : {}) }),
        headers: { "Content-Type": "application/json" },
        method: draft ? "PATCH" : "POST",
      });
      const payload = (await response.json().catch(() => null)) as { error?: string; formVersionId?: string } | null;
      if (!response.ok || !payload?.formVersionId) throw new Error(payload?.error || "Field order could not be saved.");
      setVersionId(payload.formVersionId); setDraft(true); setMessage("Field order saved to a draft version. Published submissions remain pinned to their original version.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Field order could not be saved."); }
    finally { setLoading(false); }
  }

  return <section className="admin-review-card mt-6" aria-labelledby="field-order-heading"><p className="admin-section-label">Field ordering</p><h2 className="admin-card-row__title" id="field-order-heading">Reorder an existing form</h2><div className="mt-4 flex flex-wrap gap-3"><label className="input-label min-w-72 flex-1">Form definition ID<input value={formId} onChange={(event) => setFormId(event.target.value)} /></label><button className="admin-btn admin-btn--ghost self-end" disabled={loading || !formId} onClick={() => void load()} type="button">{loading ? "Loading…" : "Load fields"}</button></div>{definition ? <div className="mt-4 grid gap-2">{definition.fields.map((field, index) => <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--line)] p-3" key={field.id}><span><strong>{field.label}</strong><span className="ml-2 text-xs text-[var(--muted-foreground)]">{field.type}</span></span><span className="flex gap-2"><button aria-label={`Move ${field.label} up`} className="admin-btn admin-btn--ghost" disabled={index === 0} onClick={() => setDefinition((current) => current ? { ...current, fields: moveItem(current.fields, index, index - 1) } : current)} type="button">↑</button><button aria-label={`Move ${field.label} down`} className="admin-btn admin-btn--ghost" disabled={index === definition.fields.length - 1} onClick={() => setDefinition((current) => current ? { ...current, fields: moveItem(current.fields, index, index + 1) } : current)} type="button">↓</button></span></div>)}<button className="admin-btn admin-btn--primary justify-self-end" disabled={loading} onClick={() => void save()} type="button">Save field order</button></div> : null}{message ? <p className="status-pill mt-4" role="status">{message}</p> : null}</section>;
}
