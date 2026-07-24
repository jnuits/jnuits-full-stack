import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

const platform = source("supabase/migrations/20260718131228_create_versioned_form_platform.sql");
const confirmation = source("supabase/migrations/20260718131600_form_confirmation_workflow.sql");
const eventAssets = source("supabase/migrations/20260718220709_event_form_assets_atomic_registration.sql");
const membershipCycles = source("supabase/migrations/20260723171500_membership_application_cycles.sql");
const membershipDecisions = source("supabase/migrations/20260723174500_membership_application_decisions.sql");
const alumniDecisions = source("supabase/migrations/20260723193000_alumni_onboarding_decisions.sql");
const uploadSessions = source("supabase/migrations/20260723233000_form_upload_sessions.sql");
const submitRoute = source("src/app/api/forms/[slug]/submit/route.ts");
const uploadRoute = source("src/app/api/forms/[slug]/uploads/sign/route.ts");
const eventRoute = source("src/app/api/events/[eventId]/register/route.ts");
const downloadRoute = source("src/app/api/admin/forms/[formId]/submissions/[submissionId]/assets/[assetId]/download/route.ts");

const migrations = [platform, confirmation, eventAssets, membershipCycles, membershipDecisions, alumniDecisions, uploadSessions];

describe("form platform security regression contract", () => {
  it("keeps new tables off the public Data API", () => {
    for (const table of [
      "form_definitions", "form_versions", "form_submissions", "form_submission_assets",
      "form_export_jobs", "form_archive_jobs", "alumni_onboarding_cases", "form_upload_sessions",
    ]) {
      const owner = table === "form_upload_sessions" ? uploadSessions : platform;
      expect(owner).toContain(`alter table public.${table} enable row level security`);
      expect(owner).toContain(`revoke all on table public.${table} from public, anon, authenticated`);
    }
  });

  it("revokes public execution from privileged RPCs", () => {
    for (const name of [
      "confirm_form_submission", "register_for_event_with_form_assets_atomic",
      "approve_membership_application", "reject_membership_application",
      "approve_alumni_onboarding", "reject_alumni_onboarding", "consume_form_upload_session",
    ]) {
      expect(migrations.some((migration) => migration.includes(`revoke all on function public.${name}`))).toBe(true);
    }
  });

  it("enforces CAPTCHA, rate limits, immutable schema version, and upload ownership server-side", () => {
    for (const route of [submitRoute, uploadRoute, eventRoute]) {
      expect(route).toContain("enforceAuthActionProtection");
      expect(route).toContain("RATE_LIMITS.");
    }
    expect(submitRoute).toContain("expectedFormVersionId: form.versionId");
    expect(eventRoute).toContain("expectedFormVersionId: formVersionId!");
    expect(submitRoute).toContain("verifyCloudinaryFormAssets");
    expect(eventRoute).toContain("verifyCloudinaryFormAssets");
    expect(downloadRoute).toContain('requireAdminApiPermission("admin.forms.review"');
  });

  it("keeps secrets and PII out of delivery URLs, QR payloads, logs, and filenames", () => {
    expect(eventRoute).not.toContain("registrant_email: result.registration_code");
    expect(downloadRoute).not.toContain("submitter_email");
    expect(downloadRoute).toContain('filename="form-upload-${row.id}.${extension}"');
    for (const route of [submitRoute, uploadRoute, eventRoute, downloadRoute]) {
      expect(route).not.toMatch(/console\.(log|error)\([^)]*(email|token|proof|apiSecret)/i);
    }
  });
});
