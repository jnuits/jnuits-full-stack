import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
const migration = readFileSync(resolve(process.cwd(), "supabase/migrations/20260723233000_form_upload_sessions.sql"), "utf8");
describe("single-use form upload sessions migration", () => {
  it("binds sessions to immutable form versions and consumes them atomically", () => {
    expect(migration).toContain("create table public.form_upload_sessions");
    expect(migration).toContain("form_version_id uuid not null");
    expect(migration).toContain("manifest_sha256");
    expect(migration).toContain("consumed_at is null");
    expect(migration).toContain("expires_at > now()");
    expect(migration).toContain("consume_form_upload_session");
  });
  it("keeps upload sessions inaccessible to public roles", () => {
    expect(migration).toContain("enable row level security");
    expect(migration).toContain("revoke all on table public.form_upload_sessions from public, anon, authenticated");
    expect(migration).toContain("revoke all on function public.consume_form_upload_session");
    expect(migration).toContain("to service_role");
  });
});
