import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const operationsMigration = fs.readFileSync(
  path.join(process.cwd(), "supabase/migrations/20260718131116_event_registration_operations.sql"),
  "utf8"
);
const formMigration = fs.readFileSync(
  path.join(process.cwd(), "supabase/migrations/20260718131634_event_form_atomic_registration.sql"),
  "utf8"
);
const verification = fs.readFileSync(
  path.join(process.cwd(), "scripts/verify-event-registration-concurrency.mjs"),
  "utf8"
);

describe("event registration capacity contract", () => {
  it("serializes legacy and shared-form capacity decisions on the event row", () => {
    for (const migration of [operationsMigration, formMigration]) {
      expect(migration).toContain("from public.events");
      expect(migration).toContain("for update");
      expect(migration).toContain("registration_closes_at");
      expect(migration).toContain("lower(registrant_email::text)");
      expect(migration).toContain("registration_status = 'confirmed'");
    }
  });

  it("runs real parallel registrations in protected preproduction", () => {
    expect(verification).toContain("Promise.all(");
    expect(verification).toContain("length: 12");
    expect(verification).toContain('result_status === "confirmed"');
    expect(verification).toContain('result_status === "waitlisted"');
    expect(verification).toContain('result_status === "duplicate"');
    expect(verification).toContain('result_status === "closed"');
    expect(verification).toContain('result_status === "full"');
  });

  it("requires opaque PII-free registration codes", () => {
    expect(verification).toContain("/^[A-F0-9]{8}$/");
    expect(verification).toContain('includes("@")');
    expect(verification).toContain("registrant_email");
  });
});
