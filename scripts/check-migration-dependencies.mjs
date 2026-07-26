#!/usr/bin/env node
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
 * References inside a CREATE FUNCTION body are ignored, because those resolve
 * when the function is called, not when the migration runs. References in DO
 * blocks and bare statements are checked, because those execute immediately.
 *
 * Functions that legitimately predate the migration chain live in
 * BOOTSTRAP_FUNCTIONS. That list is the machine-readable statement of the gap
 * between a full historical replay and the supported baseline replay.
 *
 * Repo-wide mode is REPORT-ONLY by default. Pass --strict to make findings
 * fail. Strict mode is not wired into CI yet: the true bootstrap allowlist has
 * never been confirmed against a real replay, and guessing it would produce
 * false failures. Confirm locally, extend the list, then enable --strict.
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

const MIGRATION_FILENAME_PATTERN = /^(\d{14})_([a-z0-9_]+)\.sql$/;

function stripComments(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--[^\n]*/g, " ");
}

/**
 * Removes CREATE FUNCTION bodies so deferred references are not mistaken for
 * immediate ones. Handles arbitrary dollar-quote tags.
 */
export function stripFunctionBodies(sql) {
  const createFunction = /create\s+(?:or\s+replace\s+)?function\b/gi;
  let result = "";
  let cursor = 0;
  let match;

  while ((match = createFunction.exec(sql)) !== null) {
    const openTag = /\$([a-z0-9_]*)\$/i.exec(sql.slice(match.index));
    if (!openTag) {
      continue;
    }

    const bodyStart = match.index + openTag.index;
    const tag = openTag[0];
    const bodyEnd = sql.indexOf(tag, bodyStart + tag.length);
    if (bodyEnd === -1) {
      continue;
    }

    result += sql.slice(cursor, bodyStart);
    cursor = bodyEnd + tag.length;
    createFunction.lastIndex = cursor;
  }

  return result + sql.slice(cursor);
}

export function extractDefinedFunctions(sql) {
  const pattern =
    /create\s+(?:or\s+replace\s+)?function\s+(?:public\s*\.\s*)?"?([a-z0-9_]+)"?\s*\(/gi;
  const defined = new Set();
  for (const match of stripComments(sql).matchAll(pattern)) {
    defined.add(match[1].toLowerCase());
  }
  return defined;
}

export function extractImmediateReferences(sql) {
  const withoutComments = stripComments(sql);
  const executable = stripFunctionBodies(withoutComments);
  const pattern = /\bpublic\s*\.\s*"?([a-z0-9_]+)"?\s*\(/gi;
  const referenced = new Set();
  for (const match of executable.matchAll(pattern)) {
    referenced.add(match[1].toLowerCase());
  }
  return referenced;
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
  const definedSoFar = new Set(BOOTSTRAP_FUNCTIONS);
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

    const referenced = extractImmediateReferences(migration.sql);
    const defined = extractDefinedFunctions(migration.sql);

    for (const name of [...referenced].sort()) {
      if (!definedSoFar.has(name) && !defined.has(name)) {
        findings.push({
          filename: migration.filename,
          kind: "forward-reference",
          message: `Executes public.${name}() before any earlier migration creates it`,
        });
      }
    }

    for (const name of defined) {
      definedSoFar.add(name);
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
      "\nReport-only mode. Confirm these findings locally, extend BOOTSTRAP_FUNCTIONS where a gap is genuinely historical, then run with --strict."
    );
  }

  process.exit(findings.length > 0 && strict ? 2 : 0);
}

if (process.argv[1] && process.argv[1].endsWith("check-migration-dependencies.mjs")) {
  main();
}
