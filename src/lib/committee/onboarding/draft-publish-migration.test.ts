import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20260927014437_committee_onboarding_draft_publish.sql"
);
const migration = readFileSync(migrationPath, "utf8");

describe("committee onboarding draft publication migration", () => {
  it("provides revision-guarded draft mutation and validation functions", () => {
    for (const fragment of [
      "public.edit_onboarding_draft_row",
      "public.set_onboarding_draft_row_excluded",
      "public.validate_onboarding_draft",
      "p_expected_revision integer",
      "draft_revision = operation.draft_revision + 1",
      "validated_revision = null",
    ]) {
      expect(migration).toContain(fragment);
    }
  });

  it("publishes through an authenticated, operation-routed transaction", () => {
    expect(migration).toContain("public.commit_onboarding_draft");
    expect(migration).toContain("actor_id uuid := auth.uid()");
    expect(migration).toContain("public.can_manage_bulk_operation_type(operation.operation_type)");
    expect(migration).toContain("security definer");
    expect(migration).toContain("set search_path = ''");
    expect(migration).not.toMatch(/p_actor_user_id\s+uuid/i);
  });

  it("locks deterministically and rejects stale or invalid drafts", () => {
    expect(migration).toMatch(/from public\.bulk_operations[\s\S]*for update/i);
    expect(migration).toMatch(
      /from public\.bulk_operation_rows[\s\S]*order by row_number, id[\s\S]*for update/i
    );
    expect(migration).toContain("operation.draft_revision <> p_expected_revision");
    expect(migration).toContain("operation.validated_revision <> operation.draft_revision");
    expect(migration).toContain("row_record.status <> 'valid'");
    expect(migration).toContain("targetVersions");
  });

  it("limits writes to members and non-destructive appointments", () => {
    expect(migration).toContain("insert into public.members");
    expect(migration).toContain("update public.members");
    expect(migration).toContain("insert into public.committee_assignments");
    expect(migration).toContain("update public.committee_assignments");
    expect(migration).not.toMatch(/delete\s+from\s+public\.(members|committee_assignments)/i);
    expect(migration).not.toMatch(/(?:insert\s+into|update|delete\s+from)\s+auth\.(users|identities)/i);
  });

  it("makes completed retries idempotent and records audit evidence", () => {
    expect(migration).toContain("already_committed");
    expect(migration).toContain("operation.status = 'committed'");
    expect(migration).toContain("insert into public.audit_events");
    expect(migration).toContain("committee.onboarding_draft_committed");
    expect(migration).toContain("member.onboarding_draft_committed");
    expect(migration).toContain("committed_by_user_id = actor_id");
  });

  it("withholds every function from public and anon", () => {
    expect(migration).toContain(
      "revoke all on function public.commit_onboarding_draft(uuid, integer, boolean)"
    );
    expect(migration).toContain("from public, anon, authenticated");
    expect(migration).toContain(
      "grant execute on function public.commit_onboarding_draft(uuid, integer, boolean)"
    );
    expect(migration).toContain("to authenticated, service_role");
  });

  it("registers executable scratch-replay assertions", () => {
    const replay = readFileSync(
      resolve(process.cwd(), "supabase/verification/assert-bootstrap-replay.sql"),
      "utf8"
    );

    expect(replay).toContain("ENFORCED 8 committee onboarding draft publication");
    expect(replay).toContain("unauthorized onboarding commit rejected");
    expect(replay).toContain("onboarding commit retry was idempotent");
    expect(replay).toContain("stale onboarding draft rejected");
  });
});
