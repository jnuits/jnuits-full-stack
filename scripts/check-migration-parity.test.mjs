import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const {
  buildMigrationParityReport,
  buildSupabaseCliEnv,
  parseRemoteVersionsFromMigrationTable,
  parseRemoteVersionsFromMigrationList,
  buildSpawnInvocation,
  resolveSpawnCommand,
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

  it("parses Supabase CLI table output rows", () => {
    const stdout = `
      Local          | Remote         | Time (UTC)
      ---------------|----------------|---------------------
      20260101000000 | 20260101000000 | 2026-01-01 00:00:00
      20260102000000 |                |
                     | 20260103000000 | 2026-01-03 00:00:00
    `;

    expect(parseRemoteVersionsFromMigrationTable(stdout)).toEqual([
      "20260101000000",
      "20260103000000",
    ]);
    expect(parseRemoteVersionsFromMigrationList(stdout)).toEqual([
      "20260101000000",
      "20260103000000",
    ]);
  });

  it("parses box-drawing Supabase CLI table output rows", () => {
    const stdout = `
      Local          │ Remote         │ Time (UTC)
      ───────────────│────────────────│─────────────────────
      20260101000000 │ 20260101000000 │ 2026-01-01 00:00:00
                     │ 20260103000000 │ 2026-01-03 00:00:00
    `;

    expect(parseRemoteVersionsFromMigrationList(stdout)).toEqual([
      "20260101000000",
      "20260103000000",
    ]);
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

  it("uses SUPABASE_CLI_COMMAND when provided", () => {
    const calls = [];

    runSupabaseMigrationList({
      env: { SUPABASE_CLI_COMMAND: "custom-supabase" },
      runner: (command, args) => {
        calls.push({ args, command });
        return {
          status: 0,
          stdout: JSON.stringify([{ remote: "20260101000000" }]),
        };
      },
    });

    expect(calls[0]).toEqual({
      args: ["migration", "list", "--linked", "--output", "json"],
      command: "custom-supabase",
    });
  });
  it("resolves npm-family commands to .cmd on Windows", () => {
    expect(resolveSpawnCommand("npx", "win32")).toBe("npx.cmd");
    expect(resolveSpawnCommand("npm", "win32")).toBe("npm.cmd");
    expect(resolveSpawnCommand("supabase", "win32")).toBe("supabase.cmd");
    expect(resolveSpawnCommand("custom-supabase", "win32")).toBe("custom-supabase");
    expect(resolveSpawnCommand("npx", "linux")).toBe("npx");
  });

  it("builds an explicit cmd.exe invocation for Windows cmd and bat shims", () => {
    expect(buildSpawnInvocation("npx.cmd", ["--yes", "supabase"], "win32")).toEqual({
      args: ["/d", "/c", "npx.cmd --yes supabase"],
      command: "cmd.exe",
    });
    expect(buildSpawnInvocation("supabase", ["migration"], "win32")).toEqual({
      args: ["migration"],
      command: "supabase",
    });
    expect(buildSpawnInvocation("npx.cmd", ["--yes"], "linux")).toEqual({
      args: ["--yes"],
      command: "npx.cmd",
    });
  });

  it("passes a cmd.exe command line when the resolved command is a Windows cmd shim", () => {
    const calls = [];

    runSupabaseMigrationList({
      env: { SUPABASE_CLI_COMMAND: "npx --yes supabase" },
      runner: (command, args, options) => {
        calls.push({ args, command, options });
        return {
          status: 0,
          stdout: JSON.stringify([{ remote: "20260101000000" }]),
        };
      },
    });

    if (process.platform === "win32") {
      expect(calls[0].command).toBe("cmd.exe");
      expect(calls[0].args).toEqual([
        "/d",
        "/c",
        "npx.cmd --yes supabase migration list --linked --output json",
      ]);
    } else {
      expect(calls[0].command).toBe("npx");
      expect(calls[0].args).toEqual([
        "--yes",
        "supabase",
        "migration",
        "list",
        "--linked",
        "--output",
        "json",
      ]);
    }
  });

  it("fails clearly when the CLI reports a missing access token", () => {
    expect(() =>
      runSupabaseMigrationList({
        runner: () => ({
          status: 1,
          stderr: "Access token not provided.",
        }),
      })
    ).toThrow(/no access token was available/);
  });
});
