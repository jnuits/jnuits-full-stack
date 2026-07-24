import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) { return readFileSync(resolve(process.cwd(), path), "utf8"); }
const platform = source("supabase/migrations/20260718131228_create_versioned_form_platform.sql");
const lifecycle = source("supabase/migrations/20260723123000_form_definition_lifecycle_transitions.sql");
const repository = source("src/lib/forms/repository.ts");
const exportRoute = source("src/app/api/admin/forms/[formId]/submissions/export/route.ts");
const retention = source("src/lib/retention/operations.ts");
const tables = ["form_definitions", "form_versions", "form_submissions", "form_submission_assets", "form_export_jobs", "form_archive_jobs"];

describe("shared form platform lifecycle wiring", () => {
  it("defines and protects every lifecycle entity", () => {
    for (const table of tables) {
      expect(platform).toContain(`create table public.${table}`);
      expect(platform).toContain(`alter table public.${table} enable row level security`);
      expect(platform).toContain(`revoke all on table public.${table} from public, anon, authenticated`);
    }
  });
  it("pins submissions and assets to immutable versions", () => {
    expect(platform).toContain("Published form versions are immutable.");
    expect(platform).toContain("Submissions must target a published version");
    expect(repository).toContain("form_version_id: options.formVersionId");
    expect(repository).toContain('from("form_submission_assets").insert');
  });
  it("wires controlled close, reopen, archive, export, and retention", () => {
    expect(lifecycle).toContain("transition_form_definition_lifecycle");
    expect(lifecycle).toContain("p_target_lifecycle");
    expect(lifecycle).toContain("next_lifecycle := 'archived'");
    expect(exportRoute).toContain('from("form_export_jobs").insert');
    expect(exportRoute).toContain("form_submission_assets(");
    expect(retention).toContain("form_archive_jobs");
    expect(retention).toContain("archive_requested");
    expect(retention).toContain("form_submission_assets(");
  });
  it("keeps payment configuration disabled at database and application boundaries", () => {
    expect(platform.match(/coalesce\(payment_configuration ->> 'enabled', 'false'\) = 'false'/g)?.length).toBeGreaterThanOrEqual(2);
    expect(repository).not.toContain("payment_configuration: { enabled: true }");
  });
});
