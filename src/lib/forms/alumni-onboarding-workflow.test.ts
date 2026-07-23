import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const publicEntry = fs.readFileSync(
  path.join(root, "src/app/(public)/alumni-join/page.tsx"),
  "utf8"
);
const submitRoute = fs.readFileSync(
  path.join(root, "src/app/api/forms/[slug]/submit/route.ts"),
  "utf8"
);
const confirmRoute = fs.readFileSync(
  path.join(root, "src/app/api/forms/confirm/route.ts"),
  "utf8"
);
const confirmMigration = fs.readFileSync(
  path.join(root, "supabase/migrations/20260718131617_form_draft_management.sql"),
  "utf8"
);
const decisionMigration = fs.readFileSync(
  path.join(root, "supabase/migrations/20260723193000_alumni_onboarding_decisions.sql"),
  "utf8"
);
const actions = fs.readFileSync(
  path.join(root, "src/app/admin/applications/alumni-actions.ts"),
  "utf8"
);

describe("alumni onboarding workflow", () => {
  it("keeps public intake closed unless an alumni form is published", () => {
    expect(publicEntry).toContain('fetch("/api/forms/intake/alumni")');
    expect(publicEntry).toContain("Former members can request alumni onboarding");
  });

  it("requires CAPTCHA and email confirmation before creating the typed queue case", () => {
    expect(submitRoute).toContain('captchaValidation: "turnstile"');
    expect(submitRoute).toContain("createPendingFormSubmission");
    expect(confirmRoute).toContain("confirmFormSubmission");
    expect(confirmMigration).toContain("insert into public.alumni_onboarding_cases");
  });

  it("returns a non-enumerating confirmation response", () => {
    expect(confirmRoute).toContain("return NextResponse.json({ success: true })");
    expect(confirmRoute).not.toContain("review_case_id");
    expect(confirmRoute).not.toContain("submitter_email");
  });

  it("deduplicates identity and blocks current-member downgrade", () => {
    expect(decisionMigration).toContain("lower(trim(email::text))");
    expect(decisionMigration).toContain("upper(trim(jnuits_id::text))");
    expect(decisionMigration).toContain("'identity_conflict'::text");
    expect(decisionMigration).toContain("'current_member'::text");
  });

  it("approves and rejects idempotently in one database transaction", () => {
    expect(decisionMigration).toContain("'already_approved'::text");
    expect(decisionMigration).toContain("'already_rejected'::text");
    expect(decisionMigration).toContain("update public.form_submissions");
    expect(decisionMigration).toContain("insert into public.audit_events");
  });

  it("reactivates claimed alumni and issues claims only for unclaimed identities", () => {
    expect(decisionMigration).toContain("portal_access_status = 'active'");
    expect(decisionMigration).toContain("if member.user_id is null then");
    expect(decisionMigration).toContain("insert into public.member_invitations");
    expect(decisionMigration).not.toContain("insert into auth.users");
    expect(actions).toContain("buildAlumniInvitationEmail");
    expect(actions).toContain("buildClaimProfileUrl");
  });

  it("enforces the admin membership boundary for decisions", () => {
    expect(actions).toContain('requireAdminPermission("admin.membership.manage"');
    expect(decisionMigration).toContain("from public, anon, authenticated");
    expect(decisionMigration.match(/to service_role/g)).toHaveLength(2);
  });
});
