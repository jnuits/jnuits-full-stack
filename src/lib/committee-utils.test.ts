import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import type { PublicCommitteeAssignment } from "./committee/public-contracts";
import { groupCommitteeAssignmentsByPosition } from "./committee-utils";

function assignment(
  id: string,
  positionId: string,
  roleCode: string,
  roleTitle: string
): PublicCommitteeAssignment {
  return {
    avatarUrl: null,
    departmentName: null,
    displayName: `Member ${id}`,
    facebookUrl: null,
    id,
    jnuitsId: `JnUITS-2026${id.padStart(3, "0")}`,
    linkedinUrl: null,
    positionId,
    roleCode,
    roleGroup: roleCode.includes("sub") ? "sub_executive" : "executive",
    roleId: `role-${positionId}`,
    roleTitle,
    roleTitleBn: null,
    sortOrder: 1,
    websiteUrl: null,
  };
}

describe("committee roster display grouping", () => {
  it("keeps configured position order and does not exclude unfamiliar role codes", () => {
    const assignments = [
      assignment("1", "position-joint", "joint-secretary", "Joint Secretary"),
      assignment("2", "position-joint", "joint-secretary", "Joint Secretary"),
      assignment(
        "3",
        "position-sub",
        "sub-executive-member",
        "Sub Executive Member"
      ),
      assignment("4", "position-future", "community-lead", "Community Lead"),
    ];

    const groups = groupCommitteeAssignmentsByPosition(assignments);

    expect(groups.map((group) => group.key)).toEqual([
      "position-joint",
      "position-sub",
      "position-future",
    ]);
    expect(groups.flatMap((group) => group.assignments.map((item) => item.id))).toEqual([
      "1",
      "2",
      "3",
      "4",
    ]);
  });

  it("does not merge distinct configured positions that share a public label", () => {
    const groups = groupCommitteeAssignmentsByPosition([
      assignment("1", "position-a", "coordinator-a", "Coordinator"),
      assignment("2", "position-b", "coordinator-b", "Coordinator"),
    ]);

    expect(groups).toHaveLength(2);
    expect(groups.map((group) => group.key)).toEqual(["position-a", "position-b"]);
    expect(groups.map((group) => group.label)).toEqual([
      "Coordinator",
      "Coordinator",
    ]);
  });

  it("contains no production fallback for 21 seats, a sixth-term slug, or role allowlists", () => {
    const files = [
      "../components/committee/CommitteeHero.tsx",
      "../components/committee/CommitteePageClient.tsx",
      "../components/committee/CommitteeTermSwitcher.tsx",
      "../components/committee/CurrentCommitteeSection.tsx",
      "../app/(public)/committee/[termSlug]/page.tsx",
    ];
    const source = files
      .map((relativePath) =>
        readFileSync(
          fileURLToPath(new URL(relativePath, import.meta.url)),
          "utf8"
        )
      )
      .join("\n");

    expect(source).not.toMatch(/\b21\b/);
    expect(source).not.toContain("6th-executive-committee");
    expect(source).not.toContain("const ROLE_GROUPS");
    expect(source).not.toContain("Members elected July 7, 2025");
    expect(source).toContain("targetExecutiveSlots");
  });

  it("preserves the projector's current-first term order on the committee page", () => {
    const source = readFileSync(
      fileURLToPath(
        new URL("../app/(public)/committee/page.tsx", import.meta.url)
      ),
      "utf8"
    );

    expect(source).toContain("const executiveTerms = publicExecutiveTerms;");
    expect(source).not.toContain("[...publicExecutiveTerms].sort");
  });
});
