"use client";

import Link from "next/link";
import { Copy, Eye, GripVertical, Plus, Send, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { FormDefinitionSchema } from "@/lib/forms/definition";
import {
  createUniqueStudioFieldId,
  duplicateStudioField,
  formDefinitionToStudioFields,
  studioFieldsToDefinition,
  type StudioEditorField,
  type StudioFieldType,
} from "@/lib/forms/form-studio-definition";
import { moveItem } from "@/lib/forms/field-order";

type FormKind = "alumni_onboarding" | "event_registration" | "membership_application";
type FormSummary = {
  id: string;
  kind: FormKind;
  lifecycle: "archived" | "draft" | "published";
  slug: string;
  title: string;
  updatedAt?: string;
};
type Draft = { formDefinitionId: string; formVersionId: string };
type EditorPayload = {
  description: string;
  id: string;
  kind: FormKind;
  lifecycle: FormSummary["lifecycle"];
  linkedEventId: null | string;
  slug: string;
  title: string;
  version: {
    applicationBehavior: unknown;
    fieldSchema: unknown;
    id: string;
    lifecycle: "draft" | "published";
    versionNumber: number;
  } | null;
};

const KINDS: Record<FormKind, string> = {
  event_registration: "Event registration",
  membership_application: "Membership application",
  alumni_onboarding: "Alumni onboarding",
};
const TYPES: Record<StudioFieldType, string> = {
  section: "Section heading",
  text: "Short answer",
  textarea: "Paragraph",
  email: "Email",
  telephone: "Telephone",
  number: "Number",
  date: "Date",
  select: "Dropdown",
  multi_select: "Checkbox choices",
  checkbox: "Checkbox",
  consent: "Required consent",
  image: "Image upload",
  pdf: "PDF upload",
};

function starterFields(kind: FormKind): StudioEditorField[] {
  const common: StudioEditorField[] = [
    { id: "full_name", label: "Full name", optionsText: "", required: true, type: "text" },
    { id: "email", label: "Email address", optionsText: "", required: true, type: "email" },
  ];
  const consent: StudioEditorField = {
    id: "consent",
    label: kind === "event_registration" ? "I agree to the event terms." : "I confirm that these details are accurate.",
    optionsText: "",
    required: true,
    type: "consent",
  };
  if (kind === "membership_application") return [
    ...common,
    { id: "student_id", label: "Student ID", optionsText: "", required: false, type: "text" },
    { id: "department_code", label: "Department", optionsText: "", required: false, type: "text" },
    { id: "batch_label", label: "Batch", optionsText: "", required: false, type: "text" },
    { id: "phone", label: "Phone number", optionsText: "", required: false, type: "telephone" },
    consent,
  ];
  if (kind === "alumni_onboarding") return [
    ...common,
    { id: "jnuits_id", label: "Previous JnUITS ID", optionsText: "", required: false, type: "text" },
    { id: "phone", label: "Phone number", optionsText: "", required: false, type: "telephone" },
    consent,
  ];
  return [...common, { id: "phone", label: "Phone number", optionsText: "", required: false, type: "telephone" }, consent];
}

function defaultMapping(kind: FormKind) {
  return {
    email: "email",
    fullName: "full_name",
    ...(kind === "membership_application"
      ? { studentId: "student_id", departmentCode: "department_code", batchLabel: "batch_label", phone: "phone" }
      : kind === "alumni_onboarding" ? { jnuitsId: "jnuits_id", phone: "phone" } : { phone: "phone" }),
  };
}

function slugify(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

export function ModernFormStudioScreen() {
  const [kind, setKind] = useState<FormKind>("membership_application");
  const [title, setTitle] = useState("Membership application");
  const [slug, setSlug] = useState("membership-application");
  const [description, setDescription] = useState("Submit your details for JnUITS membership review.");
  const [linkedEventId, setLinkedEventId] = useState("");
  const [fields, setFields] = useState<StudioEditorField[]>(() => starterFields("membership_application"));
  const [mapping, setMapping] = useState<Record<string, string>>(() => defaultMapping("membership_application"));
  const [forms, setForms] = useState<FormSummary[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState<"load" | "publish" | "save" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const [slugEdited, setSlugEdited] = useState(false);

  const mappable = useMemo(() => fields.filter((field) => !["section", "consent"].includes(field.type)), [fields]);
  const canSave = title.trim() && slug.trim() && fields.every((field) => field.label.trim());

  async function refresh() {
    const response = await fetch("/api/admin/forms?pageSize=25", { cache: "no-store" });
    const payload = (await response.json().catch(() => null)) as { error?: string; items?: FormSummary[] } | null;
    if (!response.ok) throw new Error(payload?.error || "Forms could not be loaded.");
    setForms(payload?.items || []);
  }

  useEffect(() => { void refresh().catch((error) => setMessage(error instanceof Error ? error.message : "Forms could not be loaded.")); }, []);

  function chooseKind(nextKind: FormKind) {
    setKind(nextKind);
    setTitle(KINDS[nextKind]);
    setSlug(nextKind.replaceAll("_", "-"));
    setSlugEdited(false);
    setDescription(nextKind === "event_registration" ? "Register for this JnUITS event." : nextKind === "alumni_onboarding" ? "Request alumni onboarding and account claim access." : "Submit your details for JnUITS membership review.");
    setFields(starterFields(nextKind));
    setMapping(defaultMapping(nextKind));
    setDraft(null);
    setEditingId(null);
  }

  function updateField(index: number, update: Partial<StudioEditorField>) {
    setFields((current) => current.map((field, position) => position === index ? { ...field, ...update } : field));
  }

  function addQuestion() {
    setFields((current) => [...current, {
      id: createUniqueStudioFieldId("New question", current.map((field) => field.id)),
      label: "New question",
      optionsText: "",
      required: false,
      type: "text",
    }]);
  }

  function duplicateQuestion(index: number) {
    setFields((current) => {
      const copy = duplicateStudioField(current[index], current.map((field) => field.id));
      return [...current.slice(0, index + 1), copy, ...current.slice(index + 1)];
    });
  }

  async function openForm(id: string) {
    setBusy("load"); setMessage(null);
    try {
      const response = await fetch(`/api/admin/forms/${id}/versions`, { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as (EditorPayload & { error?: string }) | null;
      if (!response.ok || !payload?.version) throw new Error(payload?.error || "The form could not be opened.");
      const definition = FormDefinitionSchema.safeParse(payload.version.fieldSchema);
      if (!definition.success) throw new Error("This form uses an invalid legacy schema. Repair it before editing.");
      setKind(payload.kind); setTitle(payload.title); setSlug(payload.slug); setSlugEdited(true);
      setDescription(payload.description); setLinkedEventId(payload.linkedEventId || "");
      setFields(formDefinitionToStudioFields(definition.data)); setEditingId(payload.id);
      const behavior = payload.version.applicationBehavior as { fieldMapping?: Record<string, string> } | null;
      setMapping({ ...defaultMapping(payload.kind), ...(behavior?.fieldMapping || {}) });
      setDraft(payload.version.lifecycle === "draft" ? { formDefinitionId: payload.id, formVersionId: payload.version.id } : null);
      setMessage(payload.version.lifecycle === "draft" ? "Draft resumed." : "Published form loaded. Saving creates a new draft version.");
    } finally { setBusy(null); }
  }

  async function save() {
    setBusy("save"); setMessage(null);
    try {
      const version = { applicationBehavior: { fieldMapping: mapping }, definition: studioFieldsToDefinition(fields) };
      const response = editingId
        ? await fetch(`/api/admin/forms/${editingId}/versions`, {
            body: JSON.stringify(draft ? { ...version, formVersionId: draft.formVersionId } : version),
            headers: { "Content-Type": "application/json" }, method: draft ? "PATCH" : "POST",
          })
        : await fetch("/api/admin/forms", {
            body: JSON.stringify({ ...version, description, kind, linkedEventId: kind === "event_registration" ? linkedEventId || null : null, slug, title }),
            headers: { "Content-Type": "application/json" }, method: "POST",
          });
      const payload = (await response.json().catch(() => null)) as { error?: string; formDefinitionId?: string; formVersionId?: string } | null;
      if (!response.ok || !payload?.formVersionId) throw new Error(payload?.error || "The draft could not be saved.");
      const definitionId = editingId || payload.formDefinitionId;
      if (!definitionId) throw new Error("The draft identifier is missing.");
      setEditingId(definitionId); setDraft({ formDefinitionId: definitionId, formVersionId: payload.formVersionId });
      setMessage("Draft saved. Review it before publishing."); await refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "The draft could not be saved."); }
    finally { setBusy(null); }
  }

  async function publish() {
    if (!draft || !window.confirm("Publish this version? Published versions are immutable.")) return;
    setBusy("publish"); setMessage(null);
    try {
      const response = await fetch(`/api/admin/forms/${draft.formDefinitionId}/publish`, {
        body: JSON.stringify({ formVersionId: draft.formVersionId }), headers: { "Content-Type": "application/json" }, method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as { error?: string; success?: boolean } | null;
      if (!response.ok || !payload?.success) throw new Error(payload?.error || "The form could not be published.");
      setMessage("Form published. You can now preview or share the public link."); await refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "The form could not be published."); }
    finally { setBusy(null); }
  }

  async function copyLink(form: FormSummary) {
    try {
      await navigator.clipboard.writeText(new URL(`/forms/${form.slug}`, window.location.origin).toString());
      setMessage("Published form link copied.");
    } catch { setMessage("The link could not be copied. Open the preview and copy it from the address bar."); }
  }

  return <div className="grid gap-7">
    <header className="admin-page-header"><div><p className="admin-page-header__breadcrumb">Admin / Content</p><h1 className="admin-page-header__title">Form Studio</h1><p className="admin-page-header__desc">Create polished forms without schema IDs or provider settings. Save a draft, preview it, then publish when ready.</p></div></header>
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(19rem,.55fr)]">
      <section className="admin-review-card grid gap-5" aria-labelledby="builder-heading">
        <div><p className="admin-section-label">{editingId ? "Edit form" : "Create form"}</p><h2 className="admin-card-row__title" id="builder-heading">Questions and settings</h2></div>
        <div className="grid gap-4 sm:grid-cols-2"><label className="input-label">Form type<select disabled={Boolean(editingId)} value={kind} onChange={(event) => chooseKind(event.target.value as FormKind)}>{Object.entries(KINDS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="input-label">Public address<input disabled={Boolean(editingId)} value={slug} onChange={(event) => { setSlugEdited(true); setSlug(slugify(event.target.value)); }} required /><span className="mt-1 block text-xs font-normal text-[var(--muted-foreground)]">/forms/{slug || "your-form"}</span></label></div>
        <label className="input-label">Form title<input disabled={Boolean(editingId)} value={title} onChange={(event) => { setTitle(event.target.value); if (!slugEdited) setSlug(slugify(event.target.value)); }} required /></label>
        <label className="input-label">Description<textarea disabled={Boolean(editingId)} rows={3} value={description} onChange={(event) => setDescription(event.target.value)} /></label>
        {kind === "event_registration" ? <label className="input-label">Linked event<input value={linkedEventId} disabled={Boolean(editingId)} onChange={(event) => setLinkedEventId(event.target.value)} placeholder="Event selection is being upgraded; paste the event ID for now" required /></label> : <section className="rounded-xl border border-[var(--line)] p-4"><p className="admin-section-label">Application details</p><div className="mt-3 grid gap-3 sm:grid-cols-2">{Object.entries(mapping).map(([key, value]) => <label className="input-label" key={key}>{key.replace(/([A-Z])/g, " $1")}<select value={value} onChange={(event) => setMapping((current) => ({ ...current, [key]: event.target.value }))}><option value="">Not collected</option>{mappable.map((field) => <option key={field.id} value={field.id}>{field.label}</option>)}</select></label>)}</div></section>}
        <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="admin-section-label">Questions</p><p className="mt-1 text-sm text-[var(--muted-foreground)]">Question IDs are generated automatically and stay stable after saving.</p></div><button className="admin-btn admin-btn--ghost" onClick={addQuestion} type="button"><Plus size={15} /> Add question</button></div>
        <div className="grid gap-3">{fields.map((field, index) => <article className="rounded-xl border border-[var(--line)] bg-[var(--bg)] p-4" key={field.id}><div className="mb-3 flex items-center justify-between gap-3"><span className="inline-flex items-center gap-2 text-xs text-[var(--muted-foreground)]"><GripVertical size={14} /> Question {index + 1}</span><details><summary className="cursor-pointer text-xs font-semibold">Advanced details</summary><code className="mt-2 block text-xs">ID: {field.id}</code></details></div><div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_12rem_auto]"><label className="input-label">Question<input value={field.label} onChange={(event) => updateField(index, { label: event.target.value })} required /></label><label className="input-label">Question type<select value={field.type} onChange={(event) => updateField(index, { required: event.target.value === "consent" || field.required, type: event.target.value as StudioFieldType })}>{Object.entries(TYPES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><div className="flex flex-wrap items-end gap-2"><button aria-label={`Move ${field.label} up`} className="admin-btn admin-btn--ghost" disabled={index === 0} onClick={() => setFields((current) => moveItem(current, index, index - 1))} type="button">↑</button><button aria-label={`Move ${field.label} down`} className="admin-btn admin-btn--ghost" disabled={index === fields.length - 1} onClick={() => setFields((current) => moveItem(current, index, index + 1))} type="button">↓</button><button className="admin-btn admin-btn--ghost" onClick={() => duplicateQuestion(index)} type="button">Duplicate</button><button aria-label={`Remove ${field.label}`} className="admin-btn admin-btn--danger" disabled={fields.length === 1} onClick={() => setFields((current) => current.filter((_, position) => position !== index))} type="button"><Trash2 size={15} /></button></div></div>{!["section", "consent"].includes(field.type) ? <label className="mt-3 flex min-h-11 items-center gap-2 text-sm font-semibold"><input checked={field.required} onChange={(event) => updateField(index, { required: event.target.checked })} type="checkbox" /> Required</label> : null}{["select", "multi_select"].includes(field.type) ? <label className="input-label mt-3 block">Choices, one per line<textarea rows={4} value={field.optionsText} onChange={(event) => updateField(index, { optionsText: event.target.value })} /></label> : null}{["image", "pdf"].includes(field.type) ? <label className="input-label mt-3 block">Maximum files<input min={1} max={5} type="number" value={field.maxFiles ?? 1} onChange={(event) => updateField(index, { maxFiles: Math.min(5, Math.max(1, Number(event.target.value) || 1)) })} /></label> : null}</article>)}</div>
        {preview ? <section className="rounded-2xl border border-[var(--line)] bg-[var(--bg)] p-5" aria-label="Form preview"><p className="admin-section-label">Respondent preview</p><h3 className="mt-2 text-2xl font-semibold">{title}</h3><p className="mt-1 text-sm text-[var(--muted-foreground)]">{description}</p><div className="mt-5 grid gap-4">{fields.map((field) => <div key={field.id}><p className="font-semibold">{field.label}{field.required ? " *" : ""}</p><p className="mt-1 text-sm text-[var(--muted-foreground)]">{TYPES[field.type]}</p></div>)}</div></section> : null}
        {message ? <p className="status-pill" role="status" aria-live="polite">{message}</p> : null}
        <div className="flex flex-wrap justify-end gap-3"><button className="admin-btn admin-btn--ghost" onClick={() => setPreview((value) => !value)} type="button"><Eye size={15} /> {preview ? "Hide preview" : "Preview"}</button><button className="admin-btn admin-btn--primary" disabled={busy !== null || !canSave} onClick={() => void save()} type="button"><Plus size={15} /> {busy === "save" ? "Saving…" : draft ? "Save draft" : "Create draft"}</button>{draft ? <button className="admin-btn admin-btn--primary" disabled={busy !== null} onClick={() => void publish()} type="button"><Send size={15} /> {busy === "publish" ? "Publishing…" : "Publish"}</button> : null}</div>
      </section>
      <aside className="grid content-start gap-4"><section className="admin-review-card"><p className="admin-section-label">Your forms</p><h2 className="admin-card-row__title">Edit, share, and export</h2>{forms.length ? <div className="mt-4 grid gap-3">{forms.map((form) => <article className="rounded-xl border border-[var(--line)] p-3" key={form.id}><div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold">{form.title}</h3><p className="mt-1 text-xs text-[var(--muted-foreground)]">{KINDS[form.kind]} · {form.lifecycle}</p></div></div>{form.lifecycle !== "archived" ? <button className="queue-link mt-3" disabled={busy === "load"} onClick={() => void openForm(form.id)} type="button">{form.lifecycle === "draft" ? "Resume draft" : "Edit"}</button> : null}{form.lifecycle === "published" ? <div className="mt-3 flex flex-wrap gap-3"><Link className="queue-link" href={`/forms/${form.slug}`} target="_blank">Preview</Link><button className="queue-link" onClick={() => void copyLink(form)} type="button"><Copy size={13} /> Share link</button><Link className="queue-link" href={`/admin/content/forms?review=${form.id}`}>Review responses</Link>{form.kind !== "event_registration" ? <><a className="queue-link" href={`/api/admin/forms/${form.id}/submissions/export?format=csv`}>CSV</a><a className="queue-link" href={`/api/admin/forms/${form.id}/submissions/export?format=xlsx`}>XLSX</a></> : null}</div> : null}</article>)}</div> : <p className="mt-4 text-sm text-[var(--muted-foreground)]">No forms yet. Create your first draft.</p>}</section></aside>
    </div>
  </div>;
}
