/**
 * Applied-migration integrity manifest (issue #19).
 *
 * Identity is LOGICAL, not positional. Supabase assigns its own version when a
 * migration is applied, so the remote record and the local filename disagree:
 *
 *   local  20260724140000_form_publication_and_upload_session_hardening.sql
 *   remote 20260726105745_form_publication_and_upload_session_hardening
 *
 * The manifest therefore keys on the logical name (the filename with its
 * leading 14-digit version stripped) and records the local version and remote
 * evidence as separate fields. It never asserts that the two are equal.
 *
 * Checksums cover RAW BYTES. Normalising line endings before hashing would let
 * a CRLF rewrite hide a genuine SQL edit, which #19 explicitly forbids.
 * Cross-platform determinism comes from .gitattributes marking migrations
 * `-text`, so Git performs no EOL translation on checkout.
 */

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const MANIFEST_VERSION = 1;
const MANIFEST_FILENAME = "migration-manifest.json";
const REMOTE_EVIDENCE_FILENAME = "migration-remote-evidence.json";
const MIGRATION_FILENAME_PATTERN = /^(\d{14})_([a-z0-9_]+)\.sql$/;

/**
 * Anything that looks like a credential or a database endpoint must never reach
 * the manifest. Verified on every read and write.
 */
const FORBIDDEN_PATTERNS = [
  /postgres(?:ql)?:\/\//i,
  /sb_secret_/i,
  /sb_publishable_/i,
  /service_role/i,
  /eyJ[A-Za-z0-9_-]{10,}\./,
  /\.supabase\.co/i,
  /password\s*[=:]/i,
];

function manifestPath(cwd) {
  return path.join(cwd, "supabase", MANIFEST_FILENAME);
}

function remoteEvidencePath(cwd) {
  return path.join(cwd, "supabase", REMOTE_EVIDENCE_FILENAME);
}

function migrationsDir(cwd) {
  return path.join(cwd, "supabase", "migrations");
}

function parseMigrationFilename(filename) {
  const match = MIGRATION_FILENAME_PATTERN.exec(filename);
  if (!match) {
    return null;
  }
  return { logicalName: match[2], version: match[1] };
}

function hashMigrationBytes(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function readMigrationEntries(cwd) {
  const dir = migrationsDir(cwd);
  if (!fs.existsSync(dir)) {
    throw new Error(`Migrations directory is missing: ${dir}`);
  }

  const entries = [];
  const malformed = [];

  for (const filename of fs.readdirSync(dir).filter((file) => file.endsWith(".sql")).sort()) {
    const parsed = parseMigrationFilename(filename);
    if (!parsed) {
      malformed.push(filename);
      continue;
    }

    entries.push({
      filename,
      logicalName: parsed.logicalName,
      sha256: hashMigrationBytes(fs.readFileSync(path.join(dir, filename))),
      version: parsed.version,
    });
  }

  return { entries, malformed };
}

function readRemoteEvidence(cwd) {
  const file = remoteEvidencePath(cwd);
  if (!fs.existsSync(file)) {
    return {};
  }

  const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
  return parsed?.evidence && typeof parsed.evidence === "object" ? parsed.evidence : {};
}

function assertNoCredentials(serialized) {
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(serialized)) {
      throw new Error(
        `The migration manifest matched a forbidden credential or endpoint pattern (${pattern}). Refusing to continue.`
      );
    }
  }
}

function buildManifest(cwd) {
  const { entries, malformed } = readMigrationEntries(cwd);
  if (malformed.length > 0) {
    throw new Error(
      `Migration filenames must match <14-digit version>_<snake_case name>.sql: ${malformed.join(", ")}`
    );
  }

  const remoteEvidence = readRemoteEvidence(cwd);
  const manifest = {
    checksumAlgorithm: "sha256",
    checksumScope: "raw file bytes, no newline normalisation",
    generatedBy: "npm run migration:manifest:write",
    manifestVersion: MANIFEST_VERSION,
    migrations: entries.map((entry) => {
      const evidence = remoteEvidence[entry.logicalName];
      return {
        localFilename: entry.filename,
        localVersion: entry.version,
        logicalName: entry.logicalName,
        remoteAppliedVersion: evidence?.remoteVersion ?? null,
        sha256: entry.sha256,
        state: evidence?.state === "applied" ? "applied" : "recorded",
      };
    }),
  };

  const serialized = `${JSON.stringify(manifest, null, 2)}\n`;
  assertNoCredentials(serialized);
  return { manifest, serialized };
}

function writeManifest(cwd) {
  const { manifest, serialized } = buildManifest(cwd);
  fs.writeFileSync(manifestPath(cwd), serialized, "utf8");
  return manifest;
}

function readManifest(cwd) {
  const file = manifestPath(cwd);
  if (!fs.existsSync(file)) {
    return null;
  }

  const raw = fs.readFileSync(file, "utf8");
  assertNoCredentials(raw);
  return JSON.parse(raw);
}

/**
 * Compares the manifest against what is on disk.
 *
 * modified          an applied/recorded migration's bytes changed - the defect
 *                   #19 exists to catch. Never acceptable; fix forward.
 * unregistered      a new migration file with no manifest entry. Expected for
 *                   a forward migration; resolve by regenerating and reviewing.
 * missingFromDisk   a manifest entry whose file is gone or renamed away.
 * renamed           same logical name, different filename. Legitimate only as
 *                   documented legacy timestamp reconciliation.
 */
function verifyManifest(cwd) {
  const manifest = readManifest(cwd);
  if (!manifest) {
    return {
      exitCode: 3,
      missingManifest: true,
      modified: [],
      missingFromDisk: [],
      renamed: [],
      unregistered: [],
      verifiedCount: 0,
    };
  }

  const { entries, malformed } = readMigrationEntries(cwd);
  const byLogicalName = new Map(
    (manifest.migrations || []).map((entry) => [entry.logicalName, entry])
  );
  const onDisk = new Map(entries.map((entry) => [entry.logicalName, entry]));

  const modified = [];
  const renamed = [];
  const unregistered = [];
  const missingFromDisk = [];
  let verifiedCount = 0;

  for (const entry of entries) {
    const recorded = byLogicalName.get(entry.logicalName);
    if (!recorded) {
      unregistered.push(entry.filename);
      continue;
    }

    if (recorded.sha256 !== entry.sha256) {
      modified.push({
        actualSha256: entry.sha256,
        expectedSha256: recorded.sha256,
        filename: entry.filename,
        logicalName: entry.logicalName,
        state: recorded.state,
      });
      continue;
    }

    if (recorded.localFilename !== entry.filename) {
      renamed.push({
        from: recorded.localFilename,
        logicalName: entry.logicalName,
        to: entry.filename,
      });
    }

    verifiedCount += 1;
  }

  for (const recorded of manifest.migrations || []) {
    if (!onDisk.has(recorded.logicalName)) {
      missingFromDisk.push(recorded.localFilename);
    }
  }

  const failed =
    modified.length > 0 ||
    missingFromDisk.length > 0 ||
    unregistered.length > 0 ||
    malformed.length > 0;

  return {
    exitCode: failed ? 2 : 0,
    malformed,
    missingFromDisk,
    missingManifest: false,
    modified,
    renamed,
    unregistered,
    verifiedCount,
  };
}

function formatVerificationReport(result) {
  if (result.missingManifest) {
    return [
      "Applied migration manifest is missing.",
      "",
      "This gate cannot pass without a trusted baseline, and a placeholder baseline",
      "would make it lie. Generate it locally and commit the result:",
      "",
      "  npm run migration:manifest:write",
      "",
      "Review the diff before committing. Every digest must correspond to a migration",
      "you intend to freeze.",
    ].join("\n");
  }

  const lines = [];

  if (result.modified.length > 0) {
    lines.push("APPLIED MIGRATION CONTENT CHANGED. This is never acceptable.");
    for (const entry of result.modified) {
      lines.push(`- ${entry.filename} (${entry.state})`);
      lines.push(`    expected sha256 ${entry.expectedSha256}`);
      lines.push(`    actual   sha256 ${entry.actualSha256}`);
    }
    lines.push("");
    lines.push(
      "Revert the edit and ship a corrective forward migration instead. Do not regenerate the manifest to make this pass."
    );
  }

  if (result.missingFromDisk.length > 0) {
    lines.push(`Manifest entries with no file on disk: ${result.missingFromDisk.join(", ")}`);
  }

  if (result.unregistered.length > 0) {
    lines.push(`Migrations with no manifest entry: ${result.unregistered.join(", ")}`);
    lines.push("Register a reviewed forward migration with: npm run migration:manifest:write");
  }

  if (result.malformed && result.malformed.length > 0) {
    lines.push(`Malformed migration filenames: ${result.malformed.join(", ")}`);
  }

  if (result.renamed.length > 0) {
    lines.push("Legacy filename reconciliation (content unchanged):");
    for (const entry of result.renamed) {
      lines.push(`- ${entry.logicalName}: ${entry.from} -> ${entry.to}`);
    }
  }

  if (result.exitCode === 0) {
    lines.unshift(
      `Applied migration integrity verified for ${result.verifiedCount} migrations.`
    );
  }

  return lines.join("\n");
}

module.exports = {
  assertNoCredentials,
  buildManifest,
  formatVerificationReport,
  hashMigrationBytes,
  MANIFEST_FILENAME,
  MANIFEST_VERSION,
  manifestPath,
  parseMigrationFilename,
  readManifest,
  readMigrationEntries,
  verifyManifest,
  writeManifest,
};
