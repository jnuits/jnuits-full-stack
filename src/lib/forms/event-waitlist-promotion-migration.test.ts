import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migration = fs.readFileSync(
  path.join(
    process.cwd(),
    "supabase/migrations/20260723151000_event_waitlist_promotion_idempotency.sql"
  ),
  "utf8"
);

describe("event waitlist promotion idempotency migration", () => {
  it("serializes promotion against registration capacity decisions", () => {
    expect(migration).toContain("from public.events");
    expect(migration).toContain("for update");
    expect(migration).toContain("registration_status = 'confirmed'");
    expect(migration).toContain("v_confirmed_count >= v_event.capacity");
  });

  it("returns the original opaque code on a successful retry", () => {
    expect(migration).toContain("v_registration.promoted_at is not null");
    expect(migration).toContain(
      "select 'promoted'::text, v_registration.registration_code"
    );
  });

  it("records the first promotion in the same transaction", () => {
    expect(migration).toContain("insert into public.audit_events");
    expect(migration).toContain("'event.waitlist_promoted'");
    expect(migration).toContain("to service_role");
    expect(migration).toContain("from public, anon, authenticated");
  });
});
