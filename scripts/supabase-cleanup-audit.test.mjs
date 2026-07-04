import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const {
  buildAuditSql,
  evaluateAudit,
  formatAuditMarkdown,
  parseAuditOutput,
  parseCliCommand,
  resolveSpawnCommand,
} = require("./lib/supabase-cleanup-audit.cjs");

describe("supabase cleanup audit", () => {
  it("builds a read-only metadata query", () => {
    const sql = buildAuditSql();

    expect(sql).toContain("supabase_migrations.schema_migrations");
    expect(sql).toContain("information_schema.columns");
    expect(sql).toContain("pg_policies");
    expect(sql).not.toMatch(/\b(update|insert|delete|alter|drop|create)\s+table\b/i);
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
  it("uses Windows command shims for npm-style executables", () => {
    expect(resolveSpawnCommand("npx", "win32")).toBe("npx.cmd");
    expect(resolveSpawnCommand("custom-supabase", "linux")).toBe("custom-supabase");
  });
});
