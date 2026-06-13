import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const {
  buildMigrationParityReport,
  buildSupabaseCliEnv,
  parseRemoteVersionsFromMigrationList,
  runSupabaseMigrationList,
} = require("./lib/migration-parity.cjs");

describe("migration parity checker", () => {
  it("reports synced migrations", () => {
    const report = buildMigrationParityReport({
      localFiles: ["20260101000000_initial.sql"],
      remoteVersions: ["20260101000000"],
    });

    expect(report.exitCode).toBe(0);
    expect(report.pendingCount).toBe(0);
    expect(report.missingCount).toBe(0);
  });

  it("reports pending local migrations", () => {
    const report = buildMigrationParityReport({
      localFiles: ["20260101000000_initial.sql", "20260102000000_next.sql"],
      remoteVersions: ["20260101000000"],
    });

    expect(report.exitCode).toBe(2);
    expect(report.entries).toContainEqual({
      filename: "20260102000000_next.sql",
      status: "pending",
      version: "20260102000000",
    });
  });

  it("reports remote migrations with no local file", () => {
    const report = buildMigrationParityReport({
      localFiles: ["20260101000000_initial.sql"],
      remoteVersions: ["20260101000000", "20260103000000"],
    });

    expect(report.exitCode).toBe(3);
    expect(report.missingCount).toBe(1);
  });

  it("parses Supabase CLI migration list JSON rows", () => {
    const stdout = JSON.stringify([
      { local: "20260101000000", remote: "20260101000000" },
      { local: "20260102000000", remote: "" },
    ]);

    expect(parseRemoteVersionsFromMigrationList(stdout)).toEqual(["20260101000000"]);
  });

  it("passes SUPABASE_PAT to the CLI as SUPABASE_ACCESS_TOKEN", () => {
    const env = buildSupabaseCliEnv({ SUPABASE_PAT: "sbp_test" });

    expect(env.SUPABASE_ACCESS_TOKEN).toBe("sbp_test");
  });

  it("fails clearly when Supabase CLI is unavailable", () => {
    expect(() =>
      runSupabaseMigrationList({
        runner: () => ({ error: Object.assign(new Error("missing"), { code: "ENOENT" }) }),
      })
    ).toThrow(/Supabase CLI is required/);
  });
});
