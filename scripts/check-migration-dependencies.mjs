/**
 * Static migration ordering and forward-reference checker (issue #18).
 *
 * Catches, without a database, the two failure classes that a clean replay
 * discovers the expensive way:
 *
 *   1. Ordering problems - malformed filenames, duplicate 14-digit versions,
 *      filesystem order that disagrees with version order.
 *   2. Forward references - a migration that executes public.some_function()
 *      before any earlier migration creates it. This is exactly the
 *      rls_auto_enable() defect behind #18.
 *
 * ## Distinguishing a call from a DDL object reference
 *
 * `public.name(` is ambiguous in SQL. All of these match that shape and none
 * of them is a function call:
 *
 *   create table public.audit_events (          -- table definition
 *   create index foo on public.members (id)     -- index target
 *   references public.members (id)              -- foreign key
 *   insert into public.events (a, b)            -- insert target
 *   revoke all on function public.foo(uuid)     -- privilege statement
 *   drop function if exists public.foo(uuid)    -- drop statement
 *
 * A match is therefore rejected when the word immediately before it marks the
 * reference as a DDL object rather than an invocation. `select public.foo()`,
 * `perform public.foo()`, and `default public.foo()` survive, because their
 * preceding token is not in that set.
 *
 * ## What is deliberately not detected
 *
 * - Unqualified calls that rely on `search_path`. Only `public.`-qualified
 *   references are considered.
 * - References inside a CREATE FUNCTION body. Those resolve when the function
 *   is called, not when the migration runs.
 *
 * Functions that legitimately predate the migration chain live in
 * BOOTSTRAP_FUNCTIONS. That list is the machine-readable statement of the gap
 * between a full historical replay and the supported baseline replay.
 *
 * Repo-wide mode is REPORT-ONLY by default. Pass --strict to make findings
 * fail. Promote CI to --strict once a run reports zero findings; see
 * docs/operations/migration-bootstrap-and-integrity.md section 4.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Functions an applied migration depends on that no migration creates.
 * Every entry is a known historical gap, not an approval to add more.
 */
export const BOOTSTRAP_FUNCTIONS = new Set([
  // Reconstructed for replay by
  // supabase/verification/baseline/20260608092959_restore_rls_auto_enable.sql
  "rls_auto_enable",
]);

/**
 * When one of these is the word immediately preceding `public.name(`, the
 * match is a DDL object reference, not a function invocation.
 *
 * `from` and `join` are intentionally absent: `select * from public.f(x)` is a
 * genuine table-function call, and `from public.tbl (` is not valid syntax.
 */
export const DDL_OBJECT_KEYWORDS = new Set([
  "aggregate",
  "alter",
  "column",
  "constraint",
  "database",
  "delete",
  "domain",
  "drop",
  "exists",
  "extension",
  "function",
  "index",
  "inherits",
  "insert",
  "into",
  "materialized",
  "on",
  "only",
  "operator",
  "owner",
  "partition",
  "policy",
  "procedure",
  "publication",
  "references",
  "rule",
  "schema",
  "sequence",
  "table",
  "temp",
  "temporary",
  "trigger",
  "truncate",
  "type",
  "unlogged",
  "update",
  "view",
]);

const MIGRATION_FILENAME_PATTERN = /^(\d{14})_([a-z0-9_]+)\.sql$/;

function blankRun(text) {
  return text.replace(/[^\n]/g, " ");
}

/**
 * Blanks comments and single-quoted literals in place. Length is preserved so
 * that match offsets still line up with the original source.
 */
export function blankNonCode(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, blankRun)
    .replace(/--[^\n]*/g, blankRun)
    .replace(/'(?:[^']|'')*'/g, blankRun);
}

/**
 * Blanks CREATE FUNCTION / CREATE PROCEDURE bodies so deferred references are
 * not mistaken for immediate ones. The header is left intact so the definition
 * is still discoverable. Length is preserved.
 */
export function stripFunctionBodies(sql) {
  const chars = [...sql];
  const header = /create\s+(?:or\s+replace\s+)?(?:function|procedure)\b/gi;
  let match;

  while ((match = header.exec(sql)) !== null) {
    const rest = sql.slice(match.index);
    const openTag = /\$([a-z0-9_]*)\$/i.exec(rest);
    if (!openTag) {
      continue;
    }

    const bodyStart = match.index + openTag.index;
    const tag = openTag[0];
    const bodyEnd = sql.indexOf(tag, bodyStart + tag.length);
    if (bodyEnd === -1) {
      continue;
    }

    for (let i = bodyStart; i < bodyEnd + tag.length; i += 1) {
      if (chars[i] !== "\n") {
        chars[i] = " ";
      }
    }

    header.lastIndex = bodyEnd + tag.length;
  }

  return chars.join("");
}

/** The bare word immediately before `index`, lowercased. Empty when none. */
export function precedingWord(text, index) {
  let cursor = index - 1;
  while (cursor >= 0 && /\s/.test(text[cursor])) {
    cursor -= 1;
  }

  const end = cursor + 1;
  while (cursor >= 0 && /[A-Za-z0-9_]/.test(text[cursor])) {
    cursor -= 1;
  }

  return text.slice(cursor + 1, end).toLowerCase();
}

/** @returns {Map<string, number>} function name to its first definition offset. */
export function extractDefinedFunctions(sql) {
  const cleaned = blankNonCode(sql);
  const pattern =
    /create\s+(?:or\s+replace\s+)?(?:function|procedure)\s+(?:public\s*\.\s*)?"?([a-z0-9_]+)"?\s*\(/gi;
  const defined = new Map();

  for (const match of cleaned.matchAll(pattern)) {
    const name = match[1].toLowerCase();
    if (!defined.has(name)) {
      defined.set(name, match.index);
    }
  }

  return defined;
}

/** @returns {{ index: number, name: string }[]} immediate invocations, in order. */
export function extractImmediateReferences(sql) {
  const executable = stripFunctionBodies(blankNonCode(sql));
  const pattern = /\bpublic\s*\.\s*"?([a-z0-9_]+)"?\s*\(/gi;
  const references = [];

  for (const match of executable.matchAll(pattern)) {
    if (DDL_OBJECT_KEYWORDS.has(precedingWord(executable, match.index))) {
      continue;
    }

    references.push({ index: match.index, name: match[1].toLowerCase() });
  }

  return references;
}

export function listMigrationFilenames(migrationsDir) {
  return readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();
}

/**
 * @param {{ filename: string, sql: string }[]} migrations Ordered oldest first.
 */
export function analyzeMigrations(migrations) {
  const findings = [];
  const seenVersions = new Map();
  const seenLogicalNames = new Map();
  const definedByEarlierMigrations = new Set(BOOTSTRAP_FUNCTIONS);
  let previousVersion = "";

  for (const migration of migrations) {
    const parsed = MIGRATION_FILENAME_PATTERN.exec(migration.filename);

    if (!parsed) {
      findings.push({
        filename: migration.filename,
        kind: "filename",
        message:
          "Filename does not match <14-digit version>_<snake_case name>.sql",
      });
      continue;
    }

    const [, version, logicalName] = parsed;

    if (seenVersions.has(version)) {
      findings.push({
        filename: migration.filename,
        kind: "duplicate-version",
        message: `Version ${version} is already used by ${seenVersions.get(version)}`,
      });
    } else {
      seenVersions.set(version, migration.filename);
    }

    if (seenLogicalNames.has(logicalName)) {
      findings.push({
        filename: migration.filename,
        kind: "duplicate-name",
        message: `Logical name ${logicalName} is already used by ${seenLogicalNames.get(logicalName)}`,
      });
    } else {
      seenLogicalNames.set(logicalName, migration.filename);
    }

    if (previousVersion && version < previousVersion) {
      findings.push({
        filename: migration.filename,
        kind: "order",
        message: `Version ${version} sorts before the preceding migration ${previousVersion}`,
      });
    }
    previousVersion = version;

    const definedHere = extractDefinedFunctions(migration.sql);
    const referenced = extractImmediateReferences(migration.sql);
    const reported = new Set();

    for (const reference of referenced) {
      if (definedByEarlierMigrations.has(reference.name)) {
        continue;
      }

      // A definition later in the same file does not satisfy an earlier call.
      const definitionOffset = definedHere.get(reference.name);
      if (definitionOffset !== undefined && definitionOffset < reference.index) {
        continue;
      }

      if (reported.has(reference.name)) {
        continue;
      }
      reported.add(reference.name);

      findings.push({
        filename: migration.filename,
        kind: "forward-reference",
        message:
          definitionOffset === undefined
            ? `Executes public.${reference.name}() before any earlier migration creates it`
            : `Executes public.${reference.name}() before its definition later in this same file`,
      });
    }

    for (const name of definedHere.keys()) {
      definedByEarlierMigrations.add(name);
    }
  }

  return findings;
}

export function formatFindings(findings) {
  if (findings.length === 0) {
    return "Migration ordering and dependency check: no findings.";
  }

  const lines = [`Migration ordering and dependency findings (${findings.length}):`];
  for (const finding of findings) {
    lines.push(`- [${finding.kind}] ${finding.filename}: ${finding.message}`);
  }
  return lines.join("\n");
}

function main() {
  const strict = process.argv.includes("--strict");
  const migrationsDir = join(process.cwd(), "supabase", "migrations");
  const migrations = listMigrationFilenames(migrationsDir).map((filename) => ({
    filename,
    sql: readFileSync(join(migrationsDir, filename), "utf8"),
  }));

  if (migrations.length === 0) {
    console.error(`No migrations found in ${migrationsDir}`);
    process.exit(1);
  }

  const findings = analyzeMigrations(migrations);
  console.log(`Inspected ${migrations.length} migrations.`);
  console.log(formatFindings(findings));

  if (findings.length > 0 && !strict) {
    console.log(
      "\nReport-only mode. Investigate each finding: extend BOOTSTRAP_FUNCTIONS only where a gap is genuinely historical, and fix the rest. Once this reports zero, switch CI to --strict."
    );
  }

  process.exit(findings.length > 0 && strict ? 2 : 0);
}

if (process.argv[1] && process.argv[1].endsWith("check-migration-dependencies.mjs")) {
  main();
}
