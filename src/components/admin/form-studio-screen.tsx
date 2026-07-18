"use client";

import Link from "next/link";
import { Plus, Send, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type FormKind = "alumni_onboarding" | "event_registration" | "membership_application";
type FieldType =
  | "checkbox"
  | "consent"
  | "date"
  | "email"
  | "multi_select"
  | "number"
  | "section"
  | "select"
  | "telephone"
  | "text"
  | "textarea";

type EditorField = {
  id: string;
  label: string;
  optionsText: string;
  required: boolean;
  type: FieldType;
};

type FormSummary = {
  currentPublishedVersionId?: null | string;
  id: string;
  kind: FormKind;
  lifecycle: "archived" | "draft" | "published";
  slug: string;
  title: string;
  updatedAt?: string;
};

type DraftResult = {
  formDefinitionId: string;
  formVersionId: string;
};

const KIND_LABELS: Record<FormKind, string> = {
  alumni_onboarding: "Alumni onboarding",
  event_registration: "Event registration",
  membership_application: "Membership application",
};

const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  checkbox: "Checkbox",
  consent: "Required consent",
  date: "Date",
  email: "Email",
  multi_select: "Multiple choice",
  number: "Number",
  section: "Section heading",
  select: "Select list",
  telephone: "Telephone",
  text: "Short text",
  textarea: "Long text",
};

function fieldsForKind(kind: FormKind): EditorField[] {
  const common = [
    { id: "full_name", label: "Full name", optionsText: "", required: true, type: "text" as const },
    { id: "email", label: "Email address", optionsText: "", required: true, type: "email" as const },
  ];

  if (kind === "membership_application") {
    return [
      ...common,
      { id: "student_id", label: "Student ID", optionsText: "", required: false, type: "text" },
      { id: "department_code", label: "Department", optionsText: "", required: false, type: "text" },
      { id: "batch_label", label: "Batch", optionsText: "", required: false, type: "text" },
      { id: "phone", label: "Phone number", optionsText: "", required: false, type: "telephone" },
      { id: "consent", label: "I confirm that these details are accurate.", optionsText: "", required: true, type: "consent" },
    ];
  }

  if (kind === "alumni_onboarding") {
    return [
      ...common,
      { id: "jnuits_id", label: "Previous JnUITS ID", optionsText: "", required: false, type: "text" },
      { id: "phone", label: "Phone number", optionsText: "", required: false, type: "telephone" },
      { id: "consent", label: "I confirm that these details are accurate.", optionsText: "", required: true, type: "consent" },
    ];
  }

  return [
    ...common,
    { id: "phone", label: "Phone number", optionsText: "", required: false, type: "telephone" },
    { id: "consent", label: "I agree to the event terms.", optionsText: "", required: true, type: "consent" },
  ];
}

function defaultMapping(kind: FormKind) {
  return {
    email: "email",
    fullName: "full_name",
    ...(kind === "membership_application"
      ? {
          batchLabel: "batch_label",
          departmentCode: "department_code",
          phone: "phone",
          studentId: "student_id",
        }
      : kind === "alumni_onboarding"
        ? { jnuitsId: "jnuits_id", phone: "phone" }
        : { phone: "phone" }),
  };
}

function toOptionValue(label: string) {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120);
}

function toDefinition(fields: EditorField[]) {
  return {
    fields: fields.map((field) => {
      if (field.type === "section") {
        return { id: field.id, label: field.label, type: field.type };
      }

      if (field.type === "consent") {
        return { id: field.id, label: field.label, required: true, type: field.type };
      }

      if (field.type === "select" || field.type === "multi_select") {
        const options = field.optionsText
          .split("\n")
          .map((label) => label.trim())
          .filter(Boolean)
          .map((label) => ({ label, value: toOptionValue(label) }));

        return { id: field.id, label: field.label, options, required: field.required, type: field.type };
      }

      return { id: field.id, label: field.label, required: field.required, type: field.type };
    }),
    payment: { enabled: false },
  };
}

function statusClass(lifecycle: FormSummary["lifecycle"]) {
  return lifecycle === "published"
    ? "status-pill"
    : lifecycle === "archived"
      ? "status-pill status-pill--danger"
      : "status-pill";
}

export function FormStudioScreen() {
  const [kind, setKind] = useState<FormKind>("membership_application");
  const [title, setTitle] = useState("Membership application");
  const [slug, setSlug] = useState("membership-application");
  const [description, setDescription] = useState("Submit your details for JnUITS membership review.");
  const [linkedEventId, setLinkedEventId] = useState("");
  const [fields, setFields] = useState<EditorField[]>(() => fieldsForKind("membership_application"));
  const [mapping, setMapping] = useState<Record<string, string>>(() => defaultMapping("membership_application"));
  const [forms, setForms] = useState<FormSummary[]>([]);
  const [isLoadingForms, setIsLoadingForms] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftResult | null>(null);

  const mappableFields = useMemo(
    () => fields.filter((field) => field.type !== "section" && field.type !== "consent"),
    [fields]
  );

  async function refreshForms() {
    setIsLoadingForms(true);
    try {
      const response = await fetch("/api/admin/forms?pageSize=25", { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as
        | { items?: FormSummary[]; error?: string }
        | null;

      if (!response.ok) throw new Error(payload?.error || "Forms could not be loaded.");
      setForms(payload?.items || []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Forms could not be loaded.");
    } finally {
      setIsLoadingForms(false);
    }
  }

  useEffect(() => {
    void refreshForms();
  }, []);

  function changeKind(nextKind: FormKind) {
    setKind(nextKind);
    setFields(fieldsForKind(nextKind));
    setMapping(defaultMapping(nextKind));
    setTitle(KIND_LABELS[nextKind]);
    setSlug(nextKind.replaceAll("_", "-"));
    setDescription(
      nextKind === "event_registration"
        ? "Register for this JnUITS event."
        : nextKind === "alumni_onboarding"
          ? "Request alumni onboarding and account claim access."
          : "Submit your details for JnUITS membership review."
    );
    setDraft(null);
    setMessage(null);
  }

  function updateField(index: number, update: Partial<EditorField>) {
    setFields((current) => current.map((field, itemIndex) => (itemIndex === index ? { ...field, ...update } : field)));
  }

  function addField() {
    setFields((current) => [
      ...current,
      {
        id: `field_${current.length + 1}`,
        label: "New field",
        optionsText: "",
        required: false,
        type: "text",
      },
    ]);
  }

  async function createDraft() {
    setIsSaving(true);
    setMessage(null);

    try {
      const response = await fetch("/api/admin/forms", {
        body: JSON.stringify({
          applicationBehavior: { fieldMapping: mapping },
          definition: toDefinition(fields),
          description,
          kind,
          linkedEventId: kind === "event_registration" ? linkedEventId || null : null,
          slug,
          title,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as
        | ({ error?: string } & Partial<DraftResult>)
        | null;

      if (!response.ok || !payload?.formDefinitionId || !payload.formVersionId) {
        throw new Error(payload?.error || "The form draft could not be created.");
      }

      setDraft({
        formDefinitionId: payload.formDefinitionId,
        formVersionId: payload.formVersionId,
      });
      setMessage("Draft created. Review it, then publish when it is ready for public use.");
      await refreshForms();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The form draft could not be created.");
    } finally {
      setIsSaving(false);
    }
  }

  async function publishDraft() {
    if (!draft) return;

    setIsPublishing(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/forms/${draft.formDefinitionId}/publish`, {
        body: JSON.stringify({ formVersionId: draft.formVersionId }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as { error?: string; success?: boolean } | null;

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || "The form could not be published.");
      }

      setMessage("Form published. Existing submissions remain pinned to their original version.");
      await refreshForms();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The form could not be published.");
    } finally {
      setIsPublishing(false);
    }
  }

  async function exportGoogleSheet(formId: string) {
    setMessage("Creating a Google Sheet snapshot…");
    try {
      const response = await fetch(`/api/admin/forms/${formId}/submissions/export?format=google-sheet`, {
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => null)) as
        | { error?: string; success?: boolean; webViewLink?: string }
        | null;

      if (!response.ok || !payload?.success || !payload.webViewLink) {
        throw new Error(payload?.error || "The Google Sheet snapshot could not be created.");
      }

      window.open(payload.webViewLink, "_blank", "noopener,noreferrer");
      setMessage("Google Sheet snapshot created.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The Google Sheet snapshot could not be created.");
    }
  }

  return (
    <div className="grid gap-7">
      <header className="admin-page-header">
        <div>
          <p className="admin-page-header__breadcrumb">Admin / Content</p>
          <h1 className="admin-page-header__title">Form Studio</h1>
          <p className="admin-page-header__desc">
            Create versioned event, membership, and alumni intake forms. Publishing freezes the current definition; later edits create a new draft version.
          </p>
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(20rem,0.6fr)]">
        <section className="admin-review-card grid gap-5">
          <div>
            <p className="admin-section-label">New form</p>
            <h2 className="admin-card-row__title">Definition and fields</h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="input-label">
              Form type
              <select value={kind} onChange={(event) => changeKind(event.target.value as FormKind)}>
                {Object.entries(KIND_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <label className="input-label">
              Public slug
              <input value={slug} onChange={(event) => setSlug(event.target.value)} required />
            </label>
          </div>

          <label className="input-label">
            Form title
            <input value={title} onChange={(event) => setTitle(event.target.value)} required />
          </label>
          <label className="input-label">
            Public description
            <textarea rows={3} value={description} onChange={(event) => setDescription(event.target.value)} />
          </label>

          {kind === "event_registration" ? (
            <label className="input-label">
              Linked event ID
              <input
                placeholder="Event UUID from the event workspace URL"
                value={linkedEventId}
                onChange={(event) => setLinkedEventId(event.target.value)}
                required
              />
              <span className="mt-1 block text-xs font-normal text-[var(--muted-foreground)]">
                Event capacity, deadlines, duplicate prevention, and check-in continue to use the canonical event workflow.
              </span>
            </label>
          ) : (
            <section className="rounded-xl border border-[var(--line)] bg-[var(--bg)] p-4">
              <p className="admin-section-label">Review mapping</p>
              <p className="mt-1 text-sm leading-6 text-[var(--muted-foreground)]">
                These fields create the typed review case after the applicant confirms their email.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {Object.entries(mapping).map(([key, value]) => (
                  <label className="input-label" key={key}>
                    {key.replace(/([A-Z])/g, " $1")}
                    <select
                      value={value}
                      onChange={(event) => setMapping((current) => ({ ...current, [key]: event.target.value }))}
                    >
                      <option value="">Not collected</option>
                      {mappableFields.map((field) => (
                        <option key={field.id} value={field.id}>{field.label} ({field.id})</option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            </section>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="admin-section-label">Fields</p>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">Image/PDF fields use private Cloudinary uploads for membership and alumni forms. Event file uploads remain unavailable.</p>
            </div>
            <button className="admin-btn admin-btn--ghost" onClick={addField} type="button">
              <Plus aria-hidden="true" size={15} /> Add field
            </button>
          </div>

          <div className="grid gap-3">
            {fields.map((field, index) => (
              <article className="rounded-xl border border-[var(--line)] bg-[var(--bg)] p-4" key={`${field.id}-${index}`}>
                <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_11rem_auto]">
                  <label className="input-label">Field ID
                    <input value={field.id} onChange={(event) => updateField(index, { id: event.target.value })} required />
                  </label>
                  <label className="input-label">Label
                    <input value={field.label} onChange={(event) => updateField(index, { label: event.target.value })} required />
                  </label>
                  <label className="input-label">Type
                    <select value={field.type} onChange={(event) => updateField(index, { type: event.target.value as FieldType })}>
                      {Object.entries(FIELD_TYPE_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </label>
                  <div className="flex items-end gap-3">
                    {field.type !== "section" && field.type !== "consent" ? (
                      <label className="flex items-center gap-2 pb-2 text-sm font-semibold text-[var(--brand-ink)]">
                        <input checked={field.required} onChange={(event) => updateField(index, { required: event.target.checked })} type="checkbox" /> Required
                      </label>
                    ) : null}
                    <button
                      aria-label={`Remove ${field.label}`}
                      className="admin-btn admin-btn--danger"
                      disabled={fields.length <= 1}
                      onClick={() => setFields((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                      type="button"
                    >
                      <Trash2 aria-hidden="true" size={15} />
                    </button>
                  </div>
                </div>
                {field.type === "select" || field.type === "multi_select" ? (
                  <label className="input-label mt-3 block">Options (one per line)
                    <textarea rows={3} value={field.optionsText} onChange={(event) => updateField(index, { optionsText: event.target.value })} required />
                  </label>
                ) : null}
              </article>
            ))}
          </div>

          {message ? <p className="status-pill" role="status" aria-live="polite">{message}</p> : null}
          <div className="flex flex-wrap justify-end gap-3">
            <button className="admin-btn admin-btn--primary" disabled={isSaving} onClick={createDraft} type="button">
              <Plus aria-hidden="true" size={15} /> {isSaving ? "Creating…" : "Create draft"}
            </button>
            {draft ? (
              <button className="admin-btn admin-btn--primary" disabled={isPublishing} onClick={publishDraft} type="button">
                <Send aria-hidden="true" size={15} /> {isPublishing ? "Publishing…" : "Publish draft"}
              </button>
            ) : null}
          </div>
        </section>

        <aside className="grid content-start gap-4">
          <section className="admin-review-card">
            <p className="admin-section-label">Form inventory</p>
            <h2 className="admin-card-row__title">Recent definitions</h2>
            {isLoadingForms ? (
              <p className="mt-4 text-sm text-[var(--muted-foreground)]">Loading forms…</p>
            ) : forms.length ? (
              <div className="mt-4 grid gap-3">
                {forms.map((form) => (
                  <article className="rounded-xl border border-[var(--line)] p-3" key={form.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold text-[var(--brand-ink)]">{form.title}</h3>
                        <p className="mt-1 text-xs text-[var(--muted-foreground)]">{KIND_LABELS[form.kind]} · /forms/{form.slug}</p>
                      </div>
                      <span className={statusClass(form.lifecycle)}>{form.lifecycle}</span>
                    </div>
                    {form.lifecycle === "published" ? (
                      <div className="mt-3 flex flex-wrap gap-3">
                        <Link className="queue-link inline-flex" href={`/forms/${form.slug}`} rel="noreferrer" target="_blank">
                          Open public form
                        </Link>
                        {form.kind !== "event_registration" ? (
                          <>
                            <a className="queue-link inline-flex" href={`/api/admin/forms/${form.id}/submissions/export?format=csv`}>
                              Export CSV
                            </a>
                            <a className="queue-link inline-flex" href={`/api/admin/forms/${form.id}/submissions/export?format=xlsx`}>
                              Export XLSX
                            </a>
                            <button className="queue-link inline-flex" onClick={() => void exportGoogleSheet(form.id)} type="button">
                              Google Sheet
                            </button>
                          </>
                        ) : null}
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm leading-6 text-[var(--muted-foreground)]">No forms created yet. Create a draft from this workspace.</p>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
