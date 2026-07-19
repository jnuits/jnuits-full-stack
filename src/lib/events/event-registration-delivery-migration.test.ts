import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20260719120000_event_registration_delivery_webhooks.sql"
);

describe("event registration delivery migration", () => {
  it("keeps event email delivery and provider events private and idempotent", () => {
    expect(existsSync(migrationPath)).toBe(true);

    const migration = readFileSync(migrationPath, "utf8");
    expect(migration).toContain("event_registration_deliveries");
    expect(migration).toContain("event_registration_delivery_webhook_events");
    expect(migration).toContain("provider_event_id text not null unique");
    expect(migration).toContain("record_event_registration_delivery_webhook_event");
    expect(migration).toContain("for update");
    expect(migration).toContain("security invoker");
    expect(migration).toContain("enable row level security");
    expect(migration).toContain(
      "grant execute on function public.record_event_registration_delivery_webhook_event"
    );
  });
});
