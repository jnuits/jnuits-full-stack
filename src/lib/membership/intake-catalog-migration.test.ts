import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260929110000_member_intake_catalog.sql",
  ),
  "utf8",
);

describe("member intake catalog migration", () => {
  it("backfills the reviewed 38-department short-code catalog before enforcing it", () => {
    const catalog = migration.match(
      /-- catalog-map:start([\s\S]*?)-- catalog-map:end/,
    )?.[1];
    const rows = catalog?.match(/^\s*\('[^']+',\s*'[A-Z][A-Z0-9]*',\s*'[^']+'\)/gm) ?? [];

    expect(rows).toHaveLength(38);
    expect(catalog).toContain(
      "('computer-science-engineering', 'CSE', 'Computer Science & Engineering')",
    );
    expect(catalog).toContain(
      "('accounting-information-system', 'AIS', 'Accounting & Information Systems')",
    );
    expect(migration).toContain("Active departments are missing reviewed short codes");
    expect(migration).toContain("alter column short_code set not null");
  });

  it("enforces uppercase, case-insensitively unique department short codes", () => {
    expect(migration).toContain("add column if not exists short_code text");
    expect(migration).toContain("departments_short_code_format_check");
    expect(migration).toMatch(/short_code\s*=\s*upper\(short_code\)/i);
    expect(migration).toMatch(/short_code\s*~\s*'\^\[A-Z\]/);
    expect(migration).toContain("departments_short_code_ci_unique");
    expect(migration).toMatch(/unique index[\s\S]*lower\(short_code\)/i);
  });

  it("creates a globally unambiguous alias catalog without generated UUIDs", () => {
    for (const fragment of [
      "create table public.department_aliases",
      "department_code text not null",
      "alias text not null",
      "normalized_alias text generated always as",
      "alias_kind text not null",
      "is_active boolean not null default true",
      "created_at timestamptz not null",
      "updated_at timestamptz not null",
      "department_aliases_normalized_alias_key",
      "short_code",
      "full_name",
      "legacy_slug",
      "historical",
    ]) {
      expect(migration).toContain(fragment);
    }

    expect(migration).toContain("One normalized alias maps to multiple departments");
    expect(migration).not.toMatch(/department_aliases[\s\S]{0,500}gen_random_uuid/i);
  });

  it("adds joining dates without fabricating legacy member dates", () => {
    expect(migration).toMatch(
      /alter table public\.members[\s\S]*add column if not exists joined_on date/i,
    );
    expect(migration).not.toMatch(/update\s+public\.members\s+set\s+joined_on/i);
    expect(migration).not.toMatch(/joined_on\s*=\s*(created_at|current_date|now\(\))/i);
  });

  it("fails with a safe report before tightening member batches to 1 through 99", () => {
    expect(migration).toContain("Members contain batch numbers outside 1 through 99");
    expect(migration).toMatch(/batch_no\s+not\s+between\s+1\s+and\s+99/i);
    expect(migration).toContain("members_batch_no_check");
    expect(migration).toMatch(/batch_no\s+between\s+1\s+and\s+99/i);
  });

  it("keeps every existing source kind and adds one-time Google Sheet provenance", () => {
    for (const sourceKind of ["manual", "csv", "xlsx", "pasted_tsv", "google_sheet"]) {
      expect(migration).toContain(`'${sourceKind}'`);
    }

    expect(migration).toContain("bulk_operations_source_kind_check");
  });

  it("uses explicit grants and operator-only RLS for the exposed alias table", () => {
    expect(migration).toContain("alter table public.department_aliases enable row level security");
    expect(migration).toContain(
      "revoke all privileges on table public.department_aliases from public, anon, authenticated",
    );
    expect(migration).toContain(
      "grant select, insert, update, delete on table public.department_aliases to authenticated",
    );
    expect(migration).toContain("grant all privileges on table public.department_aliases to service_role");
    expect(migration).toContain("department aliases operator read");
    expect(migration).toContain("department aliases operator insert");
    expect(migration).toContain("department aliases operator update");
    expect(migration).toContain("department aliases operator delete");
    expect(migration).not.toMatch(/grant\s+select[^;]*department_aliases[^;]*anon/i);
  });

  it("does not remove cycle history or rewrite department foreign keys", () => {
    expect(migration).not.toMatch(
      /(drop\s+table|delete\s+from|truncate(?:\s+table)?)\s+public\.membership_cycle/i,
    );
    expect(migration).not.toMatch(/drop\s+constraint\s+members_department_code_fkey/i);
    expect(migration).not.toMatch(/update\s+public\.members\s+set\s+department_code/i);
  });
});
