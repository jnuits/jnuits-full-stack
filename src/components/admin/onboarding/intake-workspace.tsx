"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  Plus,
  RotateCcw,
  Save,
  ShieldCheck,
  Trash2,
  Upload,
} from "lucide-react";
import { useRef, useState, useTransition } from "react";

import {
  createOnboardingDraftAction,
  editOnboardingDraftRowAction,
  getOnboardingDraftAction,
  inspectOnboardingSourceAction,
  publishOnboardingDraftAction,
  setOnboardingDraftRowExcludedAction,
  validateOnboardingDraftAction,
} from "@/app/admin/onboarding/actions";
import type {
  CommitteeIntakeSourceKind,
  CommitteeOnboardingColumnMapping,
  CommitteeOnboardingOperationType,
} from "@/lib/committee/onboarding/contracts";
import { ONBOARDING_FIELD_CATALOG } from "@/lib/committee/onboarding/field-catalog";
import type { IntakeHeader, IntakeRow } from "@/lib/committee/onboarding/intake-contracts";
import type { OnboardingRowIssue } from "@/lib/committee/onboarding/normalize-draft";

type ActionSuccess<T> = { data: T; message: string; ok: true };
type ActionFailure = { message: string; ok: false };

type Inspection = {
  availableSheets: string[];
  headers: IntakeHeader[];
  inferredMapping: CommitteeOnboardingColumnMapping;
  originalFilename: string | null;
  previewRows: IntakeRow[];
  rowCount: number;
  selectedSheet: string | null;
  sourceSha256: string;
};

export type IntakeWorkspaceDraft = {
  draftRevision: number;
  id: string;
  metadata: Record<string, unknown>;
  operationType: CommitteeOnboardingOperationType;
  originalFilename: string | null;
  rows: Array<{
    errors: OnboardingRowIssue[];
    id: string;
    isExcluded: boolean;
    normalizedData: Record<string, unknown>;
    rawData: Record<string, string>;
    rowNumber: number;
    status: string;
  }>;
  sourceKind: CommitteeIntakeSourceKind;
  sourceSha256: string | null;
  status: string;
  targetTermId: string | null;
  validatedRevision: number | null;
};

type IntakeWorkspaceProps = {
  initialDraft?: IntakeWorkspaceDraft | null;
  operationType: CommitteeOnboardingOperationType;
  targetTermId?: string | null;
  targetTermLabel?: string | null;
};

type ManualRow = {
  batchNo: string;
  classification: string;
  departmentCode: string;
  email: string;
  fullName: string;
  jnuitsId: string;
  position: string;
};

const SOURCE_OPTIONS: ReadonlyArray<{
  description: string;
  label: string;
  value: CommitteeIntakeSourceKind;
}> = [
  { label: "Manual entry", value: "manual", description: "Enter one or more profiles." },
  { label: "CSV file", value: "csv", description: "Upload a UTF-8 CSV file." },
  { label: "Excel workbook", value: "xlsx", description: "Choose an XLSX worksheet." },
  { label: "Paste TSV", value: "pasted_tsv", description: "Paste rows copied from a sheet." },
];

const EMPTY_MANUAL_ROW: ManualRow = {
  batchNo: "",
  classification: "current",
  departmentCode: "",
  email: "",
  fullName: "",
  jnuitsId: "",
  position: "",
};

function isSuccess<T>(result: unknown): result is ActionSuccess<T> {
  return Boolean(
    result &&
      typeof result === "object" &&
      (result as { ok?: unknown }).ok === true &&
      "data" in result
  );
}

function resultMessage(result: unknown, fallback: string) {
  return result && typeof result === "object" && typeof (result as ActionFailure).message === "string"
    ? (result as ActionFailure).message
    : fallback;
}

function humanizeKey(value: string) {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replaceAll("_", " ")
    .replace(/^./, (character) => character.toUpperCase());
}

function statusClass(status: string) {
  if (status === "valid" || status === "committed") return "abadge--approved";
  if (status === "error" || status === "failed") return "abadge--rejected";
  if (status === "previewed") return "abadge--active";
  return "abadge--draft";
}

function Feedback({ feedback }: { feedback: { message: string; tone: "error" | "success" } | null }) {
  if (!feedback) return null;
  return (
    <p
      className={`portal-message ${feedback.tone === "error" ? "portal-message--error" : "portal-message--success"}`}
      role={feedback.tone === "error" ? "alert" : "status"}
    >
      {feedback.message}
    </p>
  );
}

function ManualRowsEditor({
  committee,
  onChange,
  rows,
}: {
  committee: boolean;
  onChange: (rows: ManualRow[]) => void;
  rows: ManualRow[];
}) {
  function updateRow(index: number, field: keyof ManualRow, value: string) {
    onChange(rows.map((row, rowIndex) => (rowIndex === index ? { ...row, [field]: value } : row)));
  }

  return (
    <div className="grid gap-4">
      {rows.map((row, index) => (
        <fieldset
          className="grid min-w-0 gap-3 rounded-xl border border-[var(--line)] bg-[var(--card)] p-4 sm:grid-cols-2 xl:grid-cols-3"
          key={index}
        >
          <legend className="px-2 text-sm font-bold">Manual member {index + 1}</legend>
          <label className="input-label">Full name<input onChange={(event) => updateRow(index, "fullName", event.currentTarget.value)} required value={row.fullName} /></label>
          <label className="input-label">JnUITS ID<input onChange={(event) => updateRow(index, "jnuitsId", event.currentTarget.value)} required value={row.jnuitsId} /></label>
          <label className="input-label">Email<input onChange={(event) => updateRow(index, "email", event.currentTarget.value)} required type="email" value={row.email} /></label>
          <label className="input-label">
            Classification
            <select onChange={(event) => updateRow(index, "classification", event.currentTarget.value)} value={row.classification}>
              <option value="current">Current</option><option value="former">Former</option><option value="alumni">Alumni</option>
            </select>
          </label>
          <label className="input-label">Department code<input onChange={(event) => updateRow(index, "departmentCode", event.currentTarget.value)} value={row.departmentCode} /></label>
          <label className="input-label">Batch<input inputMode="numeric" onChange={(event) => updateRow(index, "batchNo", event.currentTarget.value)} value={row.batchNo} /></label>
          {committee ? <label className="input-label">Position<input onChange={(event) => updateRow(index, "position", event.currentTarget.value)} required value={row.position} /></label> : null}
          {rows.length > 1 ? (
            <button aria-label={`Remove manual member ${index + 1}`} className="admin-btn admin-btn--ghost self-end" onClick={() => onChange(rows.filter((_, rowIndex) => rowIndex !== index))} type="button">
              <Trash2 aria-hidden="true" size={15} /> Remove
            </button>
          ) : null}
        </fieldset>
      ))}
      <button className="admin-btn admin-btn--secondary w-full sm:w-fit" onClick={() => onChange([...rows, { ...EMPTY_MANUAL_ROW }])} type="button">
        <Plus aria-hidden="true" size={15} /> Add another member
      </button>
    </div>
  );
}

function DraftRowEditor({
  disabled,
  draftRevision,
  onExclude,
  onSave,
  row,
}: {
  disabled: boolean;
  draftRevision: number;
  onExclude: (rowId: string, excluded: boolean, reason: string | null) => void;
  onSave: (rowId: string, rawData: Record<string, string>) => void;
  row: IntakeWorkspaceDraft["rows"][number];
}) {
  const [rawData, setRawData] = useState(() => ({ ...row.rawData }));
  const [reason, setReason] = useState("");
  const fields = Object.keys(rawData).toSorted((left, right) => left.localeCompare(right));

  return (
    <fieldset
      aria-label={`Draft row ${row.rowNumber}`}
      className={`grid min-w-0 gap-4 rounded-xl border p-4 ${row.isExcluded ? "border-dashed border-[var(--line)] opacity-75" : "border-[var(--line)] bg-[var(--card)]"}`}
    >
      <legend className="px-2 text-sm font-bold">
        Row {row.rowNumber} · <span className={`abadge ${statusClass(row.status)}`}>{row.isExcluded ? "excluded" : row.status}</span>
      </legend>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {fields.map((field) => (
          <label className="input-label" key={field}>
            {`Row ${row.rowNumber} ${humanizeKey(field)}`}
            <input
              disabled={disabled || row.isExcluded}
              onChange={(event) => {
                const value = event.currentTarget.value;
                setRawData((current) => ({ ...current, [field]: value }));
              }}
              value={rawData[field]}
            />
          </label>
        ))}
      </div>
      {row.errors.length > 0 ? (
        <ul className="grid gap-1 text-sm text-[var(--brand-rust)]" role="alert">
          {row.errors.map((issue) => <li key={`${issue.code}-${issue.field ?? "row"}`}>{issue.message}</li>)}
        </ul>
      ) : null}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <label className="input-label flex-1">
          {`Exclusion reason for row ${row.rowNumber}`}
          <input
            disabled={disabled || row.isExcluded}
            onChange={(event) => setReason(event.currentTarget.value)}
            placeholder="Required when excluding a row"
            value={reason}
          />
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button aria-label={`Save correction for row ${row.rowNumber}`} className="admin-btn admin-btn--secondary" disabled={disabled || row.isExcluded} onClick={() => onSave(row.id, rawData)} type="button">
            <Save aria-hidden="true" size={15} /> Save correction
          </button>
          <button
            aria-label={`${row.isExcluded ? "Reinclude" : "Exclude"} row ${row.rowNumber}`}
            className="admin-btn admin-btn--ghost"
            disabled={disabled || (!row.isExcluded && !reason.trim())}
            onClick={() => onExclude(row.id, !row.isExcluded, row.isExcluded ? null : reason.trim())}
            type="button"
          >
            <RotateCcw aria-hidden="true" size={15} /> {row.isExcluded ? "Reinclude" : "Exclude"}
          </button>
        </div>
      </div>
      <input name="draftRevision" readOnly type="hidden" value={draftRevision} />
    </fieldset>
  );
}

export function IntakeWorkspace({
  initialDraft = null,
  operationType,
  targetTermId = null,
  targetTermLabel = null,
}: IntakeWorkspaceProps) {
  const committee = operationType === "committee_roster_import";
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [sourceKind, setSourceKind] = useState<CommitteeIntakeSourceKind>("manual");
  const [manualRows, setManualRows] = useState<ManualRow[]>([{ ...EMPTY_MANUAL_ROW }]);
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [sourceText, setSourceText] = useState("");
  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [mapping, setMapping] = useState<CommitteeOnboardingColumnMapping>({});
  const [sheetName, setSheetName] = useState("");
  const [draft, setDraft] = useState<IntakeWorkspaceDraft | null>(initialDraft);
  const [feedback, setFeedback] = useState<{ message: string; tone: "error" | "success" } | null>(null);
  const [confirmPublish, setConfirmPublish] = useState(false);
  const [makeCurrent, setMakeCurrent] = useState(false);
  const [pendingLabel, setPendingLabel] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const relevantFields = ONBOARDING_FIELD_CATALOG.filter(
    ({ field }) => field !== "committeeTerm" && (committee || !["position", "startsOn", "endsOn", "sortOrder", "isPublic", "assignmentStatus"].includes(field))
  );

  function buildSourceFormData(selectedSheet = sheetName) {
    const formData = new FormData();
    formData.set("operationType", operationType);
    formData.set("sourceKind", sourceKind);
    if (sourceKind === "manual") formData.set("manualRows", JSON.stringify(manualRows));
    if (sourceKind === "pasted_tsv") formData.set("sourceText", sourceText);
    if ((sourceKind === "csv" || sourceKind === "xlsx") && sourceFile) formData.set("sourceFile", sourceFile);
    if (sourceKind === "xlsx" && selectedSheet) formData.set("sheetName", selectedSheet);
    return formData;
  }

  function run(label: string, work: () => Promise<void>) {
    setPendingLabel(label);
    startTransition(async () => {
      try { await work(); } finally { setPendingLabel(null); }
    });
  }

  function changeSource(next: CommitteeIntakeSourceKind) {
    setSourceKind(next);
    setSourceFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setInspection(null);
    setMapping({});
    setSheetName("");
    setFeedback(null);
  }

  function selectFile(file: File | null) {
    setFeedback(null);
    setInspection(null);
    if (!file) { setSourceFile(null); return; }
    const expectedExtension = sourceKind === "csv" ? ".csv" : ".xlsx";
    if (!file.name.toLocaleLowerCase("en-US").endsWith(expectedExtension)) {
      setSourceFile(null);
      setFeedback({ message: `Choose a ${expectedExtension} file.`, tone: "error" });
      return;
    }
    if (file.size === 0 || file.size > 2 * 1024 * 1024) {
      setSourceFile(null);
      setFeedback({ message: file.size === 0 ? "The selected file is empty." : "The selected file is larger than 2 MB.", tone: "error" });
      return;
    }
    setSourceFile(file);
  }

  async function inspectSource(selectedSheet = sheetName) {
    const result = await inspectOnboardingSourceAction(buildSourceFormData(selectedSheet));
    if (!isSuccess<Inspection>(result)) {
      setFeedback({ message: resultMessage(result, "Unable to inspect the source."), tone: "error" });
      return;
    }
    setInspection(result.data);
    setMapping(result.data.inferredMapping);
    setSheetName(result.data.selectedSheet ?? selectedSheet);
    setFeedback({ message: result.message, tone: "success" });
  }

  async function reloadDraft(operationId: string) {
    const loaded = await getOnboardingDraftAction({ operationId });
    if (!isSuccess<IntakeWorkspaceDraft>(loaded)) {
      setFeedback({ message: resultMessage(loaded, "Unable to reload the draft."), tone: "error" });
      return null;
    }
    setDraft(loaded.data);
    return loaded.data;
  }

  async function saveDraft() {
    if (!inspection) return;
    const formData = buildSourceFormData(inspection.selectedSheet ?? sheetName);
    formData.set("columnMapping", JSON.stringify(mapping));
    if (targetTermId) formData.set("targetTermId", targetTermId);
    const result = await createOnboardingDraftAction(formData);
    if (!isSuccess<{ operationId: string }>(result)) {
      setFeedback({ message: resultMessage(result, "Unable to save the draft."), tone: "error" });
      return;
    }
    await reloadDraft(result.data.operationId);
    setFeedback({ message: result.message, tone: "success" });
  }

  async function saveRow(rowId: string, rawData: Record<string, string>) {
    if (!draft) return;
    const result = await editOnboardingDraftRowAction({ expectedRevision: draft.draftRevision, operationId: draft.id, rawData, rowId });
    if (!isSuccess<{ draftRevision: number; operationId: string }>(result)) {
      setFeedback({ message: resultMessage(result, "Unable to save the row."), tone: "error" });
      return;
    }
    const refreshed = await reloadDraft(result.data.operationId);
    if (!refreshed) return;
    setConfirmPublish(false);
    setFeedback({ message: result.message, tone: "success" });
  }

  async function excludeRow(rowId: string, excluded: boolean, reason: string | null) {
    if (!draft) return;
    const result = await setOnboardingDraftRowExcludedAction({ excluded, expectedRevision: draft.draftRevision, operationId: draft.id, reason, rowId });
    if (!isSuccess<{ draftRevision: number; operationId: string }>(result)) {
      setFeedback({ message: resultMessage(result, "Unable to update the row."), tone: "error" });
      return;
    }
    const refreshed = await reloadDraft(result.data.operationId);
    if (!refreshed) return;
    setConfirmPublish(false);
    setFeedback({ message: result.message, tone: "success" });
  }

  async function validateDraft() {
    if (!draft) return;
    const result = await validateOnboardingDraftAction({ expectedRevision: draft.draftRevision, operationId: draft.id });
    if (!isSuccess<{ draftRevision: number; status: string }>(result)) {
      setFeedback({ message: resultMessage(result, "Draft validation failed."), tone: "error" });
      return;
    }
    setDraft({ ...draft, status: result.data.status, validatedRevision: result.data.draftRevision });
    setFeedback({ message: result.message, tone: "success" });
  }

  async function publishDraft() {
    if (!draft) return;
    const result = await publishOnboardingDraftAction({ expectedRevision: draft.draftRevision, makeCurrent: committee && makeCurrent, operationId: draft.id });
    if (!isSuccess<Record<string, unknown>>(result)) {
      setFeedback({ message: resultMessage(result, "Unable to publish the draft."), tone: "error" });
      return;
    }
    setDraft({ ...draft, status: "committed" });
    setFeedback({ message: result.message, tone: "success" });
  }

  const activeRows = draft?.rows.filter((row) => !row.isExcluded) ?? [];
  const validRows = activeRows.filter((row) => row.status === "valid").length;
  const errorRows = activeRows.length - validRows;
  const excludedRows = draft?.rows.filter((row) => row.isExcluded).length ?? 0;
  const validated = Boolean(
    draft && draft.status === "previewed" && draft.validatedRevision === draft.draftRevision && errorRows === 0 && activeRows.length > 0
  );
  const terminal = draft?.status === "committed" || draft?.status === "cancelled";
  const downloadBase = `/api/admin/onboarding/template?operationType=${operationType}`;

  return (
    <section aria-label="Member onboarding workspace" className="grid min-w-0 gap-6">
      <div className="section-band grid gap-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <span className="eyebrow">Onboarding intake</span>
            <h2 className="mt-2 font-[family-name:var(--font-heading)] text-2xl font-extrabold tracking-tight">
              {committee ? "Build an executive roster draft" : "Build a member profile draft"}
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted-foreground)]">
              Inspect and map the source first. Nothing changes in the member registry or public committee until a validated draft is explicitly published.
              {targetTermLabel ? ` Target: ${targetTermLabel}.` : ""}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <a className="admin-btn admin-btn--ghost" download href={`${downloadBase}&format=csv`}><Download aria-hidden="true" size={15} /> CSV template</a>
            <a className="admin-btn admin-btn--ghost" download href={`${downloadBase}&format=xlsx`}><FileSpreadsheet aria-hidden="true" size={15} /> XLSX template</a>
          </div>
        </div>

        <fieldset className="grid gap-3">
          <legend className="text-sm font-bold">Choose a source</legend>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {SOURCE_OPTIONS.map((option) => (
              <label
                className={`grid cursor-pointer gap-1 rounded-xl border p-3 transition-colors focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--brand-blue)] ${sourceKind === option.value ? "border-[var(--brand-blue)] bg-[var(--card)]" : "border-[var(--line)] bg-[var(--card)] hover:border-[var(--brand-blue)]"}`}
                key={option.value}
              >
                <span className="flex items-center gap-2 text-sm font-bold">
                  <input aria-label={option.label} checked={sourceKind === option.value} name="onboarding-source-kind" onChange={() => changeSource(option.value)} type="radio" /> {option.label}
                </span>
                <span className="pl-6 text-xs leading-5 text-[var(--muted-foreground)]">{option.description}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {sourceKind === "manual" ? <ManualRowsEditor committee={committee} onChange={setManualRows} rows={manualRows} /> : null}
        {sourceKind === "csv" || sourceKind === "xlsx" ? (
          <label className="input-label">
            {sourceKind === "csv" ? "CSV file" : "Excel workbook"}
            <input
              accept={sourceKind === "csv" ? ".csv,text/csv" : ".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}
              aria-label={sourceKind === "csv" ? "Upload CSV file" : "Upload Excel workbook"}
              onChange={(event) => selectFile(event.currentTarget.files?.[0] ?? null)}
              ref={fileInputRef}
              type="file"
            />
            <span className="text-xs font-normal text-[var(--muted-foreground)]">UTF-8, no more than 1,000 rows or 2 MB.</span>
          </label>
        ) : null}
        {sourceKind === "pasted_tsv" ? (
          <label className="input-label">
            Paste tab-separated rows
            <textarea onChange={(event) => setSourceText(event.currentTarget.value)} placeholder="Copy cells from Excel or Google Sheets, including the heading row." rows={9} value={sourceText} />
          </label>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <button className="admin-btn admin-btn--primary" disabled={isPending} onClick={() => run("Inspecting source", () => inspectSource())} type="button">
            {isPending && pendingLabel === "Inspecting source" ? <Loader2 aria-hidden="true" className="animate-spin" size={15} /> : <Upload aria-hidden="true" size={15} />} Inspect source
          </button>
          <span aria-live="polite" className="text-sm text-[var(--muted-foreground)]">
            {sourceFile ? `${sourceFile.name} selected.` : "Source files are inspected in memory and are not stored."}
          </span>
        </div>
        <Feedback feedback={feedback} />
      </div>

      {inspection ? (
        <div className="section-band grid gap-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <span className="eyebrow">Map and review</span>
              <h3 className="mt-2 text-xl font-extrabold">Match source headings to profile fields</h3>
              <p className="mt-2 text-sm text-[var(--muted-foreground)]">
                {inspection.rowCount} row{inspection.rowCount === 1 ? "" : "s"} ready for draft validation
              </p>
            </div>
            <span className="abadge abadge--info">SHA-256 {inspection.sourceSha256.slice(0, 12)}…</span>
          </div>

          {inspection.availableSheets.length > 1 ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <label className="input-label flex-1">
                Workbook sheet
                <select onChange={(event) => setSheetName(event.currentTarget.value)} value={sheetName}>
                  {inspection.availableSheets.map((sheet) => <option key={sheet} value={sheet}>{sheet}</option>)}
                </select>
              </label>
              <button className="admin-btn admin-btn--secondary" disabled={isPending} onClick={() => run("Loading sheet", () => inspectSource(sheetName))} type="button">
                Load selected sheet
              </button>
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {relevantFields.map((definition) => (
              <label className="input-label" key={definition.field}>
                {`Map ${definition.label}`}
                <select
                  onChange={(event) => {
                    const value = event.currentTarget.value;
                    setMapping((current) => ({ ...current, [definition.field]: value || undefined }));
                  }}
                  value={mapping[definition.field] ?? ""}
                >
                  <option value="">Not mapped</option>
                  {inspection.headers.map((header) => <option key={header.key} value={header.key}>{header.label}</option>)}
                </select>
              </label>
            ))}
          </div>

          <div className="admin-responsive-table-shell rounded-xl border border-[var(--line)]">
            <table className="admin-responsive-table w-full text-left text-sm">
              <thead className="border-b border-[var(--line)] bg-[var(--card)] text-xs uppercase tracking-wider text-[var(--muted-foreground)]">
                <tr>
                  <th className="px-4 py-3" scope="col">Row</th>
                  {inspection.headers.map((header) => <th className="px-4 py-3" key={header.key} scope="col">{header.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {inspection.previewRows.slice(0, 5).map((row) => (
                  <tr className="border-b border-[var(--line)] last:border-0" key={row.sourceRowNumber}>
                    <td className="px-4 py-3 font-mono" data-label="Row">{row.sourceRowNumber}</td>
                    {inspection.headers.map((header) => (
                      <td className="max-w-64 px-4 py-3" data-label={header.label} key={header.key}><span className="line-clamp-3">{row.values[header.key] || "—"}</span></td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button className="admin-btn admin-btn--primary w-full sm:w-fit" disabled={isPending} onClick={() => run("Saving draft", saveDraft)} type="button">
            <Save aria-hidden="true" size={15} /> Save draft
          </button>
        </div>
      ) : null}

      {draft ? (
        <div className="section-band grid gap-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <span className="eyebrow">Draft review</span>
              <h3 className="mt-2 text-xl font-extrabold">Correct, exclude, and validate rows</h3>
              <p className="mt-2 text-sm text-[var(--muted-foreground)]">Revision {draft.draftRevision} · {draft.originalFilename || "Manual entry"}</p>
            </div>
            <span className={`abadge ${statusClass(draft.status)}`}>{draft.status}</span>
          </div>

          <div aria-label="Draft validation summary" className="admin-metric-grid">
            <div className="admin-metric-card" data-tone="success">
              <div className="admin-metric-card__icon"><CheckCircle2 aria-hidden="true" size={16} /></div>
              <p className="admin-metric-card__value">{validRows} valid</p>
            </div>
            <div className="admin-metric-card" data-tone={errorRows ? "danger" : "info"}>
              <div className="admin-metric-card__icon"><AlertTriangle aria-hidden="true" size={16} /></div>
              <p className="admin-metric-card__value">{errorRows} need correction</p>
            </div>
            <div className="admin-metric-card">
              <div className="admin-metric-card__icon"><FileText aria-hidden="true" size={16} /></div>
              <p className="admin-metric-card__value">{excludedRows} excluded</p>
            </div>
          </div>

          <div className="grid gap-4">
            {draft.rows.map((row) => (
              <DraftRowEditor
                disabled={Boolean(isPending || terminal)}
                draftRevision={draft.draftRevision}
                key={`${row.id}-${draft.draftRevision}`}
                onExclude={(rowId, excluded, reason) => run("Updating row", () => excludeRow(rowId, excluded, reason))}
                onSave={(rowId, rawData) => run("Saving correction", () => saveRow(rowId, rawData))}
                row={row}
              />
            ))}
          </div>

          <div className="grid gap-4 rounded-xl border border-[var(--line)] bg-[var(--card)] p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h4 className="font-bold">Validation gate</h4>
                <p className="mt-1 text-sm text-[var(--muted-foreground)]">Any edit or exclusion invalidates the previous validation revision.</p>
              </div>
              <button
                className="admin-btn admin-btn--secondary"
                disabled={Boolean(isPending || terminal || errorRows > 0 || activeRows.length === 0)}
                onClick={() => run("Validating draft", validateDraft)}
                type="button"
              >
                <ShieldCheck aria-hidden="true" size={15} /> Validate draft
              </button>
            </div>

            <label className="flex items-start gap-3 text-sm font-semibold">
              <input
                checked={confirmPublish}
                className="mt-1"
                disabled={!validated || terminal}
                onChange={(event) => setConfirmPublish(event.currentTarget.checked)}
                type="checkbox"
              />
              <span>I confirm that I reviewed every active row and want to publish this draft</span>
            </label>
            {committee ? (
              <label className="flex items-start gap-3 text-sm">
                <input
                  checked={makeCurrent}
                  className="mt-1"
                  disabled={!validated || terminal}
                  onChange={(event) => setMakeCurrent(event.currentTarget.checked)}
                  type="checkbox"
                />
                <span>Make this the current committee</span>
              </label>
            ) : null}
            <button
              className="admin-btn admin-btn--success w-full sm:w-fit"
              disabled={Boolean(isPending || terminal || !validated || !confirmPublish)}
              onClick={() => run("Publishing draft", publishDraft)}
              type="button"
            >
              <ShieldCheck aria-hidden="true" size={15} /> Publish draft
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
