// Backend-only corrective migration for the committee Phase A cleanup.
// It is idempotent and defaults to dry-run mode; run with:
//   node scripts/migrations/fix-committee-phase-a.ts --apply
// The script seeds canonical EC terms, archives the legacy advisory term,
// migrates advisor-like roster rows to advisor_profiles, and prints invariant checks.
import path from "node:path";
import process from "node:process";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local"), quiet: true });
dotenv.config({ quiet: true });

type Row = Record<string, unknown>;
type WritePayload = Record<string, unknown>;
type QueryError = {
  code?: string;
  details?: string;
  hint?: string;
  message?: string;
};
type QueryResultLike = {
  error: QueryError | null;
};
type SelectResult = {
  columns: string[];
  rows: Row[];
};
type CheckStatus = "PASS" | "FAIL" | "SKIP";
type CheckResult = {
  check: string;
  details: string;
  status: CheckStatus;
};

const applyMode = process.argv.includes("--apply");
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_SECRET_KEY ||
  "";

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "Missing Supabase credentials. Set NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL, and one service key env var."
  );
}

const admin = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

const tableColumns = new Map<string, Set<string>>();
const skippedColumns = new Map<string, Set<string>>();

function logStep(name: string) {
  console.log(`\n=== ${name} ===`);
}

function logWarn(message: string) {
  console.warn(`[warn] ${message}`);
}

function logError(message: string) {
  console.error(`[error] ${message}`);
}

function assertNoQueryError(label: string, result: QueryResultLike) {
  if (result.error) {
    throw new Error(`${label}: ${formatError(result.error)}`);
  }
}

function formatError(error: QueryError) {
  return [error.message, error.details, error.hint, error.code]
    .filter(Boolean)
    .join(" | ");
}

function errorText(error: QueryError) {
  return formatError(error).toLowerCase();
}

function isMissingColumnError(error: QueryError) {
  const text = errorText(error);
  return (
    error.code === "PGRST204" ||
    text.includes("could not find") ||
    text.includes("column") && text.includes("does not exist") ||
    text.includes("schema cache")
  );
}

function isStatusConstraintError(error: QueryError) {
  const text = errorText(error);
  return (
    text.includes("check constraint") ||
    text.includes("violates") && text.includes("status") ||
    text.includes("committee_terms_status") ||
    text.includes("committee_assignments_status")
  );
}

function extractMissingColumns(error: QueryError, candidates: string[]) {
  const text = formatError(error);
  const found = new Set<string>();
  const singleQuoteMatch = text.match(/'([^']+)' column/);
  const doubleQuoteMatch = text.match(/column "([^"]+)"/);
  const qualifiedMatch = text.match(
    /column\s+(?:[a-zA-Z_][a-zA-Z0-9_]*\.)?([a-zA-Z_][a-zA-Z0-9_]*)\s+does not exist/i
  );

  if (singleQuoteMatch?.[1]) {
    found.add(singleQuoteMatch[1]);
  }

  if (doubleQuoteMatch?.[1]) {
    found.add(doubleQuoteMatch[1]);
  }

  if (qualifiedMatch?.[1]) {
    found.add(qualifiedMatch[1]);
  }

  for (const candidate of candidates) {
    if (
      text.includes(`'${candidate}'`) ||
      text.includes(`"${candidate}"`) ||
      text.includes(`.${candidate} does not exist`) ||
      text.includes(` ${candidate} `)
    ) {
      found.add(candidate);
    }
  }

  return [...found].filter((column) => candidates.includes(column));
}

function rememberColumns(table: string, columns: string[]) {
  tableColumns.set(table, new Set(columns));
}

function rememberSkipped(table: string, columns: string[]) {
  if (!skippedColumns.has(table)) {
    skippedColumns.set(table, new Set());
  }

  const tableSet = skippedColumns.get(table);
  for (const column of columns) {
    tableSet?.add(column);
  }
}

function hasColumn(table: string, column: string) {
  return tableColumns.get(table)?.has(column) ?? false;
}

function addIfColumn(
  table: string,
  payload: WritePayload,
  column: string,
  value: unknown
) {
  if (hasColumn(table, column)) {
    payload[column] = value;
  }
}

function pickWritable(table: string, payload: WritePayload) {
  const available = tableColumns.get(table);

  if (!available) {
    return payload;
  }

  return Object.fromEntries(
    Object.entries(payload).filter(([column]) => available.has(column))
  );
}

async function selectAdaptive(
  table: string,
  requestedColumns: string[],
  label: string
): Promise<SelectResult> {
  let columns = [...requestedColumns];

  while (columns.length > 0) {
    const result = await admin.from(table).select(columns.join(","));

    if (!result.error) {
      rememberColumns(table, columns);
      return {
        columns,
        rows: ((result.data ?? []) as unknown) as Row[],
      };
    }

    if (!isMissingColumnError(result.error)) {
      throw new Error(`${label}: ${formatError(result.error)}`);
    }

    const missing = extractMissingColumns(result.error, columns);
    if (missing.length === 0) {
      throw new Error(`${label}: ${formatError(result.error)}`);
    }

    rememberSkipped(table, missing);
    logWarn(`${label}: skipping missing column(s): ${missing.join(", ")}`);
    columns = columns.filter((column) => !missing.includes(column));
  }

  throw new Error(`${label}: all requested columns were unavailable.`);
}

async function updateByIdAdaptive(
  table: string,
  id: string,
  patch: WritePayload,
  label: string
) {
  const writable = pickWritable(table, patch);

  if (Object.keys(writable).length === 0) {
    logWarn(`${label}: no writable columns available; skipped.`);
    return;
  }

  if (!applyMode) {
    console.log(`[dry-run] update ${table} id=${id}`, writable);
    return;
  }

  const result = await admin.from(table).update(writable).eq("id", id);
  assertNoQueryError(label, result);
}

async function upsertAdaptive(
  table: string,
  payload: WritePayload,
  conflictKey: string,
  label: string
) {
  const writable = pickWritable(table, payload);

  if (Object.keys(writable).length === 0) {
    logWarn(`${label}: no writable columns available; skipped.`);
    return;
  }

  if (!applyMode) {
    console.log(`[dry-run] upsert ${table} on ${conflictKey}`, writable);
    return;
  }

  const result = await admin
    .from(table)
    .upsert(writable, { onConflict: conflictKey });
  assertNoQueryError(label, result);
}

async function insertAdaptive(
  table: string,
  payload: WritePayload,
  label: string
) {
  const writable = pickWritable(table, payload);

  if (Object.keys(writable).length === 0) {
    logWarn(`${label}: no writable columns available; skipped.`);
    return;
  }

  if (!applyMode) {
    console.log(`[dry-run] insert ${table}`, writable);
    return;
  }

  const result = await admin.from(table).insert(writable);
  assertNoQueryError(label, result);
}

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function asBoolean(value: unknown) {
  return value === true;
}

function normalizeName(value: unknown) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function rowId(row: Row) {
  const id = row.id;
  return typeof id === "string" ? id : "";
}

function termBySlug(terms: Row[], slug: string) {
  return terms.find((term) => asString(term.slug) === slug);
}

function buildTermPayload(term: {
  slug: string;
  title: string;
  termNumber: number;
  startsOn: string;
  endsOn?: string | null;
  electionDate?: string | null;
  status: string;
  isCurrent: boolean;
  isPublic: boolean;
  dateConfidence: string;
  tenureNote: string;
  targetExecutiveSlots: number;
}) {
  const payload: WritePayload = {
    slug: term.slug,
    title: term.title,
    starts_on: term.startsOn,
    ends_on: term.endsOn ?? null,
    status: term.status,
    is_public: term.isPublic,
  };

  addIfColumn("committee_terms", payload, "term_number", term.termNumber);
  addIfColumn("committee_terms", payload, "term_kind", "executive");
  addIfColumn("committee_terms", payload, "election_date", term.electionDate ?? null);
  addIfColumn("committee_terms", payload, "is_current", term.isCurrent);
  addIfColumn("committee_terms", payload, "date_confidence", term.dateConfidence);
  addIfColumn("committee_terms", payload, "tenure_note", term.tenureNote);
  addIfColumn(
    "committee_terms",
    payload,
    "target_executive_slots",
    term.targetExecutiveSlots
  );

  return payload;
}

function buildAdvisorPayload(profile: {
  advisorJnuitsId: string;
  advisorType: string;
  fullName: string;
  isCurrent: boolean;
  status: string;
  formerTitle: string | null;
  department: string | null;
  isPublic: boolean;
  note: string;
}) {
  const payload: WritePayload = {
    full_name: profile.fullName,
    advisor_type: profile.advisorType,
  };

  addIfColumn("advisor_profiles", payload, "advisor_jnuits_id", profile.advisorJnuitsId);
  addIfColumn("advisor_profiles", payload, "is_current", profile.isCurrent);
  addIfColumn("advisor_profiles", payload, "status", profile.status);
  addIfColumn("advisor_profiles", payload, "former_title", profile.formerTitle);
  addIfColumn("advisor_profiles", payload, "department", profile.department);
  addIfColumn("advisor_profiles", payload, "is_public", profile.isPublic);
  addIfColumn("advisor_profiles", payload, "joined_on", null);
  addIfColumn("advisor_profiles", payload, "left_on", null);
  addIfColumn("advisor_profiles", payload, "joined_at", null);
  addIfColumn("advisor_profiles", payload, "left_at", null);

  if (hasColumn("advisor_profiles", "tenure_note")) {
    payload.tenure_note = profile.note;
  } else if (hasColumn("advisor_profiles", "status_note")) {
    payload.status_note = profile.note;
  } else if (hasColumn("advisor_profiles", "bio")) {
    payload.bio = profile.note;
  }

  return payload;
}

function printSkippedColumns() {
  if (skippedColumns.size === 0) {
    return;
  }

  const rows = [...skippedColumns.entries()].map(([table, columns]) => ({
    table,
    skippedColumns: [...columns].join(", "),
  }));
  console.table(rows);
}

async function preflightRead() {
  logStep("Step 0 - Pre-flight read");

  const termsResult = await selectAdaptive(
    "committee_terms",
    [
      "id",
      "slug",
      "title",
      "is_current",
      "status",
      "term_kind",
      "is_public",
      "starts_on",
      "ends_on",
      "election_date",
      "date_confidence",
      "tenure_note",
      "target_executive_slots",
      "term_number",
    ],
    "committee_terms preflight"
  );

  const assignmentsResult = await selectAdaptive(
    "committee_assignments",
    [
      "id",
      "member_id",
      "display_name",
      "role_id",
      "term_id",
      "status",
      "is_public",
      "visibility",
      "metadata",
    ],
    "committee_assignments preflight"
  );

  const rolesResult = await selectAdaptive(
    "committee_roles",
    ["id", "code", "title", "role_group"],
    "committee_roles preflight"
  );

  const advisorResult = await selectAdaptive(
    "advisor_profiles",
    [
      "id",
      "advisor_jnuits_id",
      "full_name",
      "advisor_type",
      "is_current",
      "is_public",
      "former_title",
      "department",
      "status",
      "joined_on",
      "left_on",
      "joined_at",
      "left_at",
      "tenure_note",
      "status_note",
      "bio",
    ],
    "advisor_profiles preflight"
  );

  const rolesById = new Map(
    rolesResult.rows.map((role) => [rowId(role), role])
  );
  const termsById = new Map(
    termsResult.rows.map((term) => [rowId(term), term])
  );

  console.log("committee_terms");
  console.table(
    termsResult.rows.map((term) => ({
      id: term.id,
      slug: term.slug,
      title: term.title,
      is_current: term.is_current,
      status: term.status,
      term_kind: term.term_kind,
      is_public: term.is_public,
    }))
  );

  console.log("committee_assignments joined to terms/roles");
  console.table(
    assignmentsResult.rows.map((assignment) => {
      const term = termsById.get(asString(assignment.term_id));
      const role = rolesById.get(asString(assignment.role_id));
      return {
        id: assignment.id,
        member_id: assignment.member_id,
        display_name: assignment.display_name,
        role: role?.title ?? role?.code ?? assignment.role_id,
        role_group: role?.role_group,
        term_slug: term?.slug ?? assignment.term_id,
        status: assignment.status,
        is_public: assignment.is_public,
      };
    })
  );

  console.log(`advisor_profiles row count: ${advisorResult.rows.length}`);
  printSkippedColumns();

  const badAdvisoryExecutive = termsResult.rows.find(
    (term) =>
      asString(term.slug) === "advisory-committee" &&
      asString(term.term_kind) === "executive"
  );

  if (badAdvisoryExecutive) {
    throw new Error(
      "Abort: advisory-committee has term_kind='executive'. Human review is required before archiving."
    );
  }

  return {
    assignments: assignmentsResult.rows,
    roles: rolesResult.rows,
    terms: termsResult.rows,
    advisors: advisorResult.rows,
  };
}

async function canonicalizeLegacyFifthTerm(terms: Row[]) {
  if (!hasColumn("committee_terms", "slug")) {
    return;
  }

  const legacy = termBySlug(terms, "5th-committee");
  const canonical = termBySlug(terms, "5th-executive-committee");

  if (!legacy) {
    return;
  }

  if (canonical) {
    logWarn(
      "Both 5th-committee and 5th-executive-committee exist; archiving the legacy 5th-committee row to avoid duplicate public EC terms."
    );
    await updateByIdAdaptive(
      "committee_terms",
      rowId(legacy),
      {
        is_current: false,
        is_public: false,
        status: "archived",
      },
      "archive duplicate 5th-committee"
    );
    return;
  }

  logWarn("Renaming legacy 5th-committee slug to 5th-executive-committee.");
  await updateByIdAdaptive(
    "committee_terms",
    rowId(legacy),
    {
      slug: "5th-executive-committee",
      is_current: false,
      status: "archived",
    },
    "canonicalize 5th committee slug"
  );
}

async function canonicalizeLegacyFoundingTerm(terms: Row[]) {
  if (!hasColumn("committee_terms", "slug")) {
    return;
  }

  const legacy = termBySlug(terms, "founding-executive-committee");
  const canonical = termBySlug(terms, "1st-executive-committee");

  if (!legacy) {
    return;
  }

  if (canonical) {
    logWarn(
      "Both founding-executive-committee and 1st-executive-committee exist; hiding the legacy founding row from public EC counts."
    );
    await updateByIdAdaptive(
      "committee_terms",
      rowId(legacy),
      {
        is_current: false,
        is_public: false,
        status: "archived",
      },
      "archive duplicate founding-executive-committee"
    );
    return;
  }

  logWarn(
    "Renaming legacy founding-executive-committee slug to 1st-executive-committee."
  );
  await updateByIdAdaptive(
    "committee_terms",
    rowId(legacy),
    {
      slug: "1st-executive-committee",
      title: "1st Executive Committee",
      is_current: false,
      status: "archived",
    },
    "canonicalize founding committee slug"
  );
}

async function upsertTermWithStatusFallback(
  term: Parameters<typeof buildTermPayload>[0]
) {
  let payload = buildTermPayload(term);

  try {
    await upsertAdaptive(
      "committee_terms",
      payload,
      "slug",
      `upsert ${term.slug}`
    );
  } catch (error) {
    const queryError = error instanceof Error ? { message: error.message } : {};
    if (term.status === "completed" && isStatusConstraintError(queryError)) {
      logWarn(
        `${term.slug}: status='completed' is not accepted by this schema; retrying with status='archived'.`
      );
      payload = {
        ...payload,
        status: "archived",
      };
      await upsertAdaptive(
        "committee_terms",
        payload,
        "slug",
        `upsert ${term.slug} with archived fallback`
      );
      return;
    }

    throw error;
  }
}

async function seedExecutiveTerms(existingTerms: Row[]) {
  logStep("Step 1 - Seed/upsert six Executive Committee terms");

  await canonicalizeLegacyFifthTerm(existingTerms);
  await canonicalizeLegacyFoundingTerm(existingTerms);

  const existingCanonicalFifth = termBySlug(existingTerms, "5th-executive-committee");
  const fifthStartsOn =
    asString(existingCanonicalFifth?.starts_on) || "2023-01-01";
  const fifthEndsOn =
    existingCanonicalFifth && "ends_on" in existingCanonicalFifth
      ? (existingCanonicalFifth.ends_on as string | null)
      : "2025-07-07";

  const terms = [
    {
      slug: "1st-executive-committee",
      title: "1st Executive Committee",
      termNumber: 1,
      startsOn: "2015-11-11",
      endsOn: "2016-12-31",
      status: "completed",
      isCurrent: false,
      isPublic: true,
      dateConfidence: "estimated",
      tenureNote: "Founding term. Exact dates unverified.",
      targetExecutiveSlots: 21,
    },
    {
      slug: "2nd-executive-committee",
      title: "2nd Executive Committee",
      termNumber: 2,
      startsOn: "2017-01-01",
      endsOn: "2019-09-16",
      status: "completed",
      isCurrent: false,
      isPublic: true,
      dateConfidence: "estimated",
      tenureNote: "Estimated based on available records.",
      targetExecutiveSlots: 21,
    },
    {
      slug: "3rd-executive-committee",
      title: "3rd Executive Committee",
      termNumber: 3,
      startsOn: "2019-09-16",
      endsOn: "2022-02-24",
      status: "completed",
      isCurrent: false,
      isPublic: true,
      dateConfidence: "estimated",
      tenureNote: "Estimated based on available records.",
      targetExecutiveSlots: 21,
    },
    {
      slug: "4th-executive-committee",
      title: "4th Executive Committee",
      termNumber: 4,
      startsOn: "2022-02-24",
      endsOn: "2023-07-16",
      status: "completed",
      isCurrent: false,
      isPublic: true,
      dateConfidence: "estimated",
      tenureNote: "Estimated based on available records.",
      targetExecutiveSlots: 21,
    },
    {
      slug: "5th-executive-committee",
      title: "5th Executive Committee",
      termNumber: 5,
      startsOn: fifthStartsOn,
      endsOn: fifthEndsOn,
      status: "completed",
      isCurrent: false,
      isPublic: true,
      dateConfidence: "estimated",
      tenureNote: "Estimated based on available records.",
      targetExecutiveSlots: 21,
    },
    {
      slug: "6th-executive-committee",
      title: "6th Executive Committee",
      termNumber: 6,
      startsOn: "2025-07-07",
      endsOn: null,
      electionDate: "2025-07-07",
      status: "active",
      isCurrent: false,
      isPublic: true,
      dateConfidence: "verified",
      tenureNote: "Current executive committee of JnU IT Society.",
      targetExecutiveSlots: 21,
    },
  ];

  for (const term of terms) {
    await upsertTermWithStatusFallback(term);
  }

  if (!applyMode) {
    console.log(
      "[dry-run] would set all non-6th executive terms is_current=false, then set 6th-executive-committee is_current=true."
    );
    return;
  }

  let clearCurrent = admin
    .from("committee_terms")
    .update({ is_current: false })
    .neq("slug", "6th-executive-committee");

  if (hasColumn("committee_terms", "term_kind")) {
    clearCurrent = clearCurrent.eq("term_kind", "executive");
  }

  const clearResult = await clearCurrent;
  assertNoQueryError("clear non-6th executive current flags", clearResult);

  const setCurrentResult = await admin
    .from("committee_terms")
    .update({ is_current: true, status: "active", is_public: true })
    .eq("slug", "6th-executive-committee");
  assertNoQueryError("set 6th executive current", setCurrentResult);
}

async function archiveAdvisoryTerm(terms: Row[]) {
  logStep("Step 2 - Archive Advisory Committee term");

  const advisoryTerms = terms.filter((term) =>
    ["advisory-committee", "advisory-committee-legacy"].includes(
      asString(term.slug)
    )
  );

  if (advisoryTerms.length === 0) {
    logWarn(
      "No advisory committee legacy term found; recreating a hidden legacy advisor-board term for audit continuity."
    );
    const payload: WritePayload = {
      slug: "advisory-committee-legacy",
      title: "Advisory Committee (Legacy)",
      starts_on: "2026-01-01",
      ends_on: null,
      status: "archived",
      is_public: false,
    };
    addIfColumn("committee_terms", payload, "term_kind", "advisor_board");
    addIfColumn("committee_terms", payload, "term_number", null);
    addIfColumn("committee_terms", payload, "election_date", null);
    addIfColumn("committee_terms", payload, "is_current", false);
    addIfColumn("committee_terms", payload, "date_confidence", "estimated");
    addIfColumn("committee_terms", payload, "target_executive_slots", 21);
    addIfColumn(
      "committee_terms",
      payload,
      "tenure_note",
      "Legacy advisory roster imported from previous JnUITS platform. Archived during 6th EC migration. Not an executive committee term."
    );
    await upsertAdaptive(
      "committee_terms",
      payload,
      "slug",
      "create hidden advisory-committee-legacy term"
    );
    return;
  }

  const legacySlugExists = advisoryTerms.some(
    (term) => asString(term.slug) === "advisory-committee-legacy"
  );

  for (const term of advisoryTerms) {
    const currentSlug = asString(term.slug);
    const patch: WritePayload = {
      status: "archived",
      is_current: false,
      is_public: false,
    };

    if (currentSlug === "advisory-committee" && !legacySlugExists) {
      patch.slug = "advisory-committee-legacy";
    } else if (currentSlug === "advisory-committee" && legacySlugExists) {
      logWarn(
        "advisory-committee-legacy already exists; preserving advisory-committee slug but archiving/hiding it."
      );
    }

    addIfColumn("committee_terms", patch, "term_kind", "advisor_board");
    addIfColumn(
      "committee_terms",
      patch,
      "tenure_note",
      "Legacy advisory roster imported from previous JnUITS platform. Archived during 6th EC migration. Not an executive committee term."
    );

    await updateByIdAdaptive(
      "committee_terms",
      rowId(term),
      patch,
      `archive ${currentSlug}`
    );
  }
}

function roleByCode(roles: Row[], code: string) {
  return roles.find((role) => asString(role.code) === code);
}

async function insertAssignmentWithStatusFallback(
  payload: WritePayload,
  label: string
) {
  try {
    await insertAdaptive("committee_assignments", payload, label);
  } catch (error) {
    const queryError = error instanceof Error ? { message: error.message } : {};
    if (isStatusConstraintError(queryError)) {
      logWarn(
        `${label}: status='completed' is not accepted; retrying with status='active'.`
      );
      await insertAdaptive(
        "committee_assignments",
        {
          ...payload,
          status: "active",
        },
        `${label} with active fallback`
      );
      return;
    }

    throw error;
  }
}

async function ensureLegacyAdvisoryAssignments(terms: Row[], roles: Row[]) {
  logStep("Step 4a - Ensure hidden legacy advisory assignments");

  const advisoryTerm = terms.find((term) =>
    ["advisory-committee", "advisory-committee-legacy"].includes(
      asString(term.slug)
    )
  );

  if (!advisoryTerm) {
    logWarn("No advisory legacy term available for assignment recovery.");
    return;
  }

  const legacyAssignments = [
    {
      displayName: "Professor Md. Rezaul Karim, Ph.D.",
      roleCode: "chief-advisor",
      sortOrder: 10,
    },
    {
      displayName: "Dr. Uzzal Kumar Acharjee",
      roleCode: "mentor-moderator",
      sortOrder: 20,
    },
    {
      displayName: "Prof. Dr. Md. Abu Layek",
      roleCode: "respected-advisor",
      sortOrder: 30,
    },
    {
      displayName: "Dr. Sajeeb Saha",
      roleCode: "respected-advisor",
      sortOrder: 40,
    },
  ];

  const assignments = await refreshAssignments();

  for (const item of legacyAssignments) {
    const role = roleByCode(roles, item.roleCode);
    if (!role) {
      logWarn(`Cannot recover ${item.displayName}: role ${item.roleCode} missing.`);
      continue;
    }

    const existing = assignments.find(
      (assignment) =>
        asString(assignment.term_id) === rowId(advisoryTerm) &&
        asString(assignment.role_id) === rowId(role) &&
        normalizeName(assignment.display_name) === normalizeName(item.displayName)
    );

    const metadata = {
      migration_note:
        "Migrated to advisor_profiles during 6th EC corrective migration",
      recovered_from_deleted_legacy_import: true,
    };
    const payload: WritePayload = {
      term_id: rowId(advisoryTerm),
      role_id: rowId(role),
      member_id: null,
      display_name: item.displayName,
      sort_order: item.sortOrder,
      status: "completed",
      starts_on: null,
      ends_on: null,
    };
    addIfColumn("committee_assignments", payload, "is_public", false);
    addIfColumn("committee_assignments", payload, "source", "legacy_import");
    addIfColumn("committee_assignments", payload, "visibility", "internal");
    addIfColumn("committee_assignments", payload, "metadata", metadata);

    if (existing) {
      await updateByIdAdaptive(
        "committee_assignments",
        rowId(existing),
        payload,
        `update recovered advisory assignment ${item.displayName}`
      );
      continue;
    }

    await insertAssignmentWithStatusFallback(
      payload,
      `insert recovered advisory assignment ${item.displayName}`
    );
  }
}

async function findAdvisorByIdOrName(advisorId: string, fullName: string) {
  const selectColumns = ["id", "advisor_jnuits_id", "full_name"].filter((column) =>
    hasColumn("advisor_profiles", column)
  );
  const selectClause = selectColumns.length > 0 ? selectColumns.join(",") : "id";

  if (hasColumn("advisor_profiles", "advisor_jnuits_id")) {
    const byId = await admin
      .from("advisor_profiles")
      .select(selectClause)
      .eq("advisor_jnuits_id", advisorId)
      .maybeSingle();

    assertNoQueryError(`find advisor ${advisorId}`, byId);
    if (byId.data) {
      return (byId.data as unknown) as Row;
    }
  }

  const byName = await admin
    .from("advisor_profiles")
    .select(selectClause)
    .eq("full_name", fullName)
    .maybeSingle();

  assertNoQueryError(`find advisor by name ${fullName}`, byName);
  return ((byName.data as unknown) as Row | null) ?? null;
}

async function upsertAdvisorProfile(profile: {
  advisorJnuitsId: string;
  advisorType: string;
  fullName: string;
  isCurrent: boolean;
  status: string;
  formerTitle: string | null;
  department: string | null;
  isPublic: boolean;
  note: string;
}) {
  const payload = buildAdvisorPayload(profile);

  if (!applyMode) {
    console.log(`[dry-run] upsert advisor ${profile.advisorJnuitsId}`, payload);
    return;
  }

  const existing = await findAdvisorByIdOrName(
    profile.advisorJnuitsId,
    profile.fullName
  );

  if (existing) {
    await updateByIdAdaptive(
      "advisor_profiles",
      rowId(existing),
      payload,
      `update advisor ${profile.advisorJnuitsId}`
    );
    return;
  }

  if (hasColumn("advisor_profiles", "advisor_jnuits_id")) {
    await upsertAdaptive(
      "advisor_profiles",
      payload,
      "advisor_jnuits_id",
      `upsert advisor ${profile.advisorJnuitsId}`
    );
    return;
  }

  logWarn(
    `advisor_profiles.advisor_jnuits_id is unavailable; inserting ${profile.fullName} by name only.`
  );
  await insertAdaptive(
    "advisor_profiles",
    payload,
    `insert advisor ${profile.fullName}`
  );
}

async function seedAdvisorProfiles() {
  logStep("Step 3 - Seed advisor_profiles");

  if (hasColumn("advisor_profiles", "advisor_jnuits_id")) {
    console.log("advisor identity column used: advisor_jnuits_id");
  } else {
    logWarn("advisor_jnuits_id column unavailable; using full_name/id fallback.");
  }

  const profiles = [
    {
      advisorJnuitsId: "JNUITS-CA0005",
      fullName: "Professor Md. Rezaul Karim, Ph.D.",
      advisorType: "main_advisor",
      isCurrent: false,
      status: "former",
      formerTitle: "Chief Advisor",
      department: null,
      isPublic: true,
      note: "Former Chief Advisor. Migrated from legacy advisory roster.",
    },
    {
      advisorJnuitsId: "JNUITS-MOD0001",
      fullName: "Dr. Uzzal Kumar Acharjee",
      advisorType: "moderator_mentor",
      isCurrent: false,
      status: "former",
      formerTitle: "Moderator/Mentor",
      department: null,
      isPublic: true,
      note: "Former Moderator/Mentor. Migrated from legacy advisory roster.",
    },
    {
      advisorJnuitsId: "JNUITS-MOD0002",
      fullName: "Prof. Dr. Md. Abu Layek",
      advisorType: "moderator_mentor",
      isCurrent: true,
      status: "active",
      formerTitle: null,
      department: null,
      isPublic: true,
      note: "Current Moderator/Mentor.",
    },
    {
      advisorJnuitsId: "JNUITS-RA0001",
      fullName: "Dr. Sajeeb Saha",
      advisorType: "honorable_advisor",
      isCurrent: true,
      status: "active",
      formerTitle: null,
      department: null,
      isPublic: true,
      note: "Honorable Advisor. Migrated from legacy advisory roster.",
    },
  ];

  for (const profile of profiles) {
    await upsertAdvisorProfile(profile);
  }
}

async function refreshTerms() {
  const result = await selectAdaptive(
    "committee_terms",
    [
      "id",
      "slug",
      "title",
      "is_current",
      "status",
      "term_kind",
      "is_public",
      "starts_on",
      "ends_on",
    ],
    "committee_terms refresh"
  );
  return result.rows;
}

async function refreshAssignments() {
  const result = await selectAdaptive(
    "committee_assignments",
    [
      "id",
      "member_id",
      "display_name",
      "role_id",
      "term_id",
      "status",
      "is_public",
      "visibility",
      "metadata",
    ],
    "committee_assignments refresh"
  );
  return result.rows;
}

async function hideLegacyAdvisoryAssignments(terms: Row[]) {
  logStep("Step 4 - Hide legacy advisory committee assignments");

  const advisoryTerm = terms.find((term) =>
    ["advisory-committee", "advisory-committee-legacy"].includes(
      asString(term.slug)
    )
  );

  if (!advisoryTerm) {
    logWarn("No advisory term found for assignment hiding.");
    return;
  }

  const assignments = await refreshAssignments();
  const legacyAssignments = assignments.filter(
    (assignment) => asString(assignment.term_id) === rowId(advisoryTerm)
  );

  if (legacyAssignments.length === 0) {
    logWarn("No legacy advisory assignments found.");
    return;
  }

  for (const assignment of legacyAssignments) {
    const metadata =
      assignment.metadata && typeof assignment.metadata === "object"
        ? { ...(assignment.metadata as Row) }
        : {};
    metadata.migration_note =
      "Migrated to advisor_profiles during 6th EC corrective migration";

    const patch: WritePayload = {
      is_public: false,
      status: "completed",
    };

    addIfColumn("committee_assignments", patch, "visibility", "internal");
    addIfColumn("committee_assignments", patch, "metadata", metadata);

    try {
      await updateByIdAdaptive(
        "committee_assignments",
        rowId(assignment),
        patch,
        `hide advisory assignment ${assignment.id}`
      );
    } catch (error) {
      const queryError = error instanceof Error ? { message: error.message } : {};
      if (isStatusConstraintError(queryError)) {
        logWarn(
          `committee_assignments.status='completed' is not accepted; retrying assignment ${assignment.id} with status='active'.`
        );
        await updateByIdAdaptive(
          "committee_assignments",
          rowId(assignment),
          {
            ...patch,
            status: "active",
          },
          `hide advisory assignment ${assignment.id} with active fallback`
        );
        continue;
      }

      throw error;
    }
  }
}

async function loadAdvisorRowsForChecks() {
  const result = await selectAdaptive(
    "advisor_profiles",
    [
      "id",
      "advisor_jnuits_id",
      "full_name",
      "advisor_type",
      "is_current",
      "is_public",
    ],
    "advisor_profiles check refresh"
  );
  return result.rows;
}

function check(
  checkName: string,
  passed: boolean,
  details: string,
  skipped = false
): CheckResult {
  if (skipped) {
    return {
      check: checkName,
      details,
      status: "SKIP",
    };
  }

  return {
    check: checkName,
    details,
    status: passed ? "PASS" : "FAIL",
  };
}

function isExecutiveTerm(term: Row) {
  if (hasColumn("committee_terms", "term_kind")) {
    return asString(term.term_kind) === "executive";
  }

  return !asString(term.slug).includes("advisory");
}

function publicExecutiveTerms(terms: Row[]) {
  return terms.filter(
    (term) => isExecutiveTerm(term) && asBoolean(term.is_public)
  );
}

function findAdvisor(advisors: Row[], advisorId: string, fullName: string) {
  if (hasColumn("advisor_profiles", "advisor_jnuits_id")) {
    const byId = advisors.find(
      (advisor) => asString(advisor.advisor_jnuits_id) === advisorId
    );
    if (byId) {
      return byId;
    }
  }

  return advisors.find(
    (advisor) => normalizeName(advisor.full_name) === normalizeName(fullName)
  );
}

async function runInvariantChecks() {
  logStep("Step 5 - Post-migration invariant checks");

  const terms = await refreshTerms();
  const assignments = await refreshAssignments();
  const advisors = await loadAdvisorRowsForChecks();

  const currentExecutiveTerms = terms.filter(
    (term) => isExecutiveTerm(term) && asBoolean(term.is_current)
  );
  const advisoryTerms = terms.filter((term) =>
    asString(term.slug).includes("advisory")
  );
  const advisoryIds = new Set(advisoryTerms.map((term) => rowId(term)));
  const advisoryAssignments = assignments.filter((assignment) =>
    advisoryIds.has(asString(assignment.term_id))
  );
  const publicAdvisoryAssignments = advisoryAssignments.filter((assignment) =>
    asBoolean(assignment.is_public)
  );

  const ca0005 = findAdvisor(
    advisors,
    "JNUITS-CA0005",
    "Professor Md. Rezaul Karim, Ph.D."
  );
  const mod0001 = findAdvisor(
    advisors,
    "JNUITS-MOD0001",
    "Dr. Uzzal Kumar Acharjee"
  );
  const mod0002 = findAdvisor(
    advisors,
    "JNUITS-MOD0002",
    "Prof. Dr. Md. Abu Layek"
  );
  const ra0001 = findAdvisor(advisors, "JNUITS-RA0001", "Dr. Sajeeb Saha");

  const checks = [
    check(
      "Exactly one committee_term has is_current=true AND term_kind='executive'",
      currentExecutiveTerms.length === 1,
      `found ${currentExecutiveTerms.length}`
    ),
    check(
      "Current executive term slug is 6th-executive-committee",
      asString(currentExecutiveTerms[0]?.slug) === "6th-executive-committee",
      asString(currentExecutiveTerms[0]?.slug) || "none"
    ),
    check(
      "No advisory term has is_current=true",
      advisoryTerms.every((term) => !asBoolean(term.is_current)),
      `${advisoryTerms.filter((term) => asBoolean(term.is_current)).length} current advisory terms`
    ),
    check(
      "No advisory term has is_public=true",
      advisoryTerms.every((term) => !asBoolean(term.is_public)),
      `${advisoryTerms.filter((term) => asBoolean(term.is_public)).length} public advisory terms`
    ),
    check(
      "COUNT of executive term_kind rows with is_public=true = 6",
      publicExecutiveTerms(terms).length === 6,
      `found ${publicExecutiveTerms(terms).length}`
    ),
    check(
      "advisor_profiles has at least 4 rows",
      advisors.length >= 4,
      `found ${advisors.length}`
    ),
    check(
      "JNUITS-CA0005 exists in advisor_profiles with is_current=false",
      Boolean(ca0005) && !asBoolean(ca0005?.is_current),
      ca0005 ? `is_current=${String(ca0005.is_current)}` : "missing",
      !hasColumn("advisor_profiles", "advisor_jnuits_id")
    ),
    check(
      "JNUITS-MOD0001 exists in advisor_profiles with is_current=false",
      Boolean(mod0001) && !asBoolean(mod0001?.is_current),
      mod0001 ? `is_current=${String(mod0001.is_current)}` : "missing",
      !hasColumn("advisor_profiles", "advisor_jnuits_id")
    ),
    check(
      "JNUITS-MOD0002 exists in advisor_profiles with is_current=true",
      Boolean(mod0002) && asBoolean(mod0002?.is_current),
      mod0002 ? `is_current=${String(mod0002.is_current)}` : "missing",
      !hasColumn("advisor_profiles", "advisor_jnuits_id")
    ),
    check(
      "JNUITS-RA0001 exists in advisor_profiles",
      Boolean(ra0001),
      ra0001 ? "exists" : "missing",
      !hasColumn("advisor_profiles", "advisor_jnuits_id")
    ),
    check(
      "All legacy advisory assignments have is_public=false",
      advisoryAssignments.length >= 4 && publicAdvisoryAssignments.length === 0,
      `legacy=${advisoryAssignments.length}, public=${publicAdvisoryAssignments.length}`,
      !hasColumn("committee_assignments", "is_public")
    ),
  ];

  console.table(checks);

  const failed = checks.filter((item) => item.status === "FAIL");
  if (failed.length > 0) {
    logError(`${failed.length} invariant check(s) failed.`);
    if (applyMode) {
      process.exitCode = 1;
    } else {
      logWarn("Dry-run mode: current-state check failures do not fail the run.");
    }
  }
}

async function main() {
  console.log(
    `Committee Phase A corrective migration (${applyMode ? "apply" : "dry-run"} mode)`
  );

  try {
    const state = await preflightRead();
    await seedExecutiveTerms(state.terms);
    await archiveAdvisoryTerm(state.terms);
    await seedAdvisorProfiles();
    await ensureLegacyAdvisoryAssignments(await refreshTerms(), state.roles);
    await hideLegacyAdvisoryAssignments(await refreshTerms());
    await runInvariantChecks();
    printSkippedColumns();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logError(message);
    process.exitCode = 1;
  }
}

void main();
