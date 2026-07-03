import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { parse } from "csv-parse/sync";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config();

const REPORT_ROOT = path.join(process.cwd(), "artifacts", "reports", "certificates");

const HEADER_ALIASES = {
  certificate_id: ["certificate_id", "certificateid", "certificateID"],
  full_name: ["full_name", "fullname", "fullName", "name"],
  first_name: ["first_name", "firstname", "firstName"],
  last_name: ["last_name", "lastname", "lastName"],
  details: ["details"],
  exam_or_event: ["exam_or_event", "examorevent"],
  exam_or_event_name: ["exam_or_event_name", "examoreventname"],
  issue_date: ["issue_date", "issuedate", "issueDate"],
  asset_url: ["asset_url", "asseturl", "assetUrl"],
  source_document_id: ["source_document_id", "documentid", "sourceDocumentId"],
  source_record_id: ["source_record_id", "recordid", "sourceRecordId"],
};

export function ensureReportDirectory() {
  fs.mkdirSync(REPORT_ROOT, { recursive: true });
  return REPORT_ROOT;
}

export function toStamp() {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

export function sha256(content) {
  return crypto.createHash("sha256").update(content).digest("hex");
}

export function resolveReportPath(name, explicitPath = "") {
  ensureReportDirectory();
  return explicitPath
    ? path.resolve(process.cwd(), explicitPath)
    : path.join(REPORT_ROOT, `${name}-${toStamp()}.json`);
}

function normalizeHeader(value) {
  return String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

function findField(record, aliases) {
  for (const alias of aliases) {
    const normalizedAlias = normalizeHeader(alias);
    const match = Object.entries(record).find(
      ([header]) => normalizeHeader(header) === normalizedAlias
    );

    if (match && typeof match[1] === "string") {
      return match[1].trim();
    }
  }

  return "";
}

function normalizeDate(value) {
  const trimmed = String(value || "").trim();

  if (!trimmed) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  const parsed = new Date(trimmed);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString().slice(0, 10);
}

function normalizeUrl(value) {
  const trimmed = String(value || "").trim();

  if (!trimmed) {
    return null;
  }

  try {
    const parsed = new URL(trimmed);
    return /^https?:$/.test(parsed.protocol) ? parsed.toString() : null;
  } catch {
    return null;
  }
}

export function normalizeCertificateRow(record, rowNumber) {
  const certificateId = findField(record, HEADER_ALIASES.certificate_id).toUpperCase();
  const firstName = findField(record, HEADER_ALIASES.first_name);
  const lastName = findField(record, HEADER_ALIASES.last_name);
  const fullName =
    findField(record, HEADER_ALIASES.full_name) ||
    [firstName, lastName].filter(Boolean).join(" ").trim();
  const details = findField(record, HEADER_ALIASES.details);
  const examOrEvent = findField(record, HEADER_ALIASES.exam_or_event);
  const examOrEventName = findField(record, HEADER_ALIASES.exam_or_event_name);
  const issueDate = normalizeDate(findField(record, HEADER_ALIASES.issue_date));
  const assetUrl = normalizeUrl(findField(record, HEADER_ALIASES.asset_url));
  const sourceDocumentId = findField(record, HEADER_ALIASES.source_document_id) || null;
  const sourceRecordId = findField(record, HEADER_ALIASES.source_record_id) || null;

  const errors = [];

  if (!certificateId) errors.push("certificate_id is required");
  if (!fullName) errors.push("full_name is required");
  if (!examOrEvent) errors.push("exam_or_event is required");
  if (!examOrEventName) errors.push("exam_or_event_name is required");
  if (!issueDate) errors.push("issue_date must be a valid date");

  return {
    rowNumber,
    raw: record,
    parseError: errors.length ? errors.join("; ") : null,
    normalized: errors.length
      ? null
      : {
          certificate_id: certificateId,
          full_name: fullName,
          details,
          exam_or_event: examOrEvent,
          exam_or_event_name: examOrEventName,
          issue_date: issueDate,
          asset_url: assetUrl,
          source_document_id: sourceDocumentId,
          source_record_id: sourceRecordId,
        },
  };
}

export function loadCertificateCsv(filePath) {
  const resolvedPath = path.resolve(process.cwd(), filePath);

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`CSV file not found: ${resolvedPath}`);
  }

  const content = fs.readFileSync(resolvedPath, "utf8");
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    bom: true,
    trim: true,
  });

  const rows = records.map((record, index) =>
    normalizeCertificateRow(record, index + 2)
  );

  return {
    filePath: resolvedPath,
    checksum: sha256(content),
    rawContent: content,
    rows,
  };
}

export function buildSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;

  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY are required."
    );
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export function chunk(values, size = 250) {
  const batches = [];

  for (let index = 0; index < values.length; index += size) {
    batches.push(values.slice(index, index + size));
  }

  return batches;
}

export function dedupeNormalizedRows(rows) {
  const byCertificateId = new Map();
  const duplicates = [];

  for (const row of rows) {
    if (!row.normalized) {
      continue;
    }

    const key = row.normalized.certificate_id;

    if (byCertificateId.has(key)) {
      duplicates.push(key);
    }

    byCertificateId.set(key, row);
  }

  return {
    cleanRows: Array.from(byCertificateId.values()),
    duplicateCertificateIds: Array.from(new Set(duplicates)),
  };
}

export function writeJsonReport(filePath, report) {
  ensureReportDirectory();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}
