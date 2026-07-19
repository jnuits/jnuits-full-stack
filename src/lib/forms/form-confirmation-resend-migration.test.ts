import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20260719101454_form_confirmation_resend.sql",
);

describe("form confirmation resend migration", () => {
  it("locks the newest pending submission and limits refreshes in the database", () => {
    expect(existsSync(migrationPath)).toBe(true);

    const migration = readFileSync(migrationPath, "utf8");
    expect(migration).toContain("confirmation_resend_count");
    expect(migration).toContain("confirmation_resend_window_started_at");
    expect(migration).toContain("refresh_form_submission_confirmation");
    expect(migration).toContain("for update");
    expect(migration).toContain("rate_limited");
    expect(migration).toContain("security invoker");
    expect(migration).toContain(
      "revoke all on function public.refresh_form_submission_confirmation",
    );
    expect(migration).toContain(
      "grant execute on function public.refresh_form_submission_confirmation",
    );
  });
});
