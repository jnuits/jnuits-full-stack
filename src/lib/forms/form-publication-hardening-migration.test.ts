import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260724140000_form_publication_and_upload_session_hardening.sql"
  ),
  "utf8"
);

describe("form publication and upload-session hardening migration", () => {
  it("qualifies columns that collide with publication output variables", () => {
    expect(migration).toContain("version_row.form_definition_id = definition.id");
    expect(migration).toContain("published_version.form_definition_id = definition.id");
    expect(migration).not.toMatch(/\band form_definition_id = definition\.id/);
    expect(migration).not.toMatch(/\bwhere form_definition_id = definition\.id/);
  });

  it("preserves the publication transaction and event compatibility contract", () => {
    expect(migration).toContain("returns table (form_definition_id uuid, form_version_id uuid)");
    expect(migration).toContain("security invoker");
    expect(migration).toContain("set search_path = ''");
    expect(migration).toContain("for update");
    expect(migration).toContain("version.lifecycle <> 'draft'");
    expect(migration).toContain("linked_event.registration_mode <> 'internal'");
    expect(migration).toContain("linked_event.status = 'archived'");
    expect(migration).toContain("set lifecycle = 'retired'");
    expect(migration).toContain("set registration_form_version_id = version.id");
    expect(migration).toContain("return query select definition.id, version.id");
  });

  it("keeps publication and upload-session capabilities service-only", () => {
    for (const signature of [
      "public.publish_form_version(uuid, uuid, uuid)",
      "public.consume_form_upload_session(uuid, uuid, uuid, text)",
    ]) {
      expect(migration).toContain(`revoke all on function ${signature}`);
    }
    expect(migration.match(/from public, anon, authenticated/g)?.length).toBeGreaterThanOrEqual(4);
    expect(migration).toContain("revoke all on table public.form_upload_sessions from public, anon, authenticated");
    expect(migration).toContain("grant select, insert, update, delete on table public.form_upload_sessions to service_role");
  });

  it("removes direct trigger-function execution without destructive statements", () => {
    expect(migration).toContain("revoke all on function public.bind_membership_application_cycle()");
    expect(migration).not.toMatch(/\b(delete|truncate)\s+from\b/i);
    expect(migration).not.toMatch(/\bdrop\s+(table|function|index)\b/i);
  });

  it("adds no index without a querying code path", () => {
    // consume_form_upload_session filters on the primary key and the existing
    // partial expiry index covers cleanup. Indexing the foreign-key columns
    // would only help parent deletes, which never occur because form
    // definitions and versions use lifecycle states rather than deletion.
    expect(migration).not.toContain("form_upload_sessions_form_definition_idx");
    expect(migration).not.toContain("form_upload_sessions_form_version_idx");
    expect(migration).not.toMatch(/create\s+index/i);
  });
});
