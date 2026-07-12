"use client";

import { bulkImportCertificatesAction } from "@/app/admin/certificates/actions";
import { Download, FileSpreadsheet, RotateCcw, Upload } from "lucide-react";
import { useRef, useState } from "react";

const MAX_CLIENT_BYTES = 2 * 1024 * 1024;

function defaultSourceName(fileName: string) {
  const cleaned = fileName
    .replace(/\.csv$/i, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 140);

  return cleaned || "certificate-import";
}

export function CertificateCsvImportPanel() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [csvText, setCsvText] = useState("");
  const [fileError, setFileError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [sourceName, setSourceName] = useState("");

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
    if (fileInputRef.current) fileInputRef.current.value = "";
    setCsvText("");
    setFileError(null);
    setFileName(null);
  }

  return (
    <form
      action={bulkImportCertificatesAction}
      className="section-band grid gap-4"
    >
      <div className="grid gap-3">
        <div>
          <span className="eyebrow">Bulk import</span>
          <h2 className="mt-3 font-[family-name:var(--font-heading)] text-[clamp(1.5rem,3vw,2rem)] font-extrabold leading-[1.05] tracking-normal">
            CSV certificate import
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted-foreground)]">
            Download the template, replace or add to the three sample rows, then choose the file.
            Template rows are ignored automatically. Common headers, spaces, type labels, and Excel-style dates are normalized before import.
            You can still paste CSV rows instead.
          </p>
        </div>

        <div className="portal-info-row">
          <span className="portal-info-row__label">Expected columns</span>
          <code className="break-words text-xs leading-6 text-[var(--foreground)]">
            certId, fullName, type, eventName, issueDate, assetUrl?, details?
          </code>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <a
          className="secondary-button min-h-11 w-full justify-center sm:w-auto"
          download
          href="/templates/jnuits-certificate-import-template.csv"
        >
          <Download size={15} /> Download CSV template
        </a>

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
        <button className="primary-button min-h-11 w-full sm:w-auto" type="submit">
          <Upload size={15} /> Import certificates
        </button>
        {csvText ? (
          <button className="secondary-button min-h-11 w-full sm:w-auto" onClick={clearFile} type="button">
            <RotateCcw size={15} /> Clear import data
          </button>
        ) : null}
      </div>
    </form>
  );
}
