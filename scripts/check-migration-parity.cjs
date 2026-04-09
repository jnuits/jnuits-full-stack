#!/usr/bin/env node
/**
 * scripts/check-migration-parity.cjs
 *
 * Compares migration files on disk with the list Supabase has applied.
 * Prints a colour-coded report showing:
 *   ✅ applied      – file exists and is tracked as applied
 *   ⚠️  pending      – file exists locally but has NOT been applied yet
 *   ❌ no file      – Supabase shows it as applied but no local file found
 *
 * Usage:
 *   node scripts/check-migration-parity.cjs
 *
 * Requires env vars (reads .env.local automatically):
 *   NEXT_PUBLIC_SUPABASE_URL       — e.g. https://<ref>.supabase.co
 *   SUPABASE_PAT                   — Personal Access Token from
 *                                    supabase.com/dashboard/account/tokens
 *
 * Note: The project API key (SUPABASE_SECRET_KEY) cannot access the
 * Management API. A personal access token is required.
 * Alternative: use `npm run mcp:migration-check` (MCP-based, no PAT needed).
 */

const fs = require("fs");
const path = require("path");

// ── ANSI colour helpers ──────────────────────────────────────────────────────
const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  grey: "\x1b[90m",
};

function col(color, text) {
  return `${color}${text}${c.reset}`;
}

// ── Load env (try .env.local, then process.env) ──────────────────────────────
function loadEnv() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx < 0) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

// ── Resolve local migration files ────────────────────────────────────────────
function getMigrationDir() {
  // Standard Supabase project structure
  const candidates = [
    path.resolve(process.cwd(), "supabase", "migrations"),
    path.resolve(process.cwd(), "migrations"),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(dir)) return dir;
  }
  throw new Error(
    'Could not find migrations directory. Expected supabase/migrations/ or migrations/'
  );
}

function getLocalMigrations(dir) {
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
}

// ── Fetch applied migrations from Supabase Management API ───────────────────
/**
 * Extracts the project ref from a Supabase project URL.
 * e.g. "https://abcdefgh.supabase.co" → "abcdefgh"
 */
function extractProjectRef(supabaseUrl) {
  try {
    const host = new URL(supabaseUrl).hostname; // e.g. abcdefgh.supabase.co
    return host.split(".")[0];
  } catch {
    throw new Error(`Cannot extract project ref from NEXT_PUBLIC_SUPABASE_URL: ${supabaseUrl}`);
  }
}

async function getAppliedMigrations(supabaseUrl, secretKey) {
  const ref = extractProjectRef(supabaseUrl);
  const endpoint = `https://api.supabase.com/v1/projects/${ref}/migrations`;

  const res = await fetch(endpoint, {
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    if (res.status === 401 || res.status === 403) {
      throw new Error(
        `Authentication failed (${res.status}).\n` +
          "  SUPABASE_PAT must be a Personal Access Token, not a project API key.\n" +
          "  Generate one at: https://supabase.com/dashboard/account/tokens"
      );
    }
    throw new Error(
      `Management API returned ${res.status} for project ${ref}.\n` +
        `Response: ${text.slice(0, 300)}`
    );
  }

  const rows = await res.json();
  // Management API returns: [{ version: "20260101...", name: "...", inserted_at: "..." }]
  if (!Array.isArray(rows)) {
    throw new Error(`Unexpected response shape from Management API: ${JSON.stringify(rows).slice(0, 200)}`);
  }

  return rows.map((r) => String(r.version));
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  loadEnv();

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL;
  const patKey =
    process.env.SUPABASE_PAT ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !patKey) {
    console.error(
      col(c.red, "Error:") +
        " Set SUPABASE_PAT to your Personal Access Token.\n" +
        "  Generate one at: https://supabase.com/dashboard/account/tokens\n" +
        "  Note: Project API keys (SUPABASE_SECRET_KEY) cannot access the\n" +
        "  Management API. Only a PAT works for this script.\n"
    );
    process.exit(1);
  }

  console.log(col(c.bold, "\n📋 JnUITS Migration Parity Check\n"));

  // 1. Get local migration file names
  const migDir = getMigrationDir();
  const localFiles = getLocalMigrations(migDir);
  console.log(
    col(c.grey, `Migration directory: ${migDir}`) +
      `  (${localFiles.length} files)\n`
  );

  // 2. Fetch applied migrations via Supabase Management API
  let applied = [];
  try {
    applied = await getAppliedMigrations(supabaseUrl, patKey);
  } catch (err) {
    console.error(col(c.red, "Could not fetch applied migrations:"), err.message);
    process.exit(1);
  }

  const appliedSet = new Set(applied);

  // Migration file name convention: <version>_<name>.sql
  // The "version" is the timestamp prefix (e.g. 20260101120000)
  function extractVersion(filename) {
    return filename.replace(/\.sql$/, "").split("_")[0];
  }

  const localMap = new Map(); // version → filename
  for (const f of localFiles) {
    localMap.set(extractVersion(f), f);
  }

  const localVersions = new Set(localMap.keys());
  const allVersions = new Set([...localVersions, ...appliedSet]);
  const sorted = [...allVersions].sort();

  // 3. Print report
  let pendingCount = 0;
  let missingCount = 0;

  for (const version of sorted) {
    const hasLocal = localVersions.has(version);
    const isApplied = appliedSet.has(version);
    const filename = localMap.get(version) || `(no local file — version ${version})`;

    if (hasLocal && isApplied) {
      console.log(col(c.green, "  ✅ applied    ") + filename);
    } else if (hasLocal && !isApplied) {
      console.log(col(c.yellow, "  ⚠️  pending    ") + filename);
      pendingCount++;
    } else if (!hasLocal && isApplied) {
      console.log(col(c.red, "  ❌ no file    ") + filename);
      missingCount++;
    }
  }

  // 4. Summary
  console.log(
    `\n${col(c.bold, "Summary:")}  ` +
      col(c.green, `${applied.length} applied`) +
      "  |  " +
      col(c.yellow, `${pendingCount} pending`) +
      "  |  " +
      col(c.red, `${missingCount} missing local file`) +
      "\n"
  );

  if (pendingCount > 0) {
    console.log(
      col(c.yellow, "⚠️  Action needed:") +
        " Run `supabase db push` or apply pending migrations manually.\n"
    );
    process.exit(2); // Non-zero exit so CI pipelines can catch drift
  } else if (missingCount > 0) {
    console.log(
      col(c.red, "❌ Warning:") +
        " Some applied migrations have no corresponding local file.\n" +
        "   This can happen after manual schema changes. " +
        "Ensure all changes are committed as migration files.\n"
    );
    process.exit(3);
  } else {
    console.log(col(c.green, "✅ All migrations are in sync.") + "\n");
  }
}

main().catch((err) => {
  console.error(col(c.red, "Fatal error:"), err);
  process.exit(1);
});
