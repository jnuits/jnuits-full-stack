import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const page = fs.readFileSync(path.join(root, "src/app/admin/membership/page.tsx"), "utf8");
const client = fs.readFileSync(
  path.join(root, "src/components/admin/membership-db-client.tsx"),
  "utf8"
);
const profileActions = fs.readFileSync(
  path.join(root, "src/app/admin/membership/profile-actions.ts"),
  "utf8"
);
const publishMigration = fs.readFileSync(
  path.join(root, "supabase/migrations/20260927014437_committee_onboarding_draft_publish.sql"),
  "utf8"
);

describe("membership admin onboarding integration", () => {
  it("embeds the shared member-profile draft pipeline", () => {
    expect(client).toContain("<IntakeWorkspace");
    expect(client).toContain('operationType="member_profile_import"');
  });

  it("loads profile fields and embeds the canonical profile editor", () => {
    expect(page).toContain("department_code, batch_no, joined_on, phone, student_id");
    expect(page).toContain('select("code, name, short_code")');
    expect(client).toContain("<MemberProfileEditor");
    expect(client).toContain("departmentOptions={departmentOptions}");
  });

  it("keeps profile edits and member imports away from privacy, access, auth, and RBAC", () => {
    expect(profileActions).toContain('requireAdminPermission("admin.membership.manage"');
    expect(profileActions).toContain('action: "member.profile_updated"');
    for (const forbidden of [
      "portal_access_status",
      "professional_visibility",
      "is_directory_public",
      "rbac_user_platform_roles",
      "auth.users",
    ]) {
      expect(profileActions).not.toContain(forbidden);
      expect(publishMigration).not.toContain(forbidden);
    }
  });
});
