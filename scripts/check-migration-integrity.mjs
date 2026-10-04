import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SEALED_ANCHOR = "68d8c3730d599b37b4bacb177bd48c0d28008958";
const MANIFEST = "supabase/migration-integrity.json";
const RECEIPTS = "supabase/migration-reconciliation-receipts.json";
const MIGRATION_PATH = /^supabase\/migrations\/\d{14}_[a-zA-Z0-9_]+\.sql$/;
function git(cwd, args, binary = false) {
  return execFileSync("git", args, { cwd, encoding: binary ? undefined : "utf8", stdio: ["ignore", "pipe", "pipe"] });
}
function pathsAt(cwd, ref) {
  return git(cwd, ["ls-tree", "-r", "--name-only", ref, "--", "supabase/migrations"])
    .trim().split("\n").filter(path => MIGRATION_PATH.test(path)).sort();
}
function blobAt(cwd, ref, path) { return git(cwd, ["rev-parse", ref + ":" + path]).trim(); }
function digest(cwd, ref, path) {
  return createHash("sha256").update(git(cwd, ["show", ref + ":" + path], true)).digest("hex");
}
export function buildSealedManifest({ cwd, anchor = SEALED_ANCHOR }) {
  return { version: 1, anchorCommit: anchor, migrations: pathsAt(cwd, anchor).map(path =>
    ({ path, blob: blobAt(cwd, anchor, path), sha256: digest(cwd, anchor, path) })) };
}

/** anchor is injectable only for isolated test repositories; CLI pins the approved Git commit. */
export function checkMigrationIntegrity({ cwd = process.cwd(), anchor = SEALED_ANCHOR, baseRef = "origin/main", candidateRef = "HEAD" } = {}) {
  const issues = [];
  const expected = buildSealedManifest({ cwd, anchor });
  const candidate = git(cwd, ["rev-parse", "--verify", candidateRef + "^{commit}"]).trim();
  try {
    const committed = JSON.parse(git(cwd, ["show", candidate + ":" + MANIFEST]));
    if (JSON.stringify(committed) !== JSON.stringify(expected)) issues.push("The committed sealed manifest differs from immutable Git baseline.");
    const actual = JSON.parse(readFileSync(join(cwd, MANIFEST), "utf8"));
    if (JSON.stringify(actual) !== JSON.stringify(expected)) issues.push("The sealed manifest differs from immutable Git baseline.");
  } catch { issues.push("Missing or invalid sealed manifest."); }
  const base = git(cwd, ["rev-parse", "--verify", baseRef + "^{commit}"]).trim();
  let receipts = [];
  try { receipts = JSON.parse(git(cwd, ["show", base + ":" + RECEIPTS])); } catch { /* no approved reconciliation */ }
  if (!Array.isArray(receipts)) receipts = [];
  const protectedPaths = new Map();
  for (const ref of [anchor, base]) {
    for (const path of pathsAt(cwd, ref)) if (!protectedPaths.has(path)) protectedPaths.set(path, { ref, blob: blobAt(cwd, ref, path) });
  }
  for (const [path, original] of protectedPaths) {
    let committedBlob = null;
    try { committedBlob = blobAt(cwd, candidate, path); } catch { /* candidate deleted this path */ }
    if (committedBlob && committedBlob !== original.blob) issues.push("Historical committed SQL changed: " + path);
    if (existsSync(join(cwd, path))) {
      if (!committedBlob) issues.push("Historical committed SQL deleted: " + path);
      const current = git(cwd, ["hash-object", "--no-filters", "--", path]).trim();
      if (current !== original.blob) issues.push("Historical SQL changed: " + path);
      continue;
    }
    const receipt = receipts.find(r =>
      r.oldPath === path && MIGRATION_PATH.test(r.newPath ?? "") &&
      r.projectId === "fsirdkjgrcocowxqjhjg" &&
      /^\d{14}$/.test(r.hostedVersion ?? "") &&
      r.newPath.startsWith("supabase/migrations/" + r.hostedVersion + "_") &&
      Number.isFinite(Date.parse(r.verifiedAt ?? "")) &&
      r.sha256 === digest(cwd, original.ref, path));
    const replacement = receipt && existsSync(join(cwd, receipt.newPath)) &&
      git(cwd, ["hash-object", "--no-filters", "--", receipt.newPath]).trim();
    let committedReplacement = null;
    if (receipt) { try { committedReplacement = blobAt(cwd, candidate, receipt.newPath); } catch { /* missing committed replacement */ } }
    if (!receipt || replacement !== original.blob || committedReplacement !== original.blob) issues.push("Historical SQL deleted or unapproved reconciliation: " + path);
  }
  return issues;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args.includes("--seal")) writeFileSync(MANIFEST, JSON.stringify(buildSealedManifest({ cwd: process.cwd() }), null, 2) + "\n");
    const index = args.indexOf("--base-ref");
    const baseRef = index < 0 ? "origin/main" : args[index + 1];
    if (!baseRef) throw new Error("Missing trusted base reference.");
    const candidateIndex = args.indexOf("--candidate-ref");
    const candidateRef = candidateIndex < 0 ? "HEAD" : args[candidateIndex + 1];
    if (!candidateRef) throw new Error("Missing candidate commit reference.");
    const issues = checkMigrationIntegrity({ baseRef, candidateRef });
    if (issues.length) { for (const issue of issues) console.error(issue); process.exitCode = 1; }
    else console.log("Migration SQL integrity passed (sealed Git blobs and trusted-base append-only history). Hosted SQL-content parity requires separate receipts.");
  } catch (error) { console.error("Migration integrity failed: " + error.message); process.exitCode = 1; }
}
