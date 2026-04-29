import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { parse } from "csv-parse/sync";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config();

const REPORT_ROOT = path.join(process.cwd(), "artifacts", "reports", "membership");
const INVITATION_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function ensureMembershipReportDirectory() {
  fs.mkdirSync(REPORT_ROOT, { recursive: true });
  return REPORT_ROOT;
}

export function toStamp() {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

export function resolveMembershipReportPath(name, explicitPath = "") {
  ensureMembershipReportDirectory();
  return explicitPath
    ? path.resolve(process.cwd(), explicitPath)
    : path.join(REPORT_ROOT, `${name}-${toStamp()}.json`);
}

export function writeJsonReport(filePath, report) {
  ensureMembershipReportDirectory();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
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

export function parseCliArgs(argv) {
  const args = {
    apply: false,
    dryRun: true,
    expiryDays: 14,
    file: "",
    generateInvitations: false,
    maxUses: 1,
    persistReport: false,
    report: "",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];

    if (value === "--apply") {
      args.apply = true;
      args.dryRun = false;
      continue;
    }

    if (value === "--dry-run") {
      args.apply = false;
      args.dryRun = true;
      continue;
    }

    if (value === "--generate-invitations") {
      args.generateInvitations = true;
      continue;
    }

    if (value === "--persist-report") {
      args.persistReport = true;
      continue;
    }

    if (value === "--file") {
      args.file = argv[index + 1] || "";
      index += 1;
      continue;
    }

    if (value === "--report") {
      args.report = argv[index + 1] || "";
      index += 1;
      continue;
    }

    if (value === "--max-uses") {
      args.maxUses = Number.parseInt(argv[index + 1] || "1", 10) || 1;
      index += 1;
      continue;
    }

    if (value === "--expiry-days") {
      args.expiryDays = Number.parseInt(argv[index + 1] || "14", 10) || 14;
      index += 1;
    }
  }

  return args;
}

function clean(value) {
  const trimmed = String(value || "").trim();
  return trimmed ? trimmed : "";
}

function normalizePositiveInt(value) {
  if (!clean(value)) {
    return null;
  }

  const parsed = Number.parseInt(clean(value), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function normalizeUrl(value) {
  const trimmed = clean(value);

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

export function normalizeDate(value) {
  const trimmed = clean(value);

  if (!trimmed) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

export function normalizeBoolean(value, fallback = false) {
  const normalized = clean(value).toLowerCase();

  if (!normalized) {
    return fallback;
  }

  return ["true", "1", "yes", "y"].includes(normalized);
}

export function normalizeMemberType(value) {
  const normalized = clean(value).toLowerCase();

  if (["current", "alumni"].includes(normalized)) {
    return normalized;
  }

  return "current";
}

export function normalizeDepartmentToken(value) {
  return clean(value)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function normalizeProfessionalVisibility(value) {
  const normalized = clean(value).toLowerCase();

  if (["public", "members-only", "private"].includes(normalized)) {
    return normalized;
  }

  return "members-only";
}

export function normalizeJnuitsId(value) {
  const raw = clean(value).toUpperCase();

  if (!raw) {
    return "";
  }

  const standardMatch = raw.match(/^JNUITS-([0-9]{7})$/i);

  if (standardMatch) {
    const serial = Number.parseInt(standardMatch[1].slice(4), 10);
    return serial > 0 ? `JNUITS-${standardMatch[1]}` : "";
  }

  const digitsMatch = raw.match(/^([0-9]{7})$/);

  if (digitsMatch) {
    const serial = Number.parseInt(digitsMatch[1].slice(4), 10);
    return serial > 0 ? `JNUITS-${digitsMatch[1]}` : "";
  }

  return "";
}

export function buildGeneratedJnuitsId(existingIds, now = new Date()) {
  const yearPrefix = String(now.getUTCFullYear());
  let maxSequence = 0;

  for (const value of existingIds) {
    const normalized = normalizeJnuitsId(value);

    if (!normalized) {
      continue;
    }

    const match = normalized.match(/^JNUITS-([0-9]{4})([0-9]{3})$/);

    if (!match || match[1] !== yearPrefix) {
      continue;
    }

    const sequence = Number.parseInt(match[2], 10);

    if (Number.isFinite(sequence) && sequence > maxSequence) {
      maxSequence = sequence;
    }
  }

  return `JNUITS-${yearPrefix}${String(maxSequence + 1).padStart(3, "0")}`;
}

export function hashInvitationCode(value) {
  return crypto
    .createHmac("sha256", process.env.SUPABASE_SECRET_KEY)
    .update(clean(value).toUpperCase())
    .digest("hex");
}

export function generateInvitationCode(length = 12) {
  const bytes = crypto.randomBytes(length);
  let output = "";

  for (let index = 0; index < bytes.length; index += 1) {
    output += INVITATION_ALPHABET[bytes[index] % INVITATION_ALPHABET.length];
  }

  return output;
}

export function getInvitationExpiryIso(days = 14) {
  const safeDays = Number.isFinite(days) ? Math.max(1, Math.min(60, days)) : 14;
  return new Date(Date.now() + safeDays * 24 * 60 * 60 * 1000).toISOString();
}

export async function getNextInvitation(admin) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = generateInvitationCode();
    const codeHash = hashInvitationCode(code);
    const { data } = await admin
      .from("member_invitations")
      .select("id")
      .eq("code_hash", codeHash)
      .maybeSingle();

    if (!data) {
      return {
        code,
        codeHash,
      };
    }
  }

  throw new Error("Unable to generate a unique invitation code.");
}

export function loadCsv(filePath) {
  const resolvedPath = path.resolve(process.cwd(), filePath);

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`CSV file not found: ${resolvedPath}`);
  }

  const content = fs.readFileSync(resolvedPath, "utf8");
  const rows = parse(content, {
    bom: true,
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  return {
    content,
    filePath: resolvedPath,
    rows,
  };
}

export function normalizeMemberRow(record) {
  const departmentRaw = clean(record.departmentCode || record.department || "");
  const batchRaw = clean(record.batchNo || record.batch || "");

  return {
    alumniSince: normalizeDate(record.alumniSince),
    batchNo: normalizePositiveInt(batchRaw),
    currentOrganization: clean(record.currentOrganization) || null,
    departmentCode: departmentRaw || null,
    designation: clean(record.designation) || null,
    email: clean(record.email).toLowerCase() || null,
    expiresAt: clean(record.expiresAt) || null,
    fullName: clean(record.fullName),
    generateInvitation: normalizeBoolean(record.generateInvitation),
    jnuitsId: normalizeJnuitsId(record.jnuitsId),
    linkedinUrl: normalizeUrl(record.linkedinUrl),
    maxUses: normalizePositiveInt(record.maxUses),
    memberType: normalizeMemberType(record.memberType),
    phone: clean(record.phone) || null,
    professionalVisibility: normalizeProfessionalVisibility(
      record.professionalVisibility
    ),
    websiteUrl: normalizeUrl(record.websiteUrl),
    workLocation: clean(record.workLocation) || null,
  };
}

export async function persistOperatorReport(admin, options) {
  const createdByUserId = clean(process.env.SUPABASE_REPORT_ACTOR_USER_ID) || null;

  await admin.from("operator_reports").insert({
    created_by_user_id: createdByUserId,
    report: options.report,
    report_type: options.reportType,
    status: "completed",
    summary: options.summary,
    title: options.title,
  });
}
