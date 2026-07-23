import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migration = fs.readFileSync(
  path.join(
    process.cwd(),
    "supabase/migrations/20260723123000_form_definition_lifecycle_transitions.sql"
  ),
  "utf8"
);

describe("form definition lifecycle migration", () => {
  it("adds closed lifecycle without changing published version snapshots", () => {
    expect(migration).toContain("'draft', 'published', 'closed', 'archived'");
    expect(migration).toContain("transition_form_definition_lifecycle");
    expect(migration).not.toMatch(/update public\.form_versions\s+set lifecycle/i);
  });

  it("keeps archived forms terminal and clears event links safely", () => {
    expect(migration).toContain("Archived forms cannot change lifecycle");
    expect(migration).toContain(
      "and registration_form_version_id = definition.current_published_version_id"
    );
  });

  it("keeps public roles away from lifecycle mutation", () => {
    expect(migration).toContain("from public, anon, authenticated");
    expect(migration).toContain("to service_role");
  });
});
