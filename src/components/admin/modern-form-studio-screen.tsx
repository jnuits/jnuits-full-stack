"use client";

import Link from "next/link";
import { Copy, Eye, Plus, Send, Sheet, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { CharacterLimitCounter } from "@/components/admin/character-limit-counter";
import { FieldWithHint } from "@/components/admin/field-with-hint";
import { FormFieldControls } from "@/components/forms/form-field-controls";
import { FormDefinitionSchema, type FormDefinition } from "@/lib/forms/definition";
import {
  createStudioEditorKey,
  createUniqueStudioFieldId,
  duplicateStudioField,
  formDefinitionToStudioFields,
  markStudioFieldIdsPersisted,
  STUDIO_HELP_TEXT_MAX_LENGTH,
  studioFieldsToDefinition,
  updateAutomaticStudioFieldLabel,
  type StudioEditorField,
  type StudioFieldType,
} from "@/lib/forms/form-studio-definition";
import { moveItem } from "@/lib/forms/field-order";
import {
  buildPublicFormUrl,
  formatPublicFormUrlForDisplay,
} from "@/lib/forms/public-url";
import {
  useFormInventory,
  type FormInventoryItem,
  type FormInventoryKind,
} from "@/components/admin/form-inventory-context";

type FormKind = FormInventoryKind;
type LinkableEvent = { id: string; startsAt: null | string; status: string; title: string };
type Draft = { formDefinitionId: string; formVersionId: string };
type Notice = { text: string; tone: "error" | "success" };
type EditorPayload = {
  description: string;
  id: string;
  kind: FormKind;
  lifecycle: FormInventoryItem["lifecycle"];
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

/**
 * Written lifecycle labels. The raw union values are database states, not
 * operator language, and "closed" alone does not say what was closed.
 */
const LIFECYCLE_LABELS: Record<FormInventoryItem["lifecycle"], string> = {
  archived: "Archived",
  closed: "Intake closed",
  draft: "Draft",
  published: "Published",
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

/**
 * A starting point, not a fixed list. Batches advance every year, so an
 * operator is expected to edit this before publishing an intake cycle.
 */
const STARTER_BATCH_OPTIONS = ["15th", "16th", "17th", "18th"].join("\n");

/**
 * Written labels for the application mapping. These are not form fields; they
 * are the contract the reviewer queue reads, so an operator needs to know what
 * each one feeds rather than seeing a split camelCase key.
 */
const MAPPING_LABELS: Record<string, { hint: string; label: string }> = {
  batchLabel: { hint: "Shown on the member record.", label: "Batch" },
  departmentCode: { hint: "Groups members by department.", label: "Department" },
  email: { hint: "Used for confirmation and review notices.", label: "Email address" },
  fullName: { hint: "Displayed throughout review and membership.", label: "Full name" },
  jnuitsId: { hint: "Matches an alumnus to their previous record.", label: "Previous JnUITS ID" },
  phone: { hint: "Optional contact number for reviewers.", label: "Phone number" },
  studentId: { hint: "Verified during membership review.", label: "Student ID" },
};
const UNMAPPABLE_TYPES = ["section", "consent"];

/**
 * Help text is offered for every question type except a section heading.
 *
 * A section's help text is rendered beside the region it introduces without
 * being associated with it, which is precisely the defect task 2.1 removed from
 * every other control. Offering the input here would let an operator author text
 * that assistive technology cannot reach, so it waits until the region describes
 * itself (#95). A stored definition that already carries section help text keeps
 * it: `formDefinitionToStudioFields` reads it back on every branch.
 */
const HELP_TEXT_UNSUPPORTED_TYPES = ["section"];

function mappingLabel(key: string) {
  return MAPPING_LABELS[key] || { hint: "", label: key.replace(/([A-Z])/g, " $1") };
}

/**
 * Starter fields keep curated, stable identifiers because the application
 * mapping refers to them by name. Only operator-created questions receive
 * automatic label-derived identifiers.
 *
 * Every row is given an editor key here. The key is required on the type, so
 * a new starter field cannot be added without one and cannot reintroduce the
 * remount-on-keystroke defect.
 */
function starterFields(kind: FormKind): StudioEditorField[] {
  const common: StudioEditorField[] = [
    { editorKey: createStudioEditorKey(), id: "full_name", label: "Full name", optionsText: "", required: true, type: "text" },
    { editorKey: createStudioEditorKey(), id: "email", label: "Email address", optionsText: "", required: true, type: "email" },
  ];
  const consent: StudioEditorField = {
    editorKey: createStudioEditorKey(),
    id: "consent",
    label: kind === "event_registration" ? "I agree to the event terms." : "I confirm that these details are accurate.",
    optionsText: "",
    required: true,
    type: "consent",
  };
  if (kind === "membership_application") return [
    ...common,
    { editorKey: createStudioEditorKey(), id: "student_id", label: "Student ID", optionsText: "", required: false, type: "text" },
    // Left as free text on purpose: a wrong fixed department list is worse
    // than typing, and there is no authoritative list to seed it from yet.
    { editorKey: createStudioEditorKey(), id: "department_code", label: "Department", optionsText: "", required: false, type: "text" },
    // A dropdown, because a batch is enumerable and free text produces "16th",
    // "16", and "16 th" as three different batches on the member record.
    { editorKey: createStudioEditorKey(), id: "batch_label", label: "Batch", optionsText: STARTER_BATCH_OPTIONS, required: false, type: "select" },
    { editorKey: createStudioEditorKey(), id: "phone", label: "Phone number", optionsText: "", required: false, type: "telephone" },
    consent,
  ];
  if (kind === "alumni_onboarding") return [
    ...common,
    { editorKey: createStudioEditorKey(), id: "jnuits_id", label: "Previous JnUITS ID", optionsText: "", required: false, type: "text" },
    { editorKey: createStudioEditorKey(), id: "phone", label: "Phone number", optionsText: "", required: false, type: "telephone" },
    consent,
  ];
  return [
    ...common,
    { editorKey: createStudioEditorKey(), id: "phone", label: "Phone number", optionsText: "", required: false, type: "telephone" },
    consent,
  ];
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

function eventLabel(event: LinkableEvent) {
  if (!event.startsAt) return event.title;
  const when = new Date(event.startsAt);
  return Number.isNaN(when.getTime())
    ? event.title
    : `${event.title} · ${when.toLocaleDateString("en-BD", { day: "numeric", month: "short", year: "numeric" })}`;
}

export function ModernFormStudioScreen() {
  const { error: inventoryError, forms, publicBaseUrl, refresh } = useFormInventory();
  const [kind, setKind] = useState<FormKind>("membership_application");
  const [title, setTitle] = useState("Membership application");
  const [slug, setSlug] = useState("membership-application");
  const [description, setDescription] = useState("Submit your details for JnUITS membership review.");
  const [linkedEventId, setLinkedEventId] = useState("");
  const [events, setEvents] = useState<LinkableEvent[]>([]);
  const [eventsError, setEventsError] = useState<null | string>(null);
  const [fields, setFields] = useState<StudioEditorField[]>(() => starterFields("membership_application"));
  const [mapping, setMapping] = useState<Record<string, string>>(() => defaultMapping("membership_application"));
  const [draft, setDraft] = useState<Draft | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState<"load" | "publish" | "save" | null>(null);
  const [sheetFormId, setSheetFormId] = useState<null | string>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [preview, setPreview] = useState(false);
  const [slugEdited, setSlugEdited] = useState(false);

  const mappable = useMemo(() => fields.filter((field) => !UNMAPPABLE_TYPES.includes(field.type)), [fields]);
  const canSave = Boolean(title.trim()) && Boolean(slug.trim()) && fields.every((field) => field.label.trim());
  const needsEvent = kind === "event_registration" && !editingId;

  /**
   * The preview renders the same controls the public page renders, so building
   * it through the real conversion also surfaces schema problems (an empty
   * dropdown, for example) before the operator saves.
   */
  const previewDefinition = useMemo<{ definition: FormDefinition | null; error: null | string }>(() => {
    try {
      return { definition: studioFieldsToDefinition(fields), error: null };
    } catch (error) {
      return {
        definition: null,
        error: error instanceof Error ? error.message : "This form cannot be previewed yet.",
      };
    }
  }, [fields]);

  function fail(error: unknown, fallback: string) {
    setNotice({ text: error instanceof Error ? error.message : fallback, tone: "error" });
  }

  // Loaded lazily so non-event operators never trigger the events query.
  useEffect(() => {
    if (kind !== "event_registration" || events.length) return;
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/admin/forms/linkable-events", { cache: "no-store" });
        const payload = (await response.json().catch(() => null)) as { error?: string; items?: LinkableEvent[] } | null;
        if (!response.ok) throw new Error(payload?.error || "Events could not be loaded.");
        if (!cancelled) { setEvents(payload?.items || []); setEventsError(null); }
      } catch (error) {
        if (!cancelled) setEventsError(error instanceof Error ? error.message : "Events could not be loaded.");
      }
    })();
    return () => { cancelled = true; };
  }, [events.length, kind]);

  function chooseKind(nextKind: FormKind) {
    setKind(nextKind);
    setTitle(KINDS[nextKind]);
    setSlug(nextKind.replaceAll("_", "-"));
    setSlugEdited(false);
    setDescription(nextKind === "event_registration" ? "Register for this JnUITS event." : nextKind === "alumni_onboarding" ? "Request alumni onboarding and account claim access." : "Submit your details for JnUITS membership review.");
    setFields(starterFields(nextKind));
    setMapping(defaultMapping(nextKind));
    setLinkedEventId("");
    setDraft(null);
    setEditingId(null);
    setNotice(null);
  }

  function updateField(index: number, update: Partial<StudioEditorField>) {
    setFields((current) => current.map((field, position) => position === index ? { ...field, ...update } : field));
  }

  // Routed through the helper so an unsaved question's automatic identifier
  // tracks its label, and a persisted identifier never moves. The editor key
  // is untouched either way, which is what keeps focus in the input.
  function renameField(index: number, label: string) {
    setFields((current) => updateAutomaticStudioFieldLabel(current, index, label));
  }

  function addQuestion() {
    setFields((current) => [...current, {
      automaticId: true,
      editorKey: createStudioEditorKey(),
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
    setBusy("load"); setNotice(null);
    try {
      const response = await fetch(`/api/admin/forms/${id}/versions`, { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as (EditorPayload & { error?: string }) | null;
      if (!response.ok || !payload?.version) throw new Error(payload?.error || "The form could not be opened.");
      const definition = FormDefinitionSchema.safeParse(payload.version.fieldSchema);
      if (!definition.success) throw new Error("This form uses an invalid legacy schema. Repair it before editing.");
      setKind(payload.kind); setTitle(payload.title); setSlug(payload.slug); setSlugEdited(true);
      setDescription(payload.description); setLinkedEventId(payload.linkedEventId || "");
      // Historical identifiers are loaded as persisted, so editing a label in an
      // existing form can never rewrite a stored field id.
      setFields(markStudioFieldIdsPersisted(formDefinitionToStudioFields(definition.data)));
      setEditingId(payload.id);
      const behavior = payload.version.applicationBehavior as { fieldMapping?: Record<string, string> } | null;
      setMapping({ ...defaultMapping(payload.kind), ...(behavior?.fieldMapping || {}) });
      setDraft(payload.version.lifecycle === "draft" ? { formDefinitionId: payload.id, formVersionId: payload.version.id } : null);
      setNotice({
        text: payload.version.lifecycle === "draft" ? "Draft resumed." : "Published form loaded. Saving creates a new draft version.",
        tone: "success",
      });
    } catch (error) {
      fail(error, "The form could not be opened.");
    } finally { setBusy(null); }
  }

  async function save() {
    if (needsEvent && !linkedEventId) {
      setNotice({ text: "Choose the event this registration form belongs to.", tone: "error" });
      return;
    }
    setBusy("save"); setNotice(null);
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
      setEditingId(definitionId);
      setDraft({ formDefinitionId: definitionId, formVersionId: payload.formVersionId });
      // Identifiers are now stored, so freeze them against later relabelling.
      setFields((current) => markStudioFieldIdsPersisted(current));
      setNotice({ text: "Draft saved. Review it before publishing.", tone: "success" });
      await refresh();
    } catch (error) { fail(error, "The draft could not be saved."); }
    finally { setBusy(null); }
  }

  async function publish() {
    if (!draft || !window.confirm("Publish this version? Published versions are immutable.")) return;
    setBusy("publish"); setNotice(null);
    try {
      const response = await fetch(`/api/admin/forms/${draft.formDefinitionId}/publish`, {
        body: JSON.stringify({ formVersionId: draft.formVersionId }), headers: { "Content-Type": "application/json" }, method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as { error?: string; success?: boolean } | null;
      if (!response.ok || !payload?.success) throw new Error(payload?.error || "The form could not be published.");
      // The draft no longer exists, so clear it: a further save must create a
      // new draft version rather than patch the published one.
      setDraft(null);
      setNotice({ text: "Form published. Preview or share the public link, or save again to start a new draft version.", tone: "success" });
      await refresh();
    } catch (error) { fail(error, "The form could not be published."); }
    finally { setBusy(null); }
  }

  /**
   * The canonical URL is passed in, never derived from the current host, so a
   * link copied from a preview deployment or localhost is still the address a
   * member can actually open.
   */
  async function copyLink(url: string) {
    // navigator.clipboard is undefined in an insecure context, so this is a
    // reachable path rather than a theoretical one. The address is displayed on
    // the card, so there is always a manual route.
    if (!navigator.clipboard?.writeText) {
      setNotice({
        text: "Copying is unavailable in this browser. Select the address shown on the form and copy it manually.",
        tone: "error",
      });
      return;
    }

    try {
      await navigator.clipboard.writeText(url);
      setNotice({ text: "Published form link copied.", tone: "success" });
    } catch {
      setNotice({
        text: "The link could not be copied. Select the address shown on the form and copy it manually.",
        tone: "error",
      });
    }
  }

  /**
   * The Shared Drive snapshot returns JSON rather than a file, so unlike CSV and
   * XLSX it cannot be a plain link.
   */
  async function createSheet(form: FormInventoryItem) {
    setSheetFormId(form.id); setNotice(null);
    try {
      const response = await fetch(
        `/api/admin/forms/${form.id}/submissions/export?format=google-sheet`,
        { cache: "no-store" }
      );
      const payload = (await response.json().catch(() => null)) as
        | { error?: string; success?: boolean; webViewLink?: null | string }
        | null;
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || "The Google Sheet snapshot could not be created.");
      }
      setNotice({
        text: payload.webViewLink
          ? `Google Sheet created: ${payload.webViewLink}`
          : "Google Sheet created in the configured Shared Drive.",
        tone: "success",
      });
    } catch (error) {
      fail(error, "The Google Sheet snapshot could not be created.");
    } finally { setSheetFormId(null); }
  }

  const banner = notice || (inventoryError ? { text: inventoryError, tone: "error" as const } : null);

  return <div className="grid gap-7">
    <header className="admin-page-header"><div><p className="admin-page-header__breadcrumb">Admin / Content</p><h1 className="admin-page-header__title">Form Studio</h1><p className="admin-page-header__desc">Create polished forms without schema IDs or provider settings. Save a draft, preview it, then publish when ready.</p></div></header>
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(19rem,.55fr)]">
      <section className="admin-review-card grid gap-5" aria-labelledby="builder-heading">
        <div><p className="admin-section-label">{editingId ? "Edit form" : "Create form"}</p><h2 className="admin-card-row__title" id="builder-heading">Questions and settings</h2></div>
        <div className="grid gap-4 sm:grid-cols-2"><label className="input-label">Form type<select disabled={Boolean(editingId)} value={kind} onChange={(event) => chooseKind(event.target.value as FormKind)}>{Object.entries(KINDS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><FieldWithHint controlId="form-studio-slug" hint={<>/forms/{slug || "your-form"}</>} label="Public address">{(hintId) => <input aria-describedby={hintId} disabled={Boolean(editingId)} id="form-studio-slug" value={slug} onChange={(event) => { setSlugEdited(true); setSlug(slugify(event.target.value)); }} required />}</FieldWithHint></div>
        <label className="input-label">Form title<input disabled={Boolean(editingId)} value={title} onChange={(event) => { setTitle(event.target.value); if (!slugEdited) setSlug(slugify(event.target.value)); }} required /></label>
        <label className="input-label">Description<textarea disabled={Boolean(editingId)} rows={3} value={description} onChange={(event) => setDescription(event.target.value)} /></label>
        {kind === "event_registration"
          ? <FieldWithHint
              controlId="form-studio-linked-event"
              hint={eventsError
                ? eventsError
                : events.length
                  ? "Only events using internal registration appear here."
                  : "No event is currently open to internal registration."}
              label="Linked event"
            >
              {(hintId) => <select aria-describedby={hintId} disabled={Boolean(editingId)} id="form-studio-linked-event" value={linkedEventId} onChange={(event) => setLinkedEventId(event.target.value)} required>
                <option value="">Choose an event…</option>
                {events.map((event) => <option key={event.id} value={event.id}>{eventLabel(event)}</option>)}
              </select>}
            </FieldWithHint>
          : <section className="rounded-xl border border-[var(--line)] p-4">
              <p className="admin-section-label">Application details</p>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">Choose which question answers the reviewer queue should read for each detail.</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {Object.entries(mapping).map(([key, value]) => {
                  const descriptor = mappingLabel(key);
                  return <FieldWithHint
                    controlId={`form-studio-mapping-${key}`}
                    hint={descriptor.hint}
                    key={key}
                    label={descriptor.label}
                  >
                    {(hintId) => <select aria-describedby={hintId} id={`form-studio-mapping-${key}`} value={value} onChange={(event) => setMapping((current) => ({ ...current, [key]: event.target.value }))}>
                      <option value="">Not collected</option>
                      {mappable.map((field) => <option key={field.editorKey} value={field.id}>{field.label}</option>)}
                    </select>}
                  </FieldWithHint>;
                })}
              </div>
            </section>}
        <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="admin-section-label">Questions</p><p className="mt-1 text-sm text-[var(--muted-foreground)]">Question IDs are generated automatically and stay stable after saving.</p></div><button className="admin-btn admin-btn--ghost" onClick={addQuestion} type="button"><Plus size={15} /> Add question</button></div>
        <div className="grid gap-3">{fields.map((field, index) => <article className="rounded-xl border border-[var(--line)] bg-[var(--bg)] p-4" key={field.editorKey}><div className="mb-3 flex items-center justify-between gap-3"><span className="text-xs text-[var(--muted-foreground)]">Question {index + 1}</span><details><summary className="cursor-pointer text-xs font-semibold">Advanced details</summary><code className="mt-2 block text-xs">ID: {field.id}</code></details></div><div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_12rem_auto]"><label className="input-label">Question<input value={field.label} onChange={(event) => renameField(index, event.target.value)} required /></label><label className="input-label">Question type<select value={field.type} onChange={(event) => updateField(index, {
  helpText: event.target.value === "section" ? undefined : field.helpText,
  preserveSectionHelpText: event.target.value === "section" ? false : field.preserveSectionHelpText,
  required: event.target.value === "consent" || field.required,
  type: event.target.value as StudioFieldType,
})}>{Object.entries(TYPES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><div className="flex flex-wrap items-end gap-2"><button aria-label={`Move ${field.label} up`} className="admin-btn admin-btn--ghost" disabled={index === 0} onClick={() => setFields((current) => moveItem(current, index, index - 1))} type="button">↑</button><button aria-label={`Move ${field.label} down`} className="admin-btn admin-btn--ghost" disabled={index === fields.length - 1} onClick={() => setFields((current) => moveItem(current, index, index + 1))} type="button">↓</button><button className="admin-btn admin-btn--ghost" onClick={() => duplicateQuestion(index)} type="button">Duplicate</button><button aria-label={`Remove ${field.label}`} className="admin-btn admin-btn--danger" disabled={fields.length === 1} onClick={() => setFields((current) => current.filter((_, position) => position !== index))} type="button"><Trash2 size={15} /></button></div></div>{!UNMAPPABLE_TYPES.includes(field.type) ? <label className="mt-3 flex min-h-11 items-center gap-2 text-sm font-semibold"><input checked={field.required} onChange={(event) => updateField(index, { required: event.target.checked })} type="checkbox" /> Required</label> : null}{!HELP_TEXT_UNSUPPORTED_TYPES.includes(field.type) ? <FieldWithHint className="mt-3 block" controlId={`form-studio-help-${field.editorKey}`} hint={<>Optional. Shown under the question and read out with it. Up to {STUDIO_HELP_TEXT_MAX_LENGTH} characters.</>} label="Help text">{(hintId) => <><textarea aria-describedby={`${hintId} form-studio-help-${field.editorKey}-counter`} id={`form-studio-help-${field.editorKey}`} maxLength={STUDIO_HELP_TEXT_MAX_LENGTH} rows={2} value={field.helpText ?? ""} onChange={(event) => updateField(index, { helpText: event.target.value, preserveSectionHelpText: false })} /><CharacterLimitCounter current={(field.helpText ?? "").length} id={`form-studio-help-${field.editorKey}-counter`} maximum={STUDIO_HELP_TEXT_MAX_LENGTH} /></>}</FieldWithHint> : null}{["select", "multi_select"].includes(field.type) ? <label className="input-label mt-3 block">Choices, one per line<textarea rows={4} value={field.optionsText} onChange={(event) => updateField(index, { optionsText: event.target.value })} /></label> : null}{["image", "pdf"].includes(field.type) ? <label className="input-label mt-3 block">Maximum files<input min={1} max={5} type="number" value={field.maxFiles ?? 1} onChange={(event) => updateField(index, { maxFiles: Math.min(5, Math.max(1, Number(event.target.value) || 1)) })} /></label> : null}</article>)}</div>
        {preview ? (
          <section className="rounded-2xl border border-[var(--line)] bg-[var(--bg)] p-5" aria-label="Form preview">
            <p className="admin-section-label">Respondent preview</p>
            <h3 className="mt-2 text-2xl font-semibold">{title}</h3>
            {description ? <p className="mt-1 text-sm text-[var(--muted-foreground)]">{description}</p> : null}
            {previewDefinition.definition ? (
              <div className="mt-5 grid gap-5">
                <FormFieldControls
                  definition={previewDefinition.definition}
                  idPrefix="form-studio-preview"
                  preview
                />
                <p className="text-xs text-[var(--muted-foreground)]">
                  Respondents also complete a verification challenge before submitting.
                </p>
              </div>
            ) : (
              <p className="status-pill status-pill--danger mt-4" role="alert">{previewDefinition.error}</p>
            )}
          </section>
        ) : null}
        {banner ? <p className={banner.tone === "error" ? "status-pill status-pill--danger" : "status-pill"} role={banner.tone === "error" ? "alert" : "status"} aria-live="polite">{banner.text}</p> : null}
        <div className="flex flex-wrap justify-end gap-3"><button className="admin-btn admin-btn--ghost" onClick={() => setPreview((value) => !value)} type="button"><Eye size={15} /> {preview ? "Hide preview" : "Preview"}</button><button className="admin-btn admin-btn--primary" disabled={busy !== null || !canSave} onClick={() => void save()} type="button"><Plus size={15} /> {busy === "save" ? "Saving…" : draft ? "Save draft" : editingId ? "Save as new draft" : "Create draft"}</button>{draft ? <button className="admin-btn admin-btn--primary" disabled={busy !== null} onClick={() => void publish()} type="button"><Send size={15} /> {busy === "publish" ? "Publishing…" : "Publish"}</button> : null}</div>
      </section>
      <aside className="grid content-start gap-4">
        <section className="admin-review-card">
          <p className="admin-section-label">Your forms</p>
          <h2 className="admin-card-row__title">Edit, share, and export</h2>
          {forms.length ? (
            <div className="mt-4 grid gap-3">
              {forms.map((form) => {
                // Null when the form is not published, or when the canonical
                // base cannot produce a URL. Never falls back to the current
                // host: a wrong address is worse than no address.
                const publicUrl =
                  form.lifecycle === "published"
                    ? buildPublicFormUrl({ baseUrl: publicBaseUrl, slug: form.slug })
                    : null;

                return (
                  <article className="rounded-xl border border-[var(--line)] p-3" key={form.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold">{form.title}</h3>
                        <p className="mt-1 text-xs text-[var(--muted-foreground)]">{KINDS[form.kind]}</p>
                      </div>
                      <span
                        className={
                          form.lifecycle === "archived"
                            ? "status-pill status-pill--danger"
                            : "status-pill"
                        }
                      >
                        {LIFECYCLE_LABELS[form.lifecycle]}
                      </span>
                    </div>

                    {publicUrl ? (
                      <p
                        className="mt-2 break-all text-xs text-[var(--muted-foreground)]"
                        title={publicUrl}
                      >
                        {formatPublicFormUrlForDisplay(publicUrl)}
                      </p>
                    ) : null}

                    {form.lifecycle !== "archived" ? (
                      <button className="queue-link mt-3" disabled={busy === "load"} onClick={() => void openForm(form.id)} type="button">
                        {form.lifecycle === "draft" ? "Resume draft" : "Edit"}
                      </button>
                    ) : null}

                    {form.lifecycle === "published" ? (
                      <div className="mt-3 flex flex-wrap gap-3">
                        {publicUrl ? (
                          <>
                            <Link className="queue-link" href={publicUrl} rel="noreferrer" target="_blank">
                              Open
                            </Link>
                            <button className="queue-link" onClick={() => void copyLink(publicUrl)} type="button">
                              <Copy size={13} /> Copy link
                            </button>
                          </>
                        ) : null}
                        <Link className="queue-link" href={`/admin/content/forms?review=${form.id}#submission-review`}>
                          Review responses
                        </Link>
                        {form.kind !== "event_registration" ? (
                          <>
                            <a className="queue-link" href={`/api/admin/forms/${form.id}/submissions/export?format=csv`}>CSV</a>
                            <a className="queue-link" href={`/api/admin/forms/${form.id}/submissions/export?format=xlsx`}>XLSX</a>
                            <button className="queue-link" disabled={sheetFormId !== null} onClick={() => void createSheet(form)} type="button">
                              <Sheet size={13} /> {sheetFormId === form.id ? "Creating…" : "Google Sheet"}
                            </button>
                          </>
                        ) : null}
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="mt-4 text-sm text-[var(--muted-foreground)]">No forms yet. Create your first draft.</p>
          )}
        </section>
      </aside>
    </div>
  </div>;
}
