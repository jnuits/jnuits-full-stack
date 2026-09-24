import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260924090000_committee_onboarding_foundation.sql",
  ),
  "utf8",
);

describe("committee onboarding foundation migration", () => {
  it("adds and backfills a per-term position overlay", () => {
    expect(migration).toContain("create table public.committee_term_positions");
    expect(migration).toContain("unique (term_id, role_id)");
    expect(migration).toContain("from public.committee_assignments as assignments");
    expect(migration).toContain("committee_term_positions_slot_range_check");
  });

  it("adds non-destructive uniqueness guards", () => {
    expect(migration).toContain("committee_terms_one_public_executive_number_idx");
    expect(migration).toContain("committee_assignments_linked_appointment_unique_idx");
    expect(migration).not.toMatch(
      /delete\s+from\s+public\.(committee_terms|committee_assignments|members)/i,
    );
    expect(migration).not.toMatch(
      /update\s+public\.(committee_terms|committee_assignments|members)/i,
    );
  });

  it("adds provenance, revisions, targeting, and exclusions", () => {
    for (const fragment of [
      "'committee_roster_import'",
      "'member_profile_import'",
      "source_kind text",
      "source_sha256 text",
      "target_term_id uuid",
      "draft_revision integer",
      "validated_revision integer",
      "is_excluded boolean",
      "excluded_by_user_id uuid",
    ]) {
      expect(migration).toContain(fragment);
    }
  });

  it("routes access through existing scoped permissions", () => {
    expect(migration).toContain("public.can_manage_bulk_operation_type(text)");
    expect(migration).toContain("admin.committee.manage");
    expect(migration).toContain("admin.membership.manage");
    expect(migration).toContain("admin.bulk.manage");
    expect(migration).toContain("bulk operation rows scoped manage");
  });

  it("enables RLS and explicitly withholds the new table from anon", () => {
    expect(migration).toContain(
      "alter table public.committee_term_positions enable row level security",
    );
    expect(migration).toContain(
      "revoke all privileges on table public.committee_term_positions",
    );
    expect(migration).toContain(
      "grant select, insert, update, delete on table public.committee_term_positions",
    );
    expect(migration).not.toContain(
      "grant select on table public.committee_term_positions to anon",
    );
  });
});
