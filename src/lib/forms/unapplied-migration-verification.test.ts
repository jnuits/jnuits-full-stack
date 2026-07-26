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
      "\nbegin;\n\n-- Only synthetic fixtures are rollback-scoped."
    );

    expect(harness).toContain("scratch_ack=DISPOSABLE_SCRATCH");
    expect(harness).toContain("current_database() = :'expected_database'");
    expect(harness).toContain("migrations remain in scratch");
    expect(finalMigration).toBeGreaterThan(0);
    expect(fixtureTransaction).toBeGreaterThan(finalMigration);
    expect(harness.trimEnd()).toMatch(/rollback;$/);
  });
});
