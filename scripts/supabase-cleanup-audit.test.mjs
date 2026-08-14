import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const {
  buildAuditSql,
  EXPECTED_MIGRATIONS,
  evaluateAudit,
  formatAuditMarkdown,
  parseAuditOutput,
  parseCliCommand,
  resolveSpawnCommand,
  runSupabaseAuditQuery,
} = require("./lib/supabase-cleanup-audit.cjs");

describe("supabase cleanup audit", () => {
  it("builds a read-only metadata query", () => {
    const sql = buildAuditSql();

    expect(sql).toContain("supabase_migrations.schema_migrations");
    expect(sql).toContain("information_schema.columns");
    expect(sql).toContain("pg_policies");
    expect(sql).not.toMatch(/\b(update|insert|delete|alter|drop|create)\s+table\b/i);
  });

  it("tracks the canonical gallery archive migration", () => {
    expect(EXPECTED_MIGRATIONS).toContainEqual([
      "20260710074151",
      "archive_legacy_gallery_entries",
    ]);
  });
  it("parses marked audit JSON from Supabase CLI output", () => {
    expect(
      parseAuditOutput(
        'noise __JNUITS_SUPABASE_CLEANUP_AUDIT__{"dataQuality":{"certificateFullNameColumnExists":false}}__END_JNUITS_SUPABASE_CLEANUP_AUDIT__'
      )
    ).toEqual({
      dataQuality: {
        certificateFullNameColumnExists: false,
      },
    });
  });

  it("parses audit JSON wrapped across Supabase CLI table rows", () => {
    const stdout = [
      "│ __JNUITS_SUPABASE_CLEANUP_AUDIT__{\\\"tableCounts\\\":[{\\\"count\\\":2},  │",
      "│  {\\\"count\\\":3}]}__END_JNUITS_SUPABASE_CLEANUP_AUDIT__ │",
    ].join("\\n");

    expect(parseAuditOutput(stdout)).toEqual({
      tableCounts: [{ count: 2 }, { count: 3 }],
    });
  });

  it("flags pending certificate migrations and unsafe certificate exposure", () => {
    const evaluation = evaluateAudit(
      {
        broadGrants: [{ table_name: "members", grantee: "anon", privileges: "UPDATE" }],
        dataQuality: {
          certificateFullNameColumnExists: false,
          publicCertificateFullNameColumnExists: false,
          rawCertificatesPublicSelectTrue: true,
        },
        expectedMigrations: [
          { applied: false, version: "20260703020515" },
          { applied: false, version: "20260703040706" },
        ],
        remoteMigrations: [],
        securityDefinerFunctions: [{ exposed_roles: ["anon"], function_name: "example" }],
      },
      ["20260703020515_certificate_full_name.sql", "20260703040706_cleanup_certificate_legacy_names.sql"]
    );

    expect(evaluation.pendingMigrations).toEqual(["20260703020515", "20260703040706"]);
    expect(evaluation.broadGrantCount).toBe(1);
    expect(evaluation.securityDefinerAnonCount).toBe(1);
    expect(evaluation.findings.join("\n")).toContain("certificates.full_name is missing");
    expect(evaluation.findings.join("\n")).toContain("public SELECT true");
  });

  it("formats a metadata-only markdown report", () => {
    const markdown = formatAuditMarkdown({
      codeUsage: [{ fileCount: 1, files: ["src/example.ts"], tableName: "certificates" }],
      data: {
        broadGrants: [],
        dataQuality: { certificateFullNameColumnExists: true },
        expectedMigrations: [{ applied: true, name: "certificate_full_name", version: "20260703020515" }],
        keyColumns: [{ column_name: "full_name", data_type: "text", is_nullable: "NO", table_name: "certificates" }],
        tableCounts: [{ exists: true, row_count: 134, table_name: "certificates" }],
      },
      evaluation: { findings: [] },
      generatedAt: "2026-07-04T00:00:00.000Z",
      localFiles: ["20260703020515_certificate_full_name.sql"],
    });

    expect(markdown).toContain("# Supabase DB, Admin, And Frontend Cleanup Audit");
    expect(markdown).toContain("metadata-only");
    expect(markdown).toContain("certificates");
  });

  it("parses trusted CLI command prefixes", () => {
    expect(parseCliCommand("npx --yes supabase")).toEqual({
      argsPrefix: ["--yes", "supabase"],
      command: "npx",
    });
  });


  it("runs cleanup audit through the shared Windows-safe CLI invocation", () => {
    const calls = [];
    const result = runSupabaseAuditQuery({
      env: { SUPABASE_CLI_COMMAND: "npx --yes supabase" },
      runner: (command, args, options) => {
        calls.push({ args, command, options });
        return {
          status: 0,
          stdout: "noise __JNUITS_SUPABASE_CLEANUP_AUDIT__{\"ok\":true}__END_JNUITS_SUPABASE_CLEANUP_AUDIT__",
        };
      },
      sql: "select 1 as verification_json;",
    });

    expect(result).toEqual({ ok: true });
    expect(calls[0].options.shell).toBeUndefined();

    if (process.platform === "win32") {
      expect(calls[0].command).toBe("cmd.exe");
      expect(calls[0].args[0]).toBe("/d");
      expect(calls[0].args[1]).toBe("/c");
      expect(calls[0].args[2]).toContain("npx.cmd --yes supabase db query --linked --file");
    } else {
      expect(calls[0].command).toBe("npx");
      expect(calls[0].args.slice(0, 6)).toEqual(["--yes", "supabase", "db", "query", "--linked", "--file"]);
    }
  });

  it("allows metadata output larger than the Node spawnSync default buffer", () => {
    const stdout =
      "x".repeat(1024 * 1024 + 1) +
      '__JNUITS_SUPABASE_CLEANUP_AUDIT__{"ok":true}__END_JNUITS_SUPABASE_CLEANUP_AUDIT__';

    const result = runSupabaseAuditQuery({
      runner: (_command, _args, options) => {
        if (!options.maxBuffer || Buffer.byteLength(stdout) > options.maxBuffer) {
          const error = new Error("spawnSync supabase ENOBUFS");
          error.code = "ENOBUFS";
          return { error, status: null };
        }

        return { status: 0, stdout };
      },
      sql: "select 1 as verification_json;",
    });

    expect(result).toEqual({ ok: true });
  });

  it("fails clearly when cleanup audit lacks a Supabase access token", () => {
    expect(() =>
      runSupabaseAuditQuery({
        runner: () => ({
          status: 1,
          stderr: "{\"message\":\"Access token not provided.\"}",
        }),
        sql: "select 1 as verification_json;",
      })
    ).toThrow(/no access token was available/);
  });

  it("uses Windows command shims for npm-style executables", () => {
    expect(resolveSpawnCommand("npx", "win32")).toBe("npx.cmd");
    expect(resolveSpawnCommand("custom-supabase", "linux")).toBe("custom-supabase");
  });
});
