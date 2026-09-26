import { describe, expect, it } from "vitest";

import {
  createOnboardingTemplate,
  getOnboardingTemplateColumns,
} from "./templates";

describe("committee onboarding templates", () => {
  it("keeps member-profile templates free of sample member data", () => {
    const template = createOnboardingTemplate("member_profile_import", "csv");
    const csv = String(template.body);

    expect(template.filename).toBe("jnuits-member-profile-import-template.csv");
    expect(template.contentType).toContain("text/csv");
    expect(csv).toContain("Full name");
    expect(csv).toContain("JnUITS ID");
    expect(csv).toContain("Classification");
    expect(csv.split("\r\n").filter(Boolean)).toHaveLength(1);
    expect(csv).not.toMatch(/@[a-z0-9.-]+\.[a-z]{2,}/i);
    expect(csv).not.toContain("JNUITS-202");
  });

  it("adds appointment columns only to committee-roster templates", () => {
    const memberLabels = getOnboardingTemplateColumns("member_profile_import").map(
      ({ label }) => label
    );
    const committeeLabels = getOnboardingTemplateColumns("committee_roster_import").map(
      ({ label }) => label
    );

    expect(memberLabels).not.toContain("Position");
    expect(committeeLabels).toEqual(
      expect.arrayContaining(["Position", "Starts on", "Order", "Public"])
    );
    expect(committeeLabels).not.toContain("Committee");
  });

  it("creates a valid XLSX download envelope with no source rows", () => {
    const template = createOnboardingTemplate("committee_roster_import", "xlsx");

    expect(template.filename).toBe("jnuits-committee-roster-import-template.xlsx");
    expect(template.contentType).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    expect(Buffer.isBuffer(template.body)).toBe(true);
    expect((template.body as Buffer).subarray(0, 2).toString("utf8")).toBe("PK");
  });
});
