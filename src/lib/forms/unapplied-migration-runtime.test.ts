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
    expect(workflow).toContain("supabase/setup-cli@");
    expect(workflow).toContain(
      "bash supabase/verification/run-unapplied-migrations.sh"
    );
    expect(workflow).toContain("MIGRATION_RUNTIME_RESULT:");
  });
});
