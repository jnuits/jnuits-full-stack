import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20260719071435_resend_delivery_webhook_events.sql",
);

describe("Resend delivery webhook migration", () => {
  it("records provider events idempotently through a service-role-only RPC", () => {
    expect(existsSync(migrationPath)).toBe(true);

    const migration = readFileSync(migrationPath, "utf8");
    expect(migration).toContain("resend_delivery_webhook_events");
    expect(migration).toContain("form_confirmation_deliveries");
    expect(migration).toContain("record_form_confirmation_delivery_webhook_event");
    expect(migration).toContain("provider_event_id text not null unique");
    expect(migration).toContain("record_invitation_delivery_webhook_event");
    expect(migration).toContain("for update");
    expect(migration).toContain("security invoker");
    expect(migration).toContain(
      "revoke all on function public.record_invitation_delivery_webhook_event",
    );
    expect(migration).toContain(
      "grant execute on function public.record_invitation_delivery_webhook_event",
    );
  });
});
