import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const path = resolve("supabase/migrations/20261001090000_member_intake_publish_contract.sql");
const sql = existsSync(path) ? readFileSync(path, "utf8") : "";

describe("member intake publish SQL contract", () => {
  it("replaces the RPC forward without uppercasing slug-valued foreign keys", () => {
    expect(sql).toContain("create or replace function public.commit_onboarding_draft(");
    expect(sql).toContain("department_aliases");
    expect(sql).not.toContain("upper(btrim(canonical ->> 'departmentCode'))");
  });

  it("accepts leading-zero batches and validates the stored 1..99 range", () => {
    expect(sql).toContain("'^[0-9]{1,2}$'");
    expect(sql).toContain("batch_value not between 1 and 99");
  });

  it("validates real ISO joining dates and persists creates and date-only updates", () => {
    expect(sql).toContain("joined_value := (canonical ->> 'joinedOn')::date");
    expect(sql).toContain("invalid_datetime_format or datetime_field_overflow");
    expect(sql).toContain("member_record.joined_on is distinct from joined_value");
    expect(sql).toContain("joined_on = case when canonical ? 'joinedOn' then joined_value else member_record.joined_on end");
    expect(sql).toMatch(/insert into public\.members\s*\([\s\S]*?joined_on[\s\S]*?\) values \([\s\S]*?joined_value/);
    expect(sql).toContain("New member profiles require department, batch, and joining date");
  });

  it("preserves permission, revision, transactional locking, and retry protections", () => {
    for (const guard of ["security definer", "set search_path = ''", "can_manage_bulk_operation_type",
      "pg_advisory_xact_lock", "for update", "already_committed", "member changed after validation",
      "configured seat limit", "validated_revision", "revoke all on function public.commit_onboarding_draft"]) {
      expect(sql).toContain(guard);
    }
    expect(sql).not.toMatch(/grant execute[^;]*\bto anon\b/);
  });
});
