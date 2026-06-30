const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const { buildSupabaseCliEnv, loadDotEnvLocal } = require("./migration-parity.cjs");

const TARGET_MIGRATION_VERSION = "20260630191141";
const REQUIRED_TRGM_INDEXES = [
  "members_admin_invite_email_trgm_idx",
  "members_admin_invite_full_name_trgm_idx",
  "members_admin_invite_jnuits_id_trgm_idx",
  "members_admin_invite_member_type_trgm_idx",
];
const RESULT_PREFIX = "__JNUITS_ADMIN_INVITE_VERIFY__";
const RESULT_SUFFIX = "__END_JNUITS_ADMIN_INVITE_VERIFY__";

function parseCliCommand(value) {
  const command = String(value || "supabase").trim();
  if (!command) {
    return { argsPrefix: [], command: "supabase" };
  }

  const parts = command.split(/\s+/);
  return {
    argsPrefix: parts.slice(1),
    command: parts[0],
  };
}

function buildVerificationSql() {
  const indexValues = REQUIRED_TRGM_INDEXES
    .map((name) => `('${name}')`)
    .join(",\n      ");

  return `with expected_indexes(index_name) as (
      values
      ${indexValues}
    ), verification as (
      select
        exists (
          select 1
          from supabase_migrations.schema_migrations
          where version = '${TARGET_MIGRATION_VERSION}'
        ) as migration_applied,
        exists (
          select 1
          from information_schema.columns
          where table_schema = 'public'
            and table_name = 'admin_invitations'
            and column_name = 'claim_invitation_id'
        ) as claim_invitation_id_exists,
        exists (
          select 1
          from pg_extension
          where extname = 'pg_trgm'
        ) as pg_trgm_installed,
        coalesce(
          (
            select array_agg(index_name order by index_name)
            from expected_indexes
            where exists (
              select 1
              from pg_indexes
              where schemaname = 'public'
                and indexname = expected_indexes.index_name
            )
          ),
          array[]::text[]
        ) as present_indexes,
        coalesce(
          (
            select array_agg(index_name order by index_name)
            from expected_indexes
            where not exists (
              select 1
              from pg_indexes
              where schemaname = 'public'
                and indexname = expected_indexes.index_name
            )
          ),
          array[]::text[]
        ) as missing_indexes
    )
    select '${RESULT_PREFIX}' || json_build_object(
      'migrationApplied', migration_applied,
      'claimInvitationIdExists', claim_invitation_id_exists,
      'pgTrgmInstalled', pg_trgm_installed,
      'presentIndexes', present_indexes,
      'missingIndexes', missing_indexes
    )::text || '${RESULT_SUFFIX}' as verification_json
    from verification;`;
}

function parseVerificationOutput(stdout) {
  const text = String(stdout || "");
  const start = text.indexOf(RESULT_PREFIX);
  const end = text.indexOf(RESULT_SUFFIX);

  if (start < 0 || end < 0 || end <= start) {
    throw new Error("Could not find admin invite verification JSON in Supabase CLI output.");
  }

  const raw = text.slice(start + RESULT_PREFIX.length, end).trim();
  return JSON.parse(raw);
}

function runSupabaseDbQuery({ cwd = process.cwd(), env = process.env, runner, sql } = {}) {
  const run = runner || ((command, args, options) => spawnSync(command, args, options));
  const cli = parseCliCommand(env.SUPABASE_CLI_COMMAND);
  const sqlPath = path.join(
    os.tmpdir(),
    `jnuits-admin-invite-verify-${process.pid}-${Date.now()}.sql`
  );

  fs.writeFileSync(sqlPath, sql || buildVerificationSql(), "utf8");

  try {
    const result = run(
      cli.command,
      [...cli.argsPrefix, "db", "query", "--linked", "--file", sqlPath],
      {
        cwd,
        encoding: "utf8",
        env: buildSupabaseCliEnv(env),
      }
    );

    if (result.error?.code === "ENOENT") {
      throw new Error(
        "Supabase CLI is required for admin invite DB verification but was not found on PATH. " +
          "Install the CLI or set SUPABASE_CLI_COMMAND to a trusted CLI shim."
      );
    }

    if (result.error) {
      throw result.error;
    }

    if (result.status !== 0) {
      const output = `${result.stderr || result.stdout || ""}`.trim();
      throw new Error(
        "Supabase CLI db query failed. " +
          (output ? `Output: ${output.slice(0, 1000)}` : "No output was returned.")
      );
    }

    return parseVerificationOutput(result.stdout || "");
  } finally {
    fs.rmSync(sqlPath, { force: true });
  }
}

function evaluateVerification(data, env = process.env) {
  const errors = [];
  const warnings = [];
  const missingIndexes = Array.isArray(data.missingIndexes) ? data.missingIndexes : [];
  const acceptsMissingTrgm = env.ACCEPT_MISSING_PG_TRGM === "1";

  if (!data.migrationApplied) {
    errors.push(`Migration ${TARGET_MIGRATION_VERSION} is not recorded as applied.`);
  }

  if (!data.claimInvitationIdExists) {
    errors.push("admin_invitations.claim_invitation_id does not exist.");
  }

  if (!data.pgTrgmInstalled) {
    const message = "pg_trgm is not installed; admin invite member search will use slower fallback search.";
    if (acceptsMissingTrgm) {
      warnings.push(message);
    } else {
      errors.push(`${message} Set ACCEPT_MISSING_PG_TRGM=1 only after explicitly accepting this risk.`);
    }
  }

  if (missingIndexes.length > 0) {
    const message = `Missing admin invite trigram indexes: ${missingIndexes.join(", ")}.`;
    if (!data.pgTrgmInstalled && acceptsMissingTrgm) {
      warnings.push(message);
    } else {
      errors.push(message);
    }
  }

  return {
    errors,
    ok: errors.length === 0,
    warnings,
  };
}

function formatVerificationReport(data, evaluation) {
  const lines = ["\nJnUITS Admin Invite Search DB Verification\n"];
  lines.push(`Migration ${TARGET_MIGRATION_VERSION}: ${data.migrationApplied ? "applied" : "missing"}`);
  lines.push(`claim_invitation_id column: ${data.claimInvitationIdExists ? "present" : "missing"}`);
  lines.push(`pg_trgm extension: ${data.pgTrgmInstalled ? "present" : "missing"}`);
  lines.push(`Present indexes: ${(data.presentIndexes || []).join(", ") || "none"}`);
  lines.push(`Missing indexes: ${(data.missingIndexes || []).join(", ") || "none"}`);

  for (const warning of evaluation.warnings) {
    lines.push(`Warning: ${warning}`);
  }

  for (const error of evaluation.errors) {
    lines.push(`Error: ${error}`);
  }

  lines.push(evaluation.ok ? "\nVerification passed." : "\nVerification failed.");
  return `${lines.join("\n")}\n`;
}

async function main() {
  loadDotEnvLocal(process.env, process.cwd());
  const data = runSupabaseDbQuery({ cwd: process.cwd(), env: process.env });
  const evaluation = evaluateVerification(data, process.env);
  console.log(formatVerificationReport(data, evaluation));
  return evaluation.ok ? 0 : 1;
}

module.exports = {
  buildVerificationSql,
  evaluateVerification,
  formatVerificationReport,
  main,
  parseCliCommand,
  parseVerificationOutput,
  runSupabaseDbQuery,
  TARGET_MIGRATION_VERSION,
};

if (require.main === module) {
  main()
    .then((exitCode) => {
      process.exitCode = exitCode;
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
}
