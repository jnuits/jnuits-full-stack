import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
const bash = process.platform === "win32" ? "C:/Program Files/Git/bin/bash.exe" : "bash";
// Git Bash's fixture subprocesses take longer under the full parallel Windows
// suite. Bound the harness separately from the runner's unchanged retry policy.
const fixtureTimeout = process.platform === "win32" ? 45_000 : 15_000;
const testTimeout = fixtureTimeout + 5_000;
const fixtures = [];
const tables = ["form_definitions", "form_versions", "form_submissions", "form_submission_assets", "form_export_jobs", "form_archive_jobs", "alumni_onboarding_cases"];
const types = `export type Database = {\n${tables.map((table) => `  ${table}: never`).join("\n")}\n}\n`;

function runFixture({ mode = "pull", failures = 1, lint = false, advisor = false, imageMode = "cached", cliVersion = "2.109.1", generateTypes = true } = {}) {
  const root = mkdtempSync(join(tmpdir(), "jnuits-replay-retry-test-"));
  fixtures.push(root);
  const verification = join(root, "supabase/verification");
  mkdirSync(join(verification, "baseline"), { recursive: true });
  mkdirSync(join(root, "supabase/migrations"), { recursive: true });
  mkdirSync(join(root, "bin"));
  for (const name of ["run-bootstrap-replay.sh", "write-generated-db-types.sh", "configure-bootstrap-replay.mjs", "configure-bootstrap-replay-port.mjs", "prepare-pgmeta-image.sh"]) {
    copyFileSync(join(repoRoot, "supabase/verification", name), join(verification, name));
  }
  writeFileSync(join(verification, "baseline/20260608092959_restore_rls_auto_enable.sql"), "-- disposable fixture\n");
  writeFileSync(join(root, "supabase/migrations/20261001000000_fixture.sql"), "-- disposable fixture\n");
  for (const name of ["assert-bootstrap-replay.sql", "assert-member-intake-publish.sql", "assert-membership-anniversary.sql", "assert-membership-snapshot.sql", "assert-membership-admin-queue.sql", "assert-cycle-free-approval.sql", "assert-membership-review-regressions.sql", "assert-admin-verification.sql", "assert-admin-operation-guards.sql"]) {
    writeFileSync(join(verification, name), "-- SQL itself is tested by real database replay\n");
  }
  writeFileSync(join(verification, "run-admin-verification-concurrency.mjs"), "// Real SQL/concurrency is tested by disposable database replay, not this CLI retry fixture.\n");
  writeFileSync(join(verification, "run-newsletter-concurrency.mjs"), "// Newsletter concurrency is verified by real disposable SQL replay, not the CLI retry fixture.\n");
  writeFileSync(join(root, "expected.types"), types);
  writeFileSync(join(root, "database.types.ts"), "previous canonical artifact\n");
  const cli = join(root, "bin/supabase-fixture");
  writeFileSync(cli, `#!/usr/bin/env bash
set -euo pipefail
case "$1" in
  --version) printf '%s\\n' "$CLI_VERSION";;
  init) mkdir -p supabase; printf 'project_id = "retry-fixture"\\n[experimental.pgdelta]\\nenabled = true\\n' > supabase/config.toml;;
  start|stop) exit 0;;
  gen|db)
    operation="$1"
    if [[ "$operation" == db && "$2" == advisors ]]; then operation=advisors; fi
    count_file="$FIXTURE_ROOT/$operation-attempts"
    count=0; [[ ! -f "$count_file" ]] || count="$(cat "$count_file")"
    count=$((count + 1)); printf '%s' "$count" > "$count_file"
    if [[ "$operation" == "$FAIL_OPERATION" && "$count" -le "$FAILURES" ]]; then
      printf 'partial output that must not reach the canonical artifact\\n'
      if [[ "$FAIL_MODE" == pull ]]; then
        printf 'docker: Error response from daemon: toomanyrequests: Rate exceeded\\n' >&2
        exit 125
      fi
      if [[ "$FAIL_MODE" == registry-timeout ]]; then
        printf 'docker: Error response from daemon: Get "https://public.ecr.aws/v2/": context deadline exceeded\\n' >&2
        exit 125
      fi
      if [[ "$FAIL_MODE" == sql-timeout ]]; then
        printf 'ERROR: canceling statement due to statement timeout (SQLSTATE 57014)\\n' >&2
        exit 7
      fi
      printf 'ERROR: column does not exist (SQLSTATE 42703)\\n' >&2
      exit 7
    fi
    [[ "$operation" != gen ]] || cat "$FIXTURE_ROOT/expected.types"
    ;;
  *) exit 9;;
esac
`, { mode: 0o755 });
  // Replace only external Docker/CLI/network timing; exercise the real runner.
  writeFileSync(join(root, "bin/docker"), `#!/usr/bin/env bash
set -euo pipefail
printf '%s\\n' "$*" >> "$FIXTURE_ROOT/docker-calls"
if [[ "$1" == image && "$2" == inspect ]]; then
  if [[ "$3" == public.ecr.aws/* && "$IMAGE_MODE" != cached && "$IMAGE_MODE" != mismatch && ! -f "$FIXTURE_ROOT/image-tagged" ]]; then exit 1; fi
  if [[ "$*" == *RepoDigests* ]]; then
    if [[ "$IMAGE_MODE" == mismatch || "$IMAGE_MODE" == bad-mirror ]]; then printf 'untrusted@sha256:bad\\n';
    else printf 'ghcr.io/supabase/postgres-meta@sha256:a84cc713585eea7b401e4a2561ec4a1e48c87083d1c7ecb4502f204bb4391300\\n'; fi
  elif [[ "$IMAGE_MODE" == bad-tag && "$3" == public.ecr.aws/* ]]; then printf 'sha256:wrong\\n';
  else printf 'sha256:verified-fixture\\n'; fi
elif [[ "$1" == pull ]]; then
  [[ "$IMAGE_MODE" != pull-failure ]] || exit 125
elif [[ "$1" == tag ]]; then
  touch "$FIXTURE_ROOT/image-tagged"
fi
`, { mode: 0o755 });
  writeFileSync(join(root, "bin/sleep"), '#!/usr/bin/env bash\nprintf "%s\\n" "$1" >> "$FIXTURE_ROOT/backoffs"\n', { mode: 0o755 });
  // Git Bash prepends its own /usr/bin on Windows. Restore the fixture PATH
  // after shell initialization so its sleep stub is actually exercised.
  const launch = 'fixture_bin="$FIXTURE_ROOT/bin"; if command -v cygpath >/dev/null 2>&1; then fixture_bin="$(cygpath -u "$fixture_bin")"; fi; export PATH="$fixture_bin:$PATH"; source "$FIXTURE_ROOT/supabase/verification/run-bootstrap-replay.sh" $GENERATE_TYPES';
  const result = spawnSync(bash, ["--noprofile", "--norc", "-c", launch], {
    cwd: root,
    encoding: "utf8",
    timeout: fixtureTimeout,
    env: { ...process.env, SUPABASE_BIN: cli.replaceAll("\\", "/"), SUPABASE_CLI_COMMAND: "", SUPABASE_REPLAY_DB_PORT: "", DB_TYPES_OUTPUT: join(root, "database.types.ts").replaceAll("\\", "/"), SCRATCH_ACK: "DISPOSABLE_SCRATCH", FIXTURE_ROOT: root.replaceAll("\\", "/"), IMAGE_MODE: imageMode, CLI_VERSION: cliVersion, GENERATE_TYPES: generateTypes ? "--generate-types" : "", FAIL_MODE: mode, FAILURES: String(failures), FAIL_OPERATION: advisor ? "advisors" : lint ? "db" : "gen" },
  });
  const attemptsFile = join(root, advisor ? "advisors-attempts" : lint ? "db-attempts" : "gen-attempts");
  const attempts = existsSync(attemptsFile) ? readFileSync(attemptsFile, "utf8") : "0";
  return { ...result, dockerCalls: readFileSync(join(root, "docker-calls"), "utf8"), attempts: Number(attempts), backoffs: existsSync(join(root, "backoffs")) ? readFileSync(join(root, "backoffs"), "utf8") : "", artifact: readFileSync(join(root, "database.types.ts"), "utf8") };
}

afterEach(() => {
  for (const root of fixtures.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("disposable replay image-pull retry", () => {
  it("runs advisors separately from function lint and fails closed on an advisor SQL error",()=>{
    const result=runFixture({advisor:true,mode:"sql",generateTypes:false,failures:9});
    expect(result.status).toBe(7);expect(result.attempts).toBe(1);expect(result.backoffs).toBe("");
    expect(result.artifact).toBe("previous canonical artifact\n");
  },testTimeout);
  it("rejects an unverified CLI version without applying migrations or generating types", () => {
    const result = runFixture({ cliVersion: "2.110.0", failures: 0 });
    expect(result.status).not.toBe(0);
    expect(result.attempts).toBe(0);
    expect(result.dockerCalls).not.toContain("exec ");
    expect(result.artifact).toBe("previous canonical artifact\n");
  }, testTimeout);
  it("prepares the same image for lint-only replay without generating types", () => {
    const result = runFixture({ imageMode: "missing", generateTypes: false, lint: true, failures: 0 });
    expect(result.status, result.stderr).toBe(0);
    expect(result.attempts).toBe(1);
    expect(result.dockerCalls).toContain("pull ghcr.io/supabase/postgres-meta@sha256:");
    expect(result.artifact).toBe("previous canonical artifact\n");
  }, testTimeout);
  it("rejects an untrusted cached image before generation and preserves the previous artifact", () => {
    const result = runFixture({imageMode:"mismatch",failures:0});
    expect(result.status).not.toBe(0); expect(result.attempts).toBe(0);
    expect(result.artifact).toBe("previous canonical artifact\n");
    expect(result.dockerCalls).not.toContain("pull ghcr.io");
  }, testTimeout);
  it("prepares the exact official GHCR digest under the CLI name before generating types", () => {
    const result = runFixture({imageMode:"missing",failures:0});
    expect(result.status,result.stderr).toBe(0);expect(result.artifact).toBe(types);
    expect(result.dockerCalls).toContain("pull ghcr.io/supabase/postgres-meta@sha256:a84cc713585eea7b401e4a2561ec4a1e48c87083d1c7ecb4502f204bb4391300");
    expect(result.dockerCalls).toContain("tag ghcr.io/supabase/postgres-meta@sha256:a84cc713585eea7b401e4a2561ec4a1e48c87083d1c7ecb4502f204bb4391300 public.ecr.aws/supabase/postgres-meta:v0.96.6");
  }, testTimeout);
  it.each(["pull-failure","bad-mirror","bad-tag"])("fails closed for %s without invoking type generation", imageMode => {
    const result=runFixture({imageMode,failures:0});expect(result.status).not.toBe(0);expect(result.attempts).toBe(0);expect(result.artifact).toBe("previous canonical artifact\n");
  },testTimeout);
  it("uses a verified cached image without a registry pull",()=>{
    const result=runFixture({failures:0});expect(result.status,result.stderr).toBe(0);expect(result.dockerCalls).not.toContain("pull ghcr.io");expect(result.artifact).toBe(types);
  },testTimeout);
  it("retries rate-limited generation and discards partial generator output", () => {
    const result = runFixture();
    expect(result.error, result.stderr).toBeUndefined();
    expect(result.status, result.stderr).toBe(0);
    expect(result.attempts).toBe(2);
    expect(result.artifact).toBe(types);
    expect(result.backoffs).toBe("5\n");
  }, testTimeout);
  it("retries rate-limited function lint without replaying migrations", () => {
    const result = runFixture({ lint: true });
    expect(result.error, result.stderr).toBeUndefined();
    expect(result.status, result.stderr).toBe(0);
    expect(result.attempts).toBe(2);
  }, testTimeout);
  it("fails after bounded pull retries and preserves the previous artifact", () => {
    const result = runFixture({ failures: 9 });
    expect(result.error, result.stderr).toBeUndefined();
    expect(result.status).toBe(125);
    expect(result.attempts).toBe(3);
    expect(result.artifact).toBe("previous canonical artifact\n");
    expect(result.backoffs).toBe("5\n15\n");
  }, testTimeout);
  it("retries the observed Docker registry timeout and discards partial types", () => {
    const result = runFixture({ mode: "registry-timeout" });
    expect(result.status, result.stderr).toBe(0);
    expect(result.attempts).toBe(2);
    expect(result.artifact).toBe(types);
    expect(result.backoffs).toBe("5\n");
  }, testTimeout);
  it("fails closed after three registry timeouts without replacing types", () => {
    const result = runFixture({ mode: "registry-timeout", failures: 9 });
    expect(result.status).toBe(125);
    expect(result.attempts).toBe(3);
    expect(result.artifact).toBe("previous canonical artifact\n");
    expect(result.backoffs).toBe("5\n15\n");
  }, testTimeout);
  it("does not treat a database statement timeout as a registry failure", () => {
    const result = runFixture({ mode: "sql-timeout", lint: true, failures: 9 });
    expect(result.status).toBe(7);
    expect(result.attempts).toBe(1);
    expect(result.backoffs).toBe("");
  }, testTimeout);
  it("never retries SQL failures", () => {
    const result = runFixture({ mode: "sql", lint: true, failures: 9 });
    expect(result.error, result.stderr).toBeUndefined();
    expect(result.status).toBe(7);
    expect(result.attempts).toBe(1);
    expect(result.stderr).toContain("SQLSTATE 42703");
    expect(result.stderr).toContain("partial output that must not reach the canonical artifact");
    expect(result.backoffs).toBe("");
  }, testTimeout);
});
