import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20260718131634_event_form_atomic_registration.sql"
);

describe("event form atomic registration migration", () => {
  it("adds one capacity-safe form registration function with private submission linkage", () => {
    expect(existsSync(migrationPath)).toBe(true);

    const migration = readFileSync(migrationPath, "utf8");
    expect(migration).toContain("event_registration_id uuid");
    expect(migration).toContain("register_for_event_with_form_atomic");
    expect(migration).toContain("for update");
    expect(migration).toContain("registration_form_version_id");
    expect(migration).toContain("revoke all on function public.register_for_event_with_form_atomic");
  });
});
