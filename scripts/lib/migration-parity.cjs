const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  grey: "\x1b[90m",
};

function col(color, text) {
  return `${color}${text}${c.reset}`;
}

function loadDotEnvLocal(env = process.env, cwd = process.cwd()) {
  const envPath = path.resolve(cwd, ".env.local");
  if (!fs.existsSync(envPath)) {
    return;
  }

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const eqIdx = trimmed.indexOf("=");
    if (eqIdx < 0) {
      continue;
    }

    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
    if (!env[key]) {
      env[key] = val;
    }
  }
}

function getMigrationDir(cwd = process.cwd()) {
  const candidates = [
    path.resolve(cwd, "supabase", "migrations"),
    path.resolve(cwd, "migrations"),
  ];

  for (const dir of candidates) {
    if (fs.existsSync(dir)) {
      return dir;
    }
  }

  throw new Error(
    "Could not find migrations directory. Expected supabase/migrations/ or migrations/."
  );
}

function getLocalMigrationFiles(cwd = process.cwd()) {
  return fs
    .readdirSync(getMigrationDir(cwd))
    .filter((file) => file.endsWith(".sql"))
    .sort();
}

function extractMigrationVersion(filename) {
  const match = String(filename).match(/^(\d{14})(?:_|\.|$)/);
  return match?.[1] ?? null;
}

function addVersion(target, value) {
  if (typeof value !== "string") {
    return;
  }

  const match = value.match(/\b(\d{14})\b/);
  if (match?.[1]) {
    target.add(match[1]);
  }
}

function parseRemoteVersionsFromMigrationList(stdout) {
  let parsed;
  try {
    parsed = JSON.parse(stdout);
  } catch (error) {
    throw new Error(
      "Supabase CLI did not return JSON for `supabase migration list --linked --output json`."
    );
  }

  const versions = new Set();

  function visit(value, key = "") {
    if (value == null) {
      return;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        visit(item, key);
      }
      return;
    }

    if (typeof value === "string") {
      if (
        key === "remote" ||
        key === "remote_version" ||
        key === "remoteVersion" ||
        key === "version"
      ) {
        addVersion(versions, value);
      }
      return;
    }

    if (typeof value !== "object") {
      return;
    }

    if ("remote" in value) {
      visit(value.remote, "remote");
    }
    if ("remote_version" in value) {
      visit(value.remote_version, "remote_version");
    }
    if ("remoteVersion" in value) {
      visit(value.remoteVersion, "remoteVersion");
    }
    if ("version" in value && !("local" in value)) {
      visit(value.version, "version");
    }
    if ("migrations" in value) {
      visit(value.migrations, "migrations");
    }
    if ("remote" in value === false && "migrations" in value === false) {
      for (const [childKey, childValue] of Object.entries(value)) {
        visit(childValue, childKey);
      }
    }
  }

  visit(parsed);

  return [...versions].sort();
}

function buildSupabaseCliEnv(env) {
  const childEnv = { ...env };
  if (!childEnv.SUPABASE_ACCESS_TOKEN && childEnv.SUPABASE_PAT) {
    childEnv.SUPABASE_ACCESS_TOKEN = childEnv.SUPABASE_PAT;
  }
  return childEnv;
}

function runSupabaseMigrationList({ cwd = process.cwd(), env = process.env, runner } = {}) {
  const run =
    runner ??
    ((command, args, options) =>
      spawnSync(command, args, {
        ...options,
        encoding: "utf8",
      }));

  const result = run(
    "supabase",
    ["migration", "list", "--linked", "--output", "json"],
    {
      cwd,
      env: buildSupabaseCliEnv(env),
      encoding: "utf8",
    }
  );

  if (result.error?.code === "ENOENT") {
    throw new Error(
      "Supabase CLI is required for migration parity checks but was not found on PATH.\n" +
        "Install/login the Supabase CLI or run this check in CI with SUPABASE_ACCESS_TOKEN/SUPABASE_PAT.\n" +
        "This script no longer calls the unsupported Management API migrations endpoint."
    );
  }

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    const output = `${result.stderr || result.stdout || ""}`.trim();
    throw new Error(
      "Supabase CLI migration list failed.\n" +
        (output ? `Output: ${output.slice(0, 1000)}` : "No output was returned.")
    );
  }

  return parseRemoteVersionsFromMigrationList(result.stdout || "[]");
}

function buildMigrationParityReport({ localFiles, remoteVersions }) {
  const localMap = new Map();
  for (const file of localFiles) {
    const version = extractMigrationVersion(file);
    if (version) {
      localMap.set(version, file);
    }
  }

  const remoteSet = new Set(remoteVersions);
  const localSet = new Set(localMap.keys());
  const versions = [...new Set([...localSet, ...remoteSet])].sort();
  const entries = versions.map((version) => {
    const hasLocal = localSet.has(version);
    const isRemote = remoteSet.has(version);
    const filename = localMap.get(version) ?? `(no local file - version ${version})`;

    return {
      filename,
      status: hasLocal && isRemote ? "applied" : hasLocal ? "pending" : "missing",
      version,
    };
  });

  const pendingCount = entries.filter((entry) => entry.status === "pending").length;
  const missingCount = entries.filter((entry) => entry.status === "missing").length;

  return {
    appliedCount: remoteVersions.length,
    entries,
    exitCode: pendingCount > 0 ? 2 : missingCount > 0 ? 3 : 0,
    missingCount,
    pendingCount,
  };
}

function formatMigrationParityReport(result) {
  const lines = [col(c.bold, "\nJnUITS Migration Parity Check\n")];

  for (const entry of result.entries) {
    if (entry.status === "applied") {
      lines.push(col(c.green, "  applied    ") + entry.filename);
    } else if (entry.status === "pending") {
      lines.push(col(c.yellow, "  pending    ") + entry.filename);
    } else {
      lines.push(col(c.red, "  no file    ") + entry.filename);
    }
  }

  lines.push(
    `\n${col(c.bold, "Summary:")}  ` +
      col(c.green, `${result.appliedCount} applied`) +
      "  |  " +
      col(c.yellow, `${result.pendingCount} pending`) +
      "  |  " +
      col(c.red, `${result.missingCount} missing local file`)
  );

  if (result.pendingCount > 0) {
    lines.push(
      "\n" +
        col(c.yellow, "Action needed:") +
        " Apply pending migrations with a reviewed Supabase CLI/db workflow."
    );
  } else if (result.missingCount > 0) {
    lines.push(
      "\n" +
        col(c.red, "Warning:") +
        " Remote migration history contains versions without local files."
    );
  } else {
    lines.push("\n" + col(c.green, "All migrations are in sync."));
  }

  return `${lines.join("\n")}\n`;
}

function runMigrationParityCheck({ cwd = process.cwd(), env = process.env, localFiles } = {}) {
  const files = localFiles ?? getLocalMigrationFiles(cwd);
  const remoteVersions = runSupabaseMigrationList({ cwd, env });
  return buildMigrationParityReport({ localFiles: files, remoteVersions });
}

module.exports = {
  buildMigrationParityReport,
  buildSupabaseCliEnv,
  extractMigrationVersion,
  formatMigrationParityReport,
  getLocalMigrationFiles,
  loadDotEnvLocal,
  parseRemoteVersionsFromMigrationList,
  runMigrationParityCheck,
  runSupabaseMigrationList,
};
