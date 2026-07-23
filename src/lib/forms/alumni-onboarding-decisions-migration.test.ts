import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migration = fs.readFileSync(
  path.join(
    process.cwd(),
    "supabase/migrations/20260723193000_alumni_onboarding_decisions.sql"
  ),
  "utf8"
);

describe("alumni onboarding decisions", () => {
  it("locks cases and makes approval and rejection idempotent", () => {
    expect(migration).toContain("for update");
    expect(migration).toContain("'already_approved'::text");
    expect(migration).toContain("'already_rejected'::text");
  });

  it("deduplicates by normalized email and JnUITS ID", () => {
    expect(migration).toContain("lower(trim(email::text))");
    expect(migration).toContain("upper(trim(jnuits_id::text))");
    expect(migration).toContain("'identity_conflict'::text");
  });

  it("never downgrades a current member", () => {
    expect(migration).toContain("member.lifecycle_status = 'current'");
    expect(migration).toContain("member.member_type = 'current'");
    expect(migration).toContain("'current_member'::text");
  });

  it("reactivates alumni and issues claims only for unclaimed identities", () => {
    expect(migration).toContain("portal_access_status = 'active'");
    expect(migration).toContain("if member.user_id is null then");
    expect(migration).toContain("insert into public.member_invitations");
    expect(migration).not.toContain("insert into auth.users");
  });

  it("keeps decision functions server-only", () => {
    expect(migration).toContain("from public, anon, authenticated");
    expect(migration.match(/to service_role/g)).toHaveLength(2);
  });
});
