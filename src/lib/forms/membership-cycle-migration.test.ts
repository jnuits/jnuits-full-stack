import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migration = fs.readFileSync(
  path.join(
    process.cwd(),
    "supabase/migrations/20260723171500_membership_application_cycles.sql"
  ),
  "utf8"
);

describe("historical annual membership cycle migration (retired workflow)", () => {
  it("binds every typed application to one open annual cycle", () => {
    expect(migration).toContain("membership_cycle_id uuid");
    expect(migration).toContain("bind_membership_application_cycle");
    expect(migration).toContain("status = 'active'");
    expect(migration).toContain("starts_on <= today");
    expect(migration).toContain("Membership intake is closed");
  });

  it("deduplicates active applications by normalized email and student ID", () => {
    expect(migration).toContain("lower(trim(email::text))");
    expect(migration).toContain("lower(trim(student_id))");
    expect(migration).toContain("membership_applications_cycle_email_active_idx");
    expect(migration).toContain("membership_applications_cycle_student_active_idx");
  });

  it("serializes open and close transitions with an audit trail", () => {
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain("transition_membership_cycle");
    expect(migration).toContain("Another membership intake cycle is already active");
    expect(migration).toContain("insert into public.audit_events");
    expect(migration).toContain("to service_role");
  });

  it("preserves request-review as a typed moderation state", () => {
    expect(migration).toContain("'needs_review'");
  });
});
