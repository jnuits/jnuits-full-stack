import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const {
  evaluateVerification,
  parseCliCommand,
  parseVerificationOutput,
  runSupabaseDbQuery,
  TARGET_MIGRATION_VERSION,
} = require("./lib/admin-invite-search-verification.cjs");

describe("admin invite search DB verification", () => {
  it("parses marked JSON from Supabase CLI output", () => {
    expect(
      parseVerificationOutput(
        'verification_json\n__JNUITS_ADMIN_INVITE_VERIFY__{"migrationApplied":true,"missingIndexes":[]}__END_JNUITS_ADMIN_INVITE_VERIFY__'
      )
    ).toEqual({ migrationApplied: true, missingIndexes: [] });
  });

  it("fails missing migration and column state", () => {
    const evaluation = evaluateVerification(
      {
        claimInvitationIdExists: false,
        migrationApplied: false,
        missingIndexes: [],
        pgTrgmInstalled: true,
        presentIndexes: [],
      },
      {}
    );

    expect(evaluation.ok).toBe(false);
    expect(evaluation.errors.join("\n")).toContain(TARGET_MIGRATION_VERSION);
    expect(evaluation.errors.join("\n")).toContain("claim_invitation_id");
  });

  it("allows missing pg_trgm only when explicitly accepted", () => {
    expect(
      evaluateVerification(
        {
          claimInvitationIdExists: true,
          migrationApplied: true,
          missingIndexes: ["members_admin_invite_email_trgm_idx"],
          pgTrgmInstalled: false,
          presentIndexes: [],
        },
        { ACCEPT_MISSING_PG_TRGM: "1" }
      )
    ).toMatchObject({ ok: true });
  });

  it("uses SUPABASE_CLI_COMMAND and passes the query file to supabase db query", () => {
    const calls = [];
    const data = runSupabaseDbQuery({
      env: { SUPABASE_CLI_COMMAND: "custom-supabase" },
      runner: (command, args) => {
        calls.push({ args, command });
        return {
          status: 0,
          stdout:
            '__JNUITS_ADMIN_INVITE_VERIFY__{"migrationApplied":true,"claimInvitationIdExists":true,"pgTrgmInstalled":true,"presentIndexes":[],"missingIndexes":[]}__END_JNUITS_ADMIN_INVITE_VERIFY__',
        };
      },
      sql: "select 1;",
    });

    expect(data.migrationApplied).toBe(true);
    expect(calls[0].command).toBe("custom-supabase");
    expect(calls[0].args.slice(0, 4)).toEqual(["db", "query", "--linked", "--file"]);
    expect(calls[0].args[4]).toMatch(/jnuits-admin-invite-verify-/);
  });

  it("uses Windows-safe npx invocation for SUPABASE_CLI_COMMAND", () => {
    const calls = [];

    runSupabaseDbQuery({
      env: { SUPABASE_CLI_COMMAND: "npx --yes supabase" },
      platform: "win32",
      runner: (command, args) => {
        calls.push({ args, command });
        return {
          status: 0,
          stdout:
            '__JNUITS_ADMIN_INVITE_VERIFY__{"migrationApplied":true,"claimInvitationIdExists":true,"pgTrgmInstalled":true,"presentIndexes":[],"missingIndexes":[]}__END_JNUITS_ADMIN_INVITE_VERIFY__',
        };
      },
      sql: "select 1;",
    });

    expect(calls[0].command).toBe("cmd.exe");
    expect(calls[0].args[0]).toBe("/d");
    expect(calls[0].args[2]).toContain("npx.cmd --yes supabase db query --linked --file");
  });
  it("fails clearly when Supabase CLI is unavailable", () => {
    expect(() =>
      runSupabaseDbQuery({
        runner: () => ({
          error: Object.assign(new Error("missing"), { code: "ENOENT" }),
        }),
        sql: "select 1;",
      })
    ).toThrow(/Supabase CLI is required/);
  });

  it("parses trusted CLI command prefixes", () => {
    expect(parseCliCommand("custom-supabase --debug")).toEqual({
      argsPrefix: ["--debug"],
      command: "custom-supabase",
    });
  });
});