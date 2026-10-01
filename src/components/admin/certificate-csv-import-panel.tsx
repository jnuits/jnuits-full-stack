"use client";

import {
  bulkImportCertificatesAction,
  inspectCertificateImportAction,
} from "@/app/admin/certificates/actions";
import {
  CERTIFICATE_IMPORT_FIELDS,
  createCertificateIssueReport,
  formatCertificateImportIssue,
  type CertificateImportInspection,
} from "@/lib/certificates/import-catalog";
import { Download, FileSpreadsheet, RotateCcw, Upload } from "lucide-react";
import { useRef, useState, useTransition } from "react";

const MAX_CLIENT_BYTES = 2 * 1024 * 1024;
const CERTIFICATE_TEMPLATE_DOWNLOADS = [
  { format: "csv", kind: "blank", label: "Blank CSV" },
  { format: "xlsx", kind: "blank", label: "Blank XLSX" },
  { format: "csv", kind: "sample", label: "Fictional sample CSV" },
  { format: "xlsx", kind: "sample", label: "Fictional sample XLSX" },
] as const;

function defaultSourceName(fileName: string) {
  const cleaned = fileName
    .replace(/\.csv$/i, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 140);

  return cleaned || "certificate-import";
}

export function CertificateCsvImportPanel() {
  const formRef = useRef<HTMLFormElement>(null);
  const checkRevisionRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [csvText, setCsvText] = useState("");
  const [fileError, setFileError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [sourceName, setSourceName] = useState("");
  const [inspection, setInspection] = useState<CertificateImportInspection | null>(null);
  const [checking, startChecking] = useTransition();

  function invalidateInspection() {
    checkRevisionRef.current += 1;
    setInspection(null);
  }

  function checkData() {
    if (!formRef.current) return;
    const data = new FormData(formRef.current);
    const revision = checkRevisionRef.current;
    startChecking(async () => {
      try {
        const result = await inspectCertificateImportAction(data);
        if (revision === checkRevisionRef.current) setInspection(result);
      } catch {
        if (revision === checkRevisionRef.current) {
          setInspection({ issues: [], message: "Data could not be checked. Please try again.", ok: false });
        }
      }
    });
  }

  function downloadReport() {
    if (!inspection?.issues.length) return;
    const url = URL.createObjectURL(new Blob([createCertificateIssueReport(inspection.issues)], {
      type: "text/csv;charset=utf-8",
    }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "jnuits-certificate-validation-errors.csv";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1_000);
  }

  function selectFile(file: File | null) {
    setFileError(null);

    if (!file) {
      setFileName(null);
      return;
    }

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setFileError("Choose a file with a .csv extension.");
      return;
    }

    if (file.size === 0) {
      setFileError("The selected CSV file is empty.");
      return;
    }

    if (file.size > MAX_CLIENT_BYTES) {
      setFileError("The selected CSV is larger than 2 MB. Split it into smaller imports.");
      return;
    }

    // Keep uploaded files out of the paste field so multipart requests contain one copy.
    setCsvText("");
    setFileName(file.name);
    setSourceName((current) => current || defaultSourceName(file.name));
  }

  function clearFile() {
    invalidateInspection();
    if (fileInputRef.current) fileInputRef.current.value = "";
    setCsvText("");
    setFileError(null);
    setFileName(null);
  }

  return (
    <form
      action={bulkImportCertificatesAction}
      className="section-band grid gap-4"
      onChange={invalidateInspection}
      ref={formRef}
    >
      <div className="grid gap-3">
        <div>
          <span className="eyebrow">Bulk import</span>
          <h2 className="mt-3 font-[family-name:var(--font-heading)] text-[clamp(1.5rem,3vw,2rem)] font-extrabold leading-[1.05] tracking-normal">
            CSV certificate import
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted-foreground)]">
            Start with a blank file or use the completed fictional sample as a guide, then choose your CSV.
            If using XLSX, export the Certificates worksheet as CSV before uploading.
            Rows whose certificate IDs begin with EXAMPLE-CERT- are ignored automatically. Common headers, spaces, type labels, and ISO, day-first, or Excel-style dates are normalized before import.
            You can still paste CSV rows instead.
          </p>
        </div>

        <div className="portal-info-row">
          <span className="portal-info-row__label">Expected columns</span>
          <code className="break-words text-xs leading-6 text-[var(--foreground)]">
            certId, fullName, type, eventName, issueDate, assetUrl?, details?
          </code>
        </div>

        <details className="rounded-xl border border-[var(--line)] bg-[var(--card)] p-4">
          <summary className="cursor-pointer text-sm font-bold">Field requirements</summary>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {CERTIFICATE_IMPORT_FIELDS.map((field) => (
              <div className="rounded-lg border border-[var(--line)] p-3" key={field.key}>
                <dt className="text-sm font-bold">
                  {field.label} · {field.required ? "Required" : "Optional"}
                </dt>
                <dd className="mt-1 text-xs leading-5 text-[var(--muted-foreground)]">
                  {field.acceptedFormat}. {field.limits}. Example: {field.example}.
                </dd>
              </div>
            ))}
          </dl>
        </details>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {CERTIFICATE_TEMPLATE_DOWNLOADS.map((download) => (
          <a
            className="secondary-button min-h-11 w-full justify-center"
            download
            href={`/api/admin/certificates/import-template?kind=${download.kind}&format=${download.format}`}
            key={`${download.kind}-${download.format}`}
          >
            <Download aria-hidden="true" size={15} /> {download.label}
          </a>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label
          className="secondary-button min-h-11 w-full cursor-pointer justify-center sm:w-auto"
          htmlFor="certificate-csv-file"
        >
          <FileSpreadsheet size={15} /> Choose CSV file
          <input
            accept=".csv,text/csv"
            className="sr-only"
            id="certificate-csv-file"
            name="csv_file"
            onChange={(event) => selectFile(event.currentTarget.files?.[0] || null)}
            ref={fileInputRef}
            type="file"
          />
        </label>
      </div>

      <div aria-live="polite" className="text-sm text-[var(--muted-foreground)]">
        {fileName ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-[var(--foreground)]">{fileName}</span>
            <span>is ready to import.</span>
            <button className="text-sm font-semibold text-[var(--brand-blue)] underline" onClick={clearFile} type="button">
              Clear file
            </button>
          </div>
        ) : (
          "No file selected. Paste rows below if you prefer."
        )}
      </div>

      {fileError ? <p className="portal-message portal-message--error" role="alert">{fileError}</p> : null}

      <div className="portal-form-grid">
        <label className="input-label" htmlFor="import-source">
          Batch source name
          <input
            id="import-source"
            name="source_name"
            onChange={(event) => setSourceName(event.currentTarget.value)}
            placeholder="certificate-import-2026-07"
            value={sourceName}
          />
        </label>

        <label className="input-label" htmlFor="import-conflict">
          On duplicate certificate ID
          <select defaultValue="skip" id="import-conflict" name="on_conflict">
            <option value="skip">Skip and keep the existing record</option>
            <option value="update">Overwrite the existing record</option>
          </select>
        </label>

        <label className="input-label sm:col-span-2" htmlFor="import-csv">
          CSV data
          <textarea
            disabled={Boolean(fileName)}
            id="import-csv"
            name={fileName ? undefined : "csv_data"}
            onChange={(event) => setCsvText(event.currentTarget.value)}
            placeholder={
              fileName
                ? "Clear the selected file to paste CSV rows instead."
                : "Paste CSV rows here, or choose a CSV file above."
            }
            rows={10}
            value={csvText}
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-3">
        <button className="secondary-button min-h-11 w-full sm:w-auto" disabled={checking || Boolean(fileError)} onClick={checkData} type="button">
          {checking ? "Checking data…" : "Check data"}
        </button>
        <button className="primary-button min-h-11 w-full sm:w-auto" disabled={checking || Boolean(fileError)} type="submit">
          <Upload size={15} /> Import certificates
        </button>
        {csvText ? (
          <button className="secondary-button min-h-11 w-full sm:w-auto" onClick={clearFile} type="button">
            <RotateCcw size={15} /> Clear import data
          </button>
        ) : null}
      </div>
      {inspection ? (
        <section aria-label="Certificate validation report" className="grid min-w-0 gap-3">
          <p className={`portal-message ${inspection.ok ? "portal-message--success" : "portal-message--error"}`} role="status">
            {inspection.message}
          </p>
          {inspection.issues.length ? (
            <>
              <button className="secondary-button min-h-11 w-full sm:w-auto sm:justify-self-start" onClick={downloadReport} type="button">
                <Download aria-hidden="true" size={15} /> Download error report
              </button>
              <ul className="grid gap-2 text-sm">
                {inspection.issues.slice(0, 20).map((issue, index) => (
                  <li className="break-words rounded-lg border border-[var(--line)] p-3" key={`${issue.sourceRow}-${issue.field}-${index}`}>
                    Row {issue.sourceRow}: {formatCertificateImportIssue(issue)}
                  </li>
                ))}
              </ul>
              {inspection.issues.length > 20 ? <p className="text-sm">Showing the first 20 issues. Download the report for all {inspection.issues.length} issues.</p> : null}
            </>
          ) : null}
        </section>
      ) : null}
    </form>
  );
}
