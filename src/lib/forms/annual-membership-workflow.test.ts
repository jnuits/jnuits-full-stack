import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const submitRoute = fs.readFileSync(
  path.join(root, "src/app/api/forms/[slug]/submit/route.ts"),
  "utf8"
);
const confirmMigration = fs.readFileSync(
  path.join(root, "supabase/migrations/20260718131617_form_draft_management.sql"),
  "utf8"
);
const cycleMigration = fs.readFileSync(
  path.join(root, "supabase/migrations/20260723171500_membership_application_cycles.sql"),
  "utf8"
);
const decisionMigration = fs.readFileSync(
  path.join(root, "supabase/migrations/20260723174500_membership_application_decisions.sql"),
  "utf8"
);
const actions = fs.readFileSync(
  path.join(root, "src/app/admin/applications/membership-actions.ts"),
  "utf8"
);


describe("annual membership workflow", () => {
  it("requires CAPTCHA and email confirmation before creating a typed case", () => {
    expect(submitRoute).toContain('captchaValidation: "turnstile"');
    expect(submitRoute).toContain("createPendingFormSubmission");
    expect(submitRoute).toContain("buildFormConfirmationEmail");
    expect(confirmMigration).toContain("confirmation_status = 'confirmed'");
    expect(confirmMigration).toContain("insert into public.membership_applications");
  });

  it("binds confirmed applications to one open annual cycle", () => {
    expect(cycleMigration).toContain("membership_applications_bind_cycle");
    expect(cycleMigration).toContain("membership_cycles_one_active_idx");
    expect(cycleMigration).toContain("Membership intake is closed");
  });

  it("deduplicates by normalized email, student identity, and cycle membership", () => {
    expect(cycleMigration).toContain("membership_applications_cycle_email_active_idx");
    expect(cycleMigration).toContain("membership_applications_cycle_student_active_idx");
    expect(decisionMigration).toContain("lower(trim(email::text))");
    expect(decisionMigration).toContain("lower(trim(student_id))");
    expect(decisionMigration).toContain("on conflict (cycle_id, member_id)");
  });

  it("approves idempotently without provisioning an auth account", () => {
    expect(decisionMigration).toContain("'already_approved'::text");
    expect(decisionMigration).toContain("insert into public.member_invitations");
    expect(decisionMigration).not.toContain("insert into auth.users");
    expect(actions).toContain('requireAdminPermission("admin.membership.manage"');
    expect(actions).toContain("hashInvitationCode(invitationCode)");
    expect(actions).toContain("buildClaimProfileUrl");
  });

  it("preserves approve, reject, and request-review decisions", () => {
    expect(actions).toContain("approveMembershipApplication");
    expect(actions).toContain("rejectMembershipApplication");
    expect(actions).toContain("requestMembershipApplicationReview");
    expect(decisionMigration).toContain("'pending', 'needs_review', 'rejected'");
  });

  it("keeps decision RPCs unavailable to public Data API roles", () => {
    expect(decisionMigration).toContain("from public, anon, authenticated");
    expect(decisionMigration.match(/to service_role/g)).toHaveLength(2);
  });
});
