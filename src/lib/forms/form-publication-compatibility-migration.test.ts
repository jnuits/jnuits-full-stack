import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20260722120000_event_form_publication_compatibility.sql"
);

describe("event form publication compatibility migration", () => {
  it("validates the linked event before retiring the published form version", () => {
    expect(existsSync(migrationPath)).toBe(true);
    if (!existsSync(migrationPath)) return;
    const migration = readFileSync(migrationPath, "utf8");
    const compatibilityCheck = migration.indexOf("event.registration_mode <> 'internal'");
    const archivedCheck = migration.indexOf("event.status = 'archived'");
    const retirePublishedVersion = migration.indexOf("set lifecycle = 'retired'");
    expect(compatibilityCheck).toBeGreaterThan(0);
    expect(archivedCheck).toBeGreaterThan(compatibilityCheck);
    expect(retirePublishedVersion).toBeGreaterThan(archivedCheck);
  });

  it("keeps the selected version draft-only and links the event after publication", () => {
    expect(existsSync(migrationPath)).toBe(true);
    if (!existsSync(migrationPath)) return;
    const migration = readFileSync(migrationPath, "utf8");
    expect(migration).toContain("version.lifecycle <> 'draft'");
    expect(migration).toContain("set registration_form_version_id = version.id");
  });
});
