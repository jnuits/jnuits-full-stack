import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const runnerPath = resolve(
  process.cwd(),
  "supabase/verification/run-unapplied-migrations.sh"
);
const baselineHelperPath = resolve(
  process.cwd(),
  "supabase/verification/baseline/20260608092959_restore_rls_auto_enable.sql"
);
const qualityGatePath = resolve(
  process.cwd(),
  ".github/workflows/quality-gate.yml"
);
const supabaseCliActionPath = resolve(
  process.cwd(),
  ".github/actions/setup-supabase-cli/action.yml"
);

const PINNED_SUPABASE_CLI_VERSION = "2.109.1";

// Official release digests for supabase_2.109.1_linux_<arch>.tar.gz. These are
// duplicated here on purpose: the test fails if someone edits the action's
// pinned digest without a matching, reviewed change here.
const PINNED_SUPABASE_CLI_DIGESTS = {
  amd64: "36d87b7fe6b4bcfe89ac47a4354e526cff22480224de426d7b370f6934556976",
  arm64: "a7f7c771acd3a2a13938b5832029beb24787b165d5119ed57ad6e964f3593291",
} as const;

/**
 * Drops `#` comment lines so a behavioural assertion cannot be satisfied, or
 * broken, by prose. The action documents at length why checksums.txt must not
 * be used, and a naive substring check cannot tell that explanation apart from
 * an actual use of it.
 */
function executableLines(shellSource: string) {
  return shellSource
    .split("\n")
    .filter((line) => !/^\s*#/.test(line))
    .join("\n");
}

describe("unapplied migration runtime verification", () => {
  it("reconstructs production through form_upload_sessions without copying target migrations", () => {
    expect(existsSync(runnerPath)).toBe(true);
    expect(existsSync(baselineHelperPath)).toBe(true);
    if (!existsSync(runnerPath) || !existsSync(baselineHelperPath)) return;

    const runner = readFileSync(runnerPath, "utf8");
    const helper = readFileSync(baselineHelperPath, "utf8");

    expect(runner).toContain('baseline_version="20260723233000"');
    expect(runner).toContain("20260608092959_restore_rls_auto_enable.sql");
    expect(runner).not.toContain(
      "20260724140000_form_publication_and_upload_session_hardening.sql\" \"$scratch"
    );
    expect(runner).not.toContain(
      "20260726020000_retention_purge_boundary_enforcement.sql\" \"$scratch"
    );
    expect(helper).toContain(
      "CREATE OR REPLACE FUNCTION public.rls_auto_enable()"
    );
  });

  it("runs only against an acknowledged disposable local stack and always cleans it up", () => {
    expect(existsSync(runnerPath)).toBe(true);
    if (!existsSync(runnerPath)) return;

    const runner = readFileSync(runnerPath, "utf8");

    expect(runner).toContain("mktemp -d");
    expect(runner).toContain("trap cleanup EXIT");
    expect(runner).toContain('"$supabase_bin" start');
    expect(runner).toContain("--workdir");
    expect(runner).toContain("scratch_ack=DISPOSABLE_SCRATCH");
    expect(runner).toContain("expected_database=postgres");
    expect(runner).toContain("select id from auth.users");
    expect(runner).not.toContain("--linked");
    expect(runner).not.toContain("--db-url");
  });

  it("is a required GitHub Actions quality shard", () => {
    const workflow = readFileSync(qualityGatePath, "utf8");

    expect(workflow).toContain("migration_runtime:");
    expect(workflow).toContain(
      "bash supabase/verification/run-unapplied-migrations.sh"
    );
    expect(workflow).toContain("MIGRATION_RUNTIME_RESULT:");
  });

  it("installs the Supabase CLI through the repository's own pinned action", () => {
    // supabase/setup-cli was removed on 2026-07-27. It installs bun through
    // oven-sh/setup-bun, whose cache does not restore to the expected path on a
    // persistent self-hosted runner, so the CLI never became available and both
    // Docker jobs failed before running.
    const workflow = readFileSync(qualityGatePath, "utf8");

    expect(workflow).not.toContain("supabase/setup-cli@");
    expect(workflow).toContain("uses: ./.github/actions/setup-supabase-cli");
    expect(workflow).toContain(`version: ${PINNED_SUPABASE_CLI_VERSION}`);

    // Both Docker jobs must install it, not just one.
    const callSites = workflow.match(
      /uses: \.\/\.github\/actions\/setup-supabase-cli/g
    );
    expect(callSites?.length).toBe(2);
  });

  it("keeps the shim and supabase-go together and proves the CLI can execute", () => {
    expect(existsSync(supabaseCliActionPath)).toBe(true);
    if (!existsSync(supabaseCliActionPath)) return;

    const action = readFileSync(supabaseCliActionPath, "utf8");

    expect(action).toContain(`default: ${PINNED_SUPABASE_CLI_VERSION}`);
    expect(action).toContain("set -euo pipefail");

    // The CLI ships a shim plus supabase-go. Extracting only the shim yields a
    // binary that answers --version and fails on every real command, which is
    // exactly what broke both Docker jobs on 2026-07-27.
    expect(action).toContain("supabase-go");
    expect(action).toContain("did not produce supabase-go alongside the shim");

    // Cherry-picking a single file out of the archive is the defect. Require a
    // whole-archive extraction.
    expect(action).toContain('tar -xzf "$archive" -C "$install_dir"');
    expect(action).not.toContain('install -m 0755 "$tmp/supabase"');

    // Verification must go beyond --version, which the shim answers alone.
    expect(action).toContain("Supabase CLI version mismatch");
    expect(action).toContain('"$shim" --help');

    // A broken install must be wiped, never cached for the next run.
    expect(action).toContain('rm -rf -- "$install_dir"');

    // Installing the CLI must never touch a linked or remote project.
    expect(action).not.toContain("--linked");
    expect(action).not.toContain("--db-url");
    expect(action).not.toContain("SUPABASE_ACCESS_TOKEN");
  });

  it("authenticates the release archive against a pinned SHA-256 digest", () => {
    expect(existsSync(supabaseCliActionPath)).toBe(true);
    if (!existsSync(supabaseCliActionPath)) return;

    const action = readFileSync(supabaseCliActionPath, "utf8");

    // A digest per supported architecture, committed in version control.
    expect(action).toContain(PINNED_SUPABASE_CLI_DIGESTS.amd64);
    expect(action).toContain(PINNED_SUPABASE_CLI_DIGESTS.arm64);
    expect(action).toContain("sha256sum");

    // Fail closed. An unpinned version or architecture must not install
    // anything rather than installing something unauthenticated.
    expect(action).toContain("No pinned SHA-256 digest for Supabase CLI");
    expect(action).toContain("Refusing to install an unauthenticated executable");
  });

  it("never verifies the archive against a checksum file from the same release", () => {
    expect(existsSync(supabaseCliActionPath)).toBe(true);
    if (!existsSync(supabaseCliActionPath)) return;

    const action = readFileSync(supabaseCliActionPath, "utf8");
    const code = executableLines(action);

    // Circular verification is not verification: an attacker who can replace
    // the tarball can replace the release's own checksum file too. The action
    // is expected to *explain* that in a comment, so the prohibition is on
    // fetching the file, not on naming it.
    expect(code).not.toMatch(/\bcurl\b[^\n]*checksums\.txt/i);
    expect(code).not.toMatch(/\bwget\b[^\n]*checksums\.txt/i);
    expect(code).not.toMatch(/-o[^\n]*checksums\.txt/i);

    // `sha256sum -c` reads expected digests from a file. The only trusted
    // source here is the pinned literal, compared directly.
    expect(code).not.toMatch(/sha256sum\s+(-c|--check)\b/);
    expect(code).toContain('"$downloaded_digest" != "$expected_digest"');
  });

  it("verifies before extracting and rebuilds the install directory every run", () => {
    expect(existsSync(supabaseCliActionPath)).toBe(true);
    if (!existsSync(supabaseCliActionPath)) return;

    const action = readFileSync(supabaseCliActionPath, "utf8").replace(
      /\r\n/g,
      "\n"
    );

    const downloadCheckIndex = action.indexOf(
      '[[ "$downloaded_digest" != "$expected_digest" ]]'
    );
    const cachedCheckIndex = action.indexOf(
      '[[ "$cached_digest" == "$expected_digest" ]]'
    );
    const freshExtractIndex = action.indexOf(
      'rm -rf -- "$install_dir"\n        mkdir -p "$install_dir"'
    );
    const extractIndex = action.indexOf('tar -xzf "$archive" -C "$install_dir"');

    expect(cachedCheckIndex).toBeGreaterThan(-1);
    expect(downloadCheckIndex).toBeGreaterThan(-1);
    expect(freshExtractIndex).toBeGreaterThan(-1);
    expect(extractIndex).toBeGreaterThan(-1);

    // Nothing is extracted until the archive has been authenticated.
    expect(extractIndex).toBeGreaterThan(cachedCheckIndex);
    expect(extractIndex).toBeGreaterThan(downloadCheckIndex);

    // A previously extracted tree is never trusted; it is rebuilt from the
    // archive that was just verified.
    expect(extractIndex).toBeGreaterThan(freshExtractIndex);

    // A mismatch removes the invalid cached material rather than keeping it.
    expect(action).toContain('rm -f -- "$archive"');
    expect(action).toContain("FAILED SHA-256 verification");
  });
});
