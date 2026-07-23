import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migration = fs.readFileSync(
  path.join(process.cwd(), "supabase/migrations/20260723163000_event_atomic_checkin.sql"),
  "utf8"
);

describe("atomic event check-in migration", () => {
  it("locks one event-scoped registration and rejects ineligible states", () => {
    expect(migration).toContain("event_id = p_event_id");
    expect(migration).toContain("registration_code = v_code");
    expect(migration).toContain("for update");
    expect(migration).toContain("'cancelled'::text");
    expect(migration).toContain("'waitlisted'::text");
  });

  it("makes retries idempotent and audits only the first check-in", () => {
    expect(migration).toContain("'already_checked_in'::text");
    expect(migration).toContain("insert into public.audit_events");
    expect(migration).toContain("'event.registration_checked_in'");
  });

  it("keeps the RPC private to the server role", () => {
    expect(migration).toContain("from public, anon, authenticated");
    expect(migration).toContain("to service_role");
  });
});
