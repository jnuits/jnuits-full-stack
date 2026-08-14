const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const {
  buildSpawnInvocation,
  buildSupabaseCliEnv,
  extractMigrationVersion,
  getLocalMigrationFiles,
  loadDotEnvLocal,
  resolveSpawnCommand,
} = require("./migration-parity.cjs");

const RESULT_PREFIX = "__JNUITS_SUPABASE_CLEANUP_AUDIT__";
const RESULT_SUFFIX = "__END_JNUITS_SUPABASE_CLEANUP_AUDIT__";

const EXPECTED_MIGRATIONS = [
  ["20260703020515", "certificate_full_name"],
  ["20260703040706", "cleanup_certificate_legacy_names"],
  ["20260705013614", "tighten_certificate_public_access"],
  ["20260705013928", "public_certificate_view_access"],
  ["20260705020732", "public_certificate_security_invoker_view"],
  ["20260705022356", "revoke_anon_admin_totp_helper"],
  ["20260705151405", "restrict_authenticated_security_definer_exec"],
  ["20260705202621", "tighten_public_certificate_view_grants"],
  ["20260705205024", "add_operational_foreign_key_indexes"],
  ["20260706025103", "tighten_admin_operational_grants"],
  ["20260706030908", "drop_duplicate_fk_indexes"],
  ["20260706031032", "add_remaining_advisor_fk_indexes"],
  ["20260706035422", "drop_duplicate_content_post_indexes"],
  ["20260706074012", "phase2_rls_policy_advisor_cleanup"],
  ["20260710074151", "archive_legacy_gallery_entries"],
];

const WATCHED_TABLES = [
  "admin_invitations",
  "admin_profiles",
  "certificates",
  "certificates_import_staging",
  "content_posts",
  "event_registrations",
  "gallery_album_items",
  "gallery_albums",
  "gallery_entries",
  "media_assets",
  "member_invitations",
  "members",
  "membership_applications",
  "operator_reports",
  "profile_update_requests",
  "public_certificates",
];

const KEY_COLUMNS = [
  "claim_invitation_id",
  "first_name",
  "first_name_raw",
  "full_name",
  "full_name_raw",
  "is_active",
  "last_name",
  "last_name_raw",
  "linked_member_id",
  "source_document_id",
  "source_record_id",
  "status",
  "user_id",
];

const CODE_USAGE_TABLES = [
  "admin_invitations",
  "admin_profiles",
  "certificates",
  "gallery_album_items",
  "gallery_entries",
  "operator_reports",
  "profile_update_requests",
  "public_certificates",
];

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
function sqlString(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function buildValues(rows) {
  return rows.map((row) => `(${row.map(sqlString).join(", ")})`).join(",\n      ");
}

function buildAuditSql() {
  const migrationValues = buildValues(EXPECTED_MIGRATIONS);
  const tableValues = WATCHED_TABLES.map((table) => `(${sqlString(table)})`).join(",\n      ");
  const columnValues = KEY_COLUMNS.map((column) => `(${sqlString(column)})`).join(",\n      ");

  return `with expected_migrations(version, name) as (
      values
      ${migrationValues}
    ),
    watched_tables(table_name) as (
      values
      ${tableValues}
    ),
    key_columns(column_name) as (
      values
      ${columnValues}
    ),
    table_counts as (
      select
        watched_tables.table_name,
        to_regclass('public.' || watched_tables.table_name) is not null as exists,
        case when to_regclass('public.' || watched_tables.table_name) is not null then
          (xpath('/row/count/text()', query_to_xml(format('select count(*) as count from public.%I', watched_tables.table_name), false, true, '')))[1]::text::bigint
        else null end as row_count
      from watched_tables
    ),
    key_column_state as (
      select
        c.table_name,
        c.column_name,
        c.data_type,
        c.is_nullable
      from information_schema.columns c
      join watched_tables t on t.table_name = c.table_name
      join key_columns k on k.column_name = c.column_name
      where c.table_schema = 'public'
    ),
    grants as (
      select
        table_name,
        grantee,
        string_agg(privilege_type, ', ' order by privilege_type) as privileges
      from information_schema.role_table_grants
      where table_schema = 'public'
        and grantee in ('anon', 'authenticated', 'public')
        and table_name in (select table_name from watched_tables)
      group by table_name, grantee
    ),
    broad_grants as (
      select *
      from grants
      where grantee = 'anon'
        and privileges ~ '(DELETE|INSERT|TRIGGER|TRUNCATE|UPDATE)'
    ),
    policies as (
      select
        tablename,
        policyname,
        cmd,
        roles,
        qual,
        with_check
      from pg_policies
      where schemaname = 'public'
        and tablename in (select table_name from watched_tables)
    ),
    security_definer_functions as (
      select
        p.proname as function_name,
        pg_get_function_identity_arguments(p.oid) as args,
        coalesce(
          array_agg(r.rolname order by r.rolname)
            filter (where r.rolname in ('anon', 'authenticated', 'public')),
          array[]::name[]
        ) as exposed_roles
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      left join aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl on true
      left join pg_roles r on r.oid = acl.grantee
      where n.nspname = 'public'
        and p.prosecdef = true
      group by p.oid, p.proname
    ),
    data_quality as (
      select json_build_object(
        'certificateFullNameColumnExists', exists (
          select 1 from key_column_state
          where table_name = 'certificates' and column_name = 'full_name'
        ),
        'certificateLegacyNameColumnsExist', exists (
          select 1 from key_column_state
          where table_name = 'certificates' and column_name = 'first_name'
        ) and exists (
          select 1 from key_column_state
          where table_name = 'certificates' and column_name = 'last_name'
        ),
        'publicCertificateFullNameColumnExists', exists (
          select 1 from key_column_state
          where table_name = 'public_certificates' and column_name = 'full_name'
        ),
        'rawCertificatesPublicSelectTrue', exists (
          select 1 from pg_policies
          where schemaname = 'public'
            and tablename = 'certificates'
            and cmd = 'SELECT'
            and qual = 'true'
        ),
        'adminInvitationClaimColumnExists', exists (
          select 1 from key_column_state
          where table_name = 'admin_invitations' and column_name = 'claim_invitation_id'
        ),
        'broadAnonGrantCount', (select count(*) from broad_grants)
      ) as value
    )
    select '${RESULT_PREFIX}' || json_build_object(
      'generatedAt', now(),
      'expectedMigrations', (
        select coalesce(json_agg(json_build_object(
          'version', expected_migrations.version,
          'name', expected_migrations.name,
          'applied', exists (
            select 1
            from supabase_migrations.schema_migrations sm
            where sm.version = expected_migrations.version
          )
        ) order by expected_migrations.version), '[]'::json)
        from expected_migrations
      ),
      'remoteMigrations', (
        select coalesce(json_agg(json_build_object('version', version, 'name', name) order by version), '[]'::json)
        from supabase_migrations.schema_migrations
      ),
      'tableCounts', (
        select coalesce(json_agg(table_counts order by table_name), '[]'::json)
        from table_counts
      ),
      'keyColumns', (
        select coalesce(json_agg(key_column_state order by table_name, column_name), '[]'::json)
        from key_column_state
      ),
      'rlsTables', (
        select coalesce(json_agg(json_build_object(
          'tableName', relname,
          'rlsEnabled', relrowsecurity,
          'forceRls', relforcerowsecurity
        ) order by relname), '[]'::json)
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public'
          and c.relkind in ('r', 'p')
          and c.relname in (select table_name from watched_tables)
      ),
      'grants', (
        select coalesce(json_agg(grants order by table_name, grantee), '[]'::json)
        from grants
      ),
      'broadGrants', (
        select coalesce(json_agg(broad_grants order by table_name, grantee), '[]'::json)
        from broad_grants
      ),
      'policies', (
        select coalesce(json_agg(policies order by tablename, policyname), '[]'::json)
        from policies
      ),
      'securityDefinerFunctions', (
        select coalesce(json_agg(security_definer_functions order by function_name, args), '[]'::json)
        from security_definer_functions
      ),
      'dataQuality', (select value from data_quality)
    )::text || '${RESULT_SUFFIX}' as verification_json;`;
}

function parseAuditOutput(stdout) {
  const text = String(stdout || "");
  const start = text.indexOf(RESULT_PREFIX);
  const end = text.indexOf(RESULT_SUFFIX);

  if (start < 0 || end < 0 || end <= start) {
    throw new Error("Could not find Supabase cleanup audit JSON in CLI output.");
  }

  return JSON.parse(text.slice(start + RESULT_PREFIX.length, end).trim());
}

function runSupabaseAuditQuery({ cwd = process.cwd(), env = process.env, runner, sql } = {}) {
  const run = runner || ((command, args, options) => spawnSync(command, args, options));
  const cli = parseCliCommand(env.SUPABASE_CLI_COMMAND);
  const sqlPath = path.join(os.tmpdir(), `jnuits-supabase-cleanup-audit-${process.pid}-${Date.now()}.sql`);

  fs.writeFileSync(sqlPath, sql || buildAuditSql(), "utf8");

  try {
    const command = resolveSpawnCommand(cli.command);
    const args = [...cli.argsPrefix, "db", "query", "--linked", "--file", sqlPath];
    const invocation = buildSpawnInvocation(command, args);
    const result = run(
      invocation.command,
      invocation.args,
      {
        cwd,
        encoding: "utf8",
        env: buildSupabaseCliEnv(env),
        maxBuffer: 10 * 1024 * 1024,
      }
    );

    if (result.error?.code === "ENOENT") {
      throw new Error(
        "Supabase CLI is required for cleanup audit verification but was not found on PATH. " +
          "Install the CLI or set SUPABASE_CLI_COMMAND to a trusted CLI shim such as \"npx --yes supabase\"."
      );
    }

    if (result.error) {
      throw result.error;
    }

    if (result.status !== 0) {
      const output = `${result.stderr || result.stdout || ""}`.trim();
      if (/access token not provided/i.test(output)) {
        throw new Error(
          "Supabase CLI db query failed because no access token was available.\n" +
            "Run `supabase login`, set SUPABASE_ACCESS_TOKEN, or set SUPABASE_PAT in .env.local/CI.\n" +
            "No token value was printed."
        );
      }

      throw new Error(
        "Supabase CLI db query failed. " +
          (output ? `Output: ${output.slice(0, 1000)}` : "No output was returned.")
      );
    }

    return parseAuditOutput(result.stdout || "");
  } finally {
    fs.rmSync(sqlPath, { force: true });
  }
}

function walkFiles(dir, roots, files = []) {
  if (!fs.existsSync(dir)) return files;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".next" || entry.name === ".git") {
      continue;
    }

    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(fullPath, roots, files);
    } else if (/\.(cjs|mjs|js|jsx|ts|tsx|sql)$/.test(entry.name)) {
      files.push(path.relative(roots.cwd, fullPath).replace(/\\/g, "/"));
    }
  }

  return files;
}

function scanCodeUsage(cwd = process.cwd()) {
  const files = [
    ...walkFiles(path.join(cwd, "src"), { cwd }),
    ...walkFiles(path.join(cwd, "scripts"), { cwd }),
  ];

  return CODE_USAGE_TABLES.map((tableName) => {
    const matches = [];
    for (const file of files) {
      const text = fs.readFileSync(path.join(cwd, file), "utf8");
      if (text.includes(tableName)) {
        matches.push(file);
      }
    }

    return {
      tableName,
      files: matches.slice(0, 20),
      fileCount: matches.length,
    };
  });
}

function evaluateAudit(data, localFiles = []) {
  const pendingMigrations = (data.expectedMigrations || [])
    .filter((migration) => !migration.applied)
    .map((migration) => migration.version);
  const localVersions = new Set(localFiles.map(extractMigrationVersion).filter(Boolean));
  const missingLocalVersions = (data.remoteMigrations || [])
    .filter((migration) => migration.version && !localVersions.has(migration.version))
    .map((migration) => migration.version);
  const broadGrants = data.broadGrants || [];
  const securityDefinerPublic = (data.securityDefinerFunctions || [])
    .filter((fn) => Array.isArray(fn.exposed_roles) && fn.exposed_roles.includes("anon"));
  const quality = data.dataQuality || {};
  const findings = [];

  if (pendingMigrations.length > 0) {
    findings.push(`Pending expected migrations: ${pendingMigrations.join(", ")}.`);
  }
  if (missingLocalVersions.length > 0) {
    findings.push(`Remote migration versions without local files: ${missingLocalVersions.join(", ")}.`);
  }
  if (!quality.certificateFullNameColumnExists) {
    findings.push("certificates.full_name is missing live; certificate code must keep legacy fallback until migration is applied.");
  }
  if (!quality.publicCertificateFullNameColumnExists) {
    findings.push("public_certificates.full_name is missing live; public certificate APIs depend on pending migration/fallback.");
  }
  if (quality.rawCertificatesPublicSelectTrue) {
    findings.push("Raw certificates table still has public SELECT true; public reads should move to public_certificates only.");
  }
  if (broadGrants.length > 0) {
    findings.push(`${broadGrants.length} broad anon table grant(s) remain; RLS protects rows but grants should be narrowed.`);
  }
  if (securityDefinerPublic.length > 0) {
    findings.push(`${securityDefinerPublic.length} SECURITY DEFINER function(s) are executable by anon and need classification.`);
  }

  return {
    broadGrantCount: broadGrants.length,
    findings,
    missingLocalVersions,
    pendingMigrations,
    securityDefinerAnonCount: securityDefinerPublic.length,
  };
}

function formatTable(rows, columns) {
  if (!rows.length) return "_None._";
  const header = `| ${columns.join(" | ")} |`;
  const separator = `| ${columns.map(() => "---").join(" | ")} |`;
  const body = rows.map((row) => `| ${columns.map((column) => String(row[column] ?? "")).join(" | ")} |`);
  return [header, separator, ...body].join("\n");
}

function formatAuditMarkdown({ codeUsage, data, evaluation, generatedAt = new Date().toISOString(), localFiles }) {
  const tableCounts = data.tableCounts || [];
  const expectedMigrations = data.expectedMigrations || [];
  const keyColumns = data.keyColumns || [];
  const broadGrants = data.broadGrants || [];
  const quality = data.dataQuality || {};

  const lines = [
    "# Supabase DB, Admin, And Frontend Cleanup Audit",
    "",
    `Generated: ${generatedAt}`,
    "",
    "This report is metadata-only and read-only. It does not include service keys, auth tokens, raw invite links, or user PII.",
    "",
    "## Summary Findings",
    "",
    ...evaluation.findings.map((finding) => `- ${finding}`),
  ];

  if (evaluation.findings.length === 0) {
    lines.push("- No cleanup blockers detected by this audit script.");
  }

  lines.push(
    "",
    "## Migration State",
    "",
    formatTable(
      expectedMigrations.map((migration) => ({
        version: migration.version,
        name: migration.name,
        state: migration.applied ? "applied" : "pending",
      })),
      ["version", "name", "state"]
    ),
    "",
    `Local migration files detected: ${localFiles.length}.`,
    "",
    "## Table Counts",
    "",
    formatTable(
      tableCounts.map((row) => ({
        table: row.table_name,
        exists: row.exists ? "yes" : "no",
        rows: row.row_count ?? "",
      })),
      ["table", "exists", "rows"]
    ),
    "",
    "## Key Schema Columns",
    "",
    formatTable(
      keyColumns.map((row) => ({
        table: row.table_name,
        column: row.column_name,
        type: row.data_type,
        nullable: row.is_nullable,
      })),
      ["table", "column", "type", "nullable"]
    ),
    "",
    "## Data Quality Flags",
    "",
    formatTable(
      Object.entries(quality).map(([name, value]) => ({
        name,
        value,
      })),
      ["name", "value"]
    ),
    "",
    "## Broad Grants To Narrow Later",
    "",
    formatTable(
      broadGrants.map((grant) => ({
        table: grant.table_name,
        grantee: grant.grantee,
        privileges: grant.privileges,
      })),
      ["table", "grantee", "privileges"]
    ),
    "",
    "## Code Usage Map",
    "",
    formatTable(
      codeUsage.map((usage) => ({
        table: usage.tableName,
        files: usage.fileCount,
        examples: usage.files.slice(0, 5).join("<br>"),
      })),
      ["table", "files", "examples"]
    ),
    "",
    "## Remaining Advisor Classification",
    "",
    "- `security_rate_limits` is private: anon/auth table grants are revoked, and a service-role-only policy exists only to satisfy RLS policy posture checks.",
    "- Authenticated `SECURITY DEFINER` helper warnings are intentional until a dedicated private-schema/RLS redesign is approved; current app and RLS policies depend on these helpers.",
    "- RLS initplan and multiple permissive policy warnings require explicit policy rewrite approval because they touch auth-sensitive access rules across portal/admin tables.",
    "- Supabase Auth leaked-password protection must be enabled in the Supabase dashboard; it is not controlled by repo migrations.",
    "",
    "## Staged Cleanup Recommendations",
    "",
    "- Keep certificate full-name migrations applied before release; if this audit reports them pending, block certificate launch until production schema matches the app.",
    "- Keep archived `gallery_entries` as historical evidence only. Migration `20260710074151` mirrors all legacy media into the canonical archive album; application code must use `gallery_albums` and `gallery_album_items`.",
    "- Narrow broad `anon` and `authenticated` grants with table/view-specific migrations after route-level smoke checks confirm PostgREST/RLS behavior remains intact.",
    "- Classify exposed `SECURITY DEFINER` functions before revoking execution; do not blindly revoke helpers used by RLS/auth claims.",
    "- Preserve historical `operator_reports` rows; simplify UI copy rather than deleting history.",
    "",
    "## Verification Commands",
    "",
    "```bash",
    "SUPABASE_CLI_COMMAND=\"npx --yes supabase\" npm run db:audit-cleanup",
    "npm run typecheck",
    "npm run lint",
    "npm test",
    "npm run audit:admin-access",
    "npm run audit:admin-ui",
    "npm audit --audit-level=moderate",
    "npm run build",
    "```",
    ""
  );

  return lines.join("\n");
}

function writeReport(markdown, cwd = process.cwd(), now = new Date()) {
  const stamp = now.toISOString().slice(0, 10).replace(/-/g, "");
  const reportDir = path.join(cwd, "artifacts", "reports");
  fs.mkdirSync(reportDir, { recursive: true });
  const reportPath = path.join(reportDir, `supabase-cleanup-audit-${stamp}.md`);
  fs.writeFileSync(reportPath, markdown, "utf8");
  return reportPath;
}

async function main() {
  loadDotEnvLocal(process.env, process.cwd());
  const localFiles = getLocalMigrationFiles(process.cwd());
  const data = runSupabaseAuditQuery({ cwd: process.cwd(), env: process.env });
  const codeUsage = scanCodeUsage(process.cwd());
  const evaluation = evaluateAudit(data, localFiles);
  const markdown = formatAuditMarkdown({
    codeUsage,
    data,
    evaluation,
    localFiles,
  });
  const reportPath = writeReport(markdown, process.cwd());

  console.log(markdown);
  console.log(`\nReport written: ${path.relative(process.cwd(), reportPath).replace(/\\/g, "/")}`);
  return 0;
}

module.exports = {
  buildAuditSql,
  CODE_USAGE_TABLES,
  evaluateAudit,
  EXPECTED_MIGRATIONS,
  formatAuditMarkdown,
  parseAuditOutput,
  parseCliCommand,
  resolveSpawnCommand,
  runSupabaseAuditQuery,
  scanCodeUsage,
  WATCHED_TABLES,
  writeReport,
  main,
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

