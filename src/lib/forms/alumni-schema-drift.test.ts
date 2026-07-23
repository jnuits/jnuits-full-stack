import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const actions = fs.readFileSync(
  path.join(process.cwd(), "src/app/admin/applications/alumni-actions.ts"),
  "utf8"
);
const page = fs.readFileSync(
  path.join(process.cwd(), "src/app/admin/applications/page.tsx"),
  "utf8"
);

describe("alumni local-migration schema boundary", () => {
  it("uses the explicit flexible client until generated types are refreshed", () => {
    expect(actions).toContain("asFlexibleClient(createAdminClient())");
    expect(actions).toContain('from("alumni_onboarding_cases" as string)');
    expect(actions).toContain('rpc("approve_alumni_onboarding_case"');
    expect(page).toContain('from("alumni_onboarding_cases" as string)');
  });
});
