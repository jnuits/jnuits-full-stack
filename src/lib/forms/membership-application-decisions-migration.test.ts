import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migration = fs.readFileSync(
  path.join(
    process.cwd(),
    "supabase/migrations/20260723174500_membership_application_decisions.sql"
  ),
  "utf8"
);

describe("annual membership application decisions", () => {
  it("locks the application and makes approval idempotent", () => {
    expect(migration).toContain("approve_membership_application");
    expect(migration).toContain("for update");
    expect(migration).toContain("'already_approved'::text");
    expect(migration).toContain("'already_processed'::text");
  });

  it("reconciles identity without provisioning an auth account", () => {
    expect(migration).toContain("lower(trim(email::text))");
    expect(migration).toContain("lower(trim(student_id))");
    expect(migration).toContain("insert into public.members");
    expect(migration).not.toContain("auth.users");
  });

  it("enrolls the canonical member and issues one claim in the transaction", () => {
    expect(migration).toContain("membership_cycle_memberships");
    expect(migration).toContain("on conflict (cycle_id, member_id)");
    expect(migration).toContain("insert into public.member_invitations");
    expect(migration).toContain("membership.application_approved");
  });

  it("supports pending, needs-review, and rejection transitions", () => {
    expect(migration).toContain("review_membership_application");
    expect(migration).toContain("'pending', 'needs_review', 'rejected'");
  });

  it("keeps both decision RPCs server-only", () => {
    expect(migration).toContain("from public, anon, authenticated");
    expect(migration.match(/to service_role/g)).toHaveLength(2);
  });
});
