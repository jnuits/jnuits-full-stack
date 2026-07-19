import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20260719060148_form_draft_version_updates.sql",
);

describe("form draft version updates migration", () => {
  it("updates only drafts through a service-role-only, locked RPC", () => {
    expect(existsSync(migrationPath)).toBe(true);

    const migration = readFileSync(migrationPath, "utf8");
    expect(migration).toContain("update_form_draft_version");
    expect(migration).toContain("for update");
    expect(migration).toContain("version.lifecycle <> 'draft'");
    expect(migration).toContain("security invoker");
    expect(migration).toContain(
      "revoke all on function public.update_form_draft_version",
    );
    expect(migration).toContain(
      "grant execute on function public.update_form_draft_version",
    );
  });
});