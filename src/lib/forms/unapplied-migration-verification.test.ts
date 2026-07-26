import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const harness = readFileSync(
  resolve(process.cwd(), "supabase/verification/verify-unapplied-migrations.sql"),
  "utf8"
);

const UUID_TOKEN = /[0-9a-z]{8}-(?:[0-9a-z]{4}-){3}[0-9a-z]{12}/gi;
const VALID_UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

describe("unapplied migration verification harness", () => {
  it("uses syntactically valid UUID fixture literals", () => {
    const fixtures = harness.match(UUID_TOKEN) || [];

    expect(fixtures.length).toBeGreaterThan(0);
    for (const fixture of fixtures) {
      expect(fixture).toMatch(VALID_UUID);
    }
  });

  it("commits migrations only to an acknowledged scratch database and rolls back fixtures", () => {
    const finalMigration = harness.indexOf(
      "\\i supabase/migrations/20260726020000_retention_purge_boundary_enforcement.sql"
    );
    const fixtureTransaction = harness.indexOf(
      "\n-- Only synthetic fixtures are rollback-scoped. The migration definitions above\n-- intentionally remain installed in this disposable scratch database.\nbegin;\n"
    );

    expect(harness).toContain("scratch_ack=DISPOSABLE_SCRATCH");
    expect(harness).toContain("current_database() = :'expected_database'");
    expect(harness).toContain("migrations remain in scratch");
    expect(harness).toContain("\\set ON_ERROR_STOP on");
    expect(harness).not.toContain("\\quit");
    expect(finalMigration).toBeGreaterThan(0);
    expect(fixtureTransaction).toBeGreaterThan(finalMigration);
    expect(harness.trimEnd()).toMatch(/rollback;$/);
  });

  it("rejects an already-migrated database before printing the recovery snapshot", () => {
    const scope = harness.indexOf(
      "\\echo '=== SCOPE 1: recovery snapshot (store this output) ==='"
    );
    const baselineGuard = harness.indexOf("PRE-MIGRATION BASELINE REQUIRED");
    const recoverySnapshot = harness.indexOf(
      "select pg_get_functiondef(oid) as publish_form_version_before"
    );
    const migrationApply = harness.indexOf(
      "\\i supabase/migrations/20260724140000_form_publication_and_upload_session_hardening.sql"
    );

    expect(scope).toBeGreaterThan(0);
    expect(baselineGuard).toBeGreaterThan(scope);
    expect(baselineGuard).toBeLessThan(recoverySnapshot);
    expect(recoverySnapshot).toBeLessThan(migrationApply);
    expect(harness).toContain("version_row.form_definition_id");
    expect(harness).toContain("v_boundary_text");
    expect(harness).toContain("20260724140000");
    expect(harness).toContain("20260726020000");
  });

  it("proves both form and event retention paths preserve post-boundary data", () => {
    expect(harness).toContain("=== SCOPE 3: retention purge boundary ===");
    expect(harness).toContain("recent submission survived the purge intact");
    expect(harness).toContain(
      "=== SCOPE 3b: event retention purge boundary ==="
    );
    expect(harness).toContain(
      "recent event registration and submission survived intact"
    );
    expect(harness).toContain("'purgedRegistrationRows'");
  });
});
