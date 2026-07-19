import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20260718220709_event_form_assets_atomic_registration.sql",
);

describe("event form asset migration", () => {
  it("keeps event registration and asset persistence in one service-only transaction", () => {
    expect(existsSync(migrationPath)).toBe(true);

    const migration = readFileSync(migrationPath, "utf8");
    expect(migration).toContain("register_for_event_with_form_assets_atomic");
    expect(migration).toContain("p_assets jsonb");
    expect(migration).toContain("form_submission_assets");
    expect(migration).toContain("10485760");
    expect(migration).toContain("security invoker");
    expect(migration).toContain(
      "revoke all on function public.register_for_event_with_form_assets_atomic",
    );
    expect(migration).toContain(
      "grant execute on function public.register_for_event_with_form_assets_atomic",
    );
  });
});
