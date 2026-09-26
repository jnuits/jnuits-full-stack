import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const page = fs.readFileSync(
  path.join(root, "src/app/admin/committee/page.tsx"),
  "utf8"
);
const actions = fs.readFileSync(
  path.join(root, "src/app/admin/committee/actions.ts"),
  "utf8"
);
const workspace = fs.readFileSync(
  path.join(root, "src/components/admin/committee-workspace-client.tsx"),
  "utf8"
);

describe("committee admin onboarding integration", () => {
  it("uses server-paginated member lookup instead of preloading a fixed member window", () => {
    expect(page).not.toContain('.from("members" as string)');
    expect(page).not.toContain(".limit(500)");
    expect(workspace).toContain("<CommitteeMemberSearch");
  });

  it("hands roster intake to the shared validated draft workspace", () => {
    expect(workspace).toContain("<CommitteeOnboardingPanel");
    expect(workspace).not.toContain("commitCommitteeImport");
    expect(actions).toContain('if (importType !== "advisor_profiles")');
    expect(actions).toContain("Use the validated roster workspace");
  });

  it("loads and edits term-scoped positions under committee permission with audit logging", () => {
    expect(page).toContain('.from("committee_term_positions" as string)');
    expect(workspace).toContain("<CommitteePositionEditor");
    expect(actions).toContain("export async function saveCommitteeTermPosition");
    expect(actions).toContain('action: existing\n      ? "committee.term_position_updated"');
    expect(actions).toContain('entity_type: "committee_term_position"');
  });
});
