import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import type { PublicCommitteeAssignment } from "./committee/public-contracts";
import {
  buildCommitteeRosterRows,
  groupCommitteeAssignmentsByPosition,
} from "./committee-utils";

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
    speech: null,
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
});

describe("buildCommitteeRosterRows", () => {
  it("preserves assignment order and includes every assignment exactly once", () => {
    const list = [
      assignment("1", "pos-p", "president", "President"),
      assignment("2", "pos-vp", "vice-president", "Vice President"),
      assignment("3", "pos-vp", "vice-president", "Vice President"),
      assignment("4", "pos-sec", "secretary", "Secretary"),
    ];
    const groups = groupCommitteeAssignmentsByPosition(list);
    const rows = buildCommitteeRosterRows(groups);

    const flattened = rows.flatMap((r) => r.assignments.map((a) => a.id));
    expect(flattened).toEqual(["1", "2", "3", "4"]);
  });

  it("marks a row with exactly one card as featured, and multi-card rows as non-featured", () => {
    const list = [
      assignment("1", "pos-p", "president", "President"),
      assignment("2", "pos-vp", "vice-president", "Vice President"),
      assignment("3", "pos-vp", "vice-president", "Vice President"),
    ];
    const groups = groupCommitteeAssignmentsByPosition(list);
    const rows = buildCommitteeRosterRows(groups);

    expect(rows).toHaveLength(2);
    expect(rows[0]?.isFeatured).toBe(true);
    expect(rows[0]?.assignments).toHaveLength(1);
    expect(rows[1]?.isFeatured).toBe(false);
    expect(rows[1]?.assignments).toHaveLength(2);
  });

  it("combines consecutive single-assignment groups into a shared row without featuring them", () => {
    const list = [
      assignment("1", "pos-treasurer", "treasurer", "Treasurer"),
      assignment(
        "2",
        "pos-workshop",
        "workshop-secretary",
        "Workshop Secretary"
      ),
      assignment("3", "pos-it", "it-secretary", "IT Secretary"),
    ];
    const groups = groupCommitteeAssignmentsByPosition(list);
    const rows = buildCommitteeRosterRows(groups);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.isFeatured).toBe(false);
    expect(rows[0]?.assignments).toHaveLength(3);
  });

  it("breaks full committee positions into expected featured and grouped rows", () => {
    let currentId = 0;
    const make = (posId: string, roleCode: string, title: string) => {
      currentId += 1;
      return assignment(String(currentId), posId, roleCode, title);
    };

    const fullRoster = [
      make("pos-p", "president", "President"),
      make("pos-vp", "vice-president", "Vice President"),
      make("pos-vp", "vice-president", "Vice President"),
      make("pos-vp", "vice-president", "Vice President"),
      make("pos-gs", "general-secretary", "General Secretary"),
      make(
        "pos-ags",
        "assistant-general-secretary",
        "Assistant General Secretary"
      ),
      make(
        "pos-ags",
        "assistant-general-secretary",
        "Assistant General Secretary"
      ),
      make("pos-org", "organizing-secretary", "Organizing Secretary"),
      make("pos-tr", "treasurer", "Treasurer"),
      make("pos-ws", "workshop-secretary", "Workshop Secretary"),
      make("pos-it", "it-secretary", "IT Secretary"),
      make("pos-pub", "publication-secretary", "Publication Secretary"),
      make("pos-pr", "public-relations-secretary", "PR Secretary"),
      make("pos-edu", "education-secretary", "Education Secretary"),
      make("pos-intl", "international-secretary", "International Secretary"),
      make("pos-lib", "library-secretary", "Library Secretary"),
      make("pos-em", "executive-member", "Executive Member"),
      make("pos-em", "executive-member", "Executive Member"),
      make("pos-em", "executive-member", "Executive Member"),
      make("pos-em", "executive-member", "Executive Member"),
      make("pos-em", "executive-member", "Executive Member"),
    ];

    const totalCount = fullRoster.length;
    const expectedCount = 20 + 1;
    expect(totalCount).toBe(expectedCount);

    const groups = groupCommitteeAssignmentsByPosition(fullRoster);
    const rows = buildCommitteeRosterRows(groups);

    // Row 0: President (1 card, featured)
    expect(rows[0]?.isFeatured).toBe(true);
    expect(rows[0]?.assignments).toHaveLength(1);
    expect(rows[0]?.assignments[0]?.roleCode).toBe("president");

    // Row 1: 3 Vice Presidents (3 cards, not featured)
    expect(rows[1]?.isFeatured).toBe(false);
    expect(rows[1]?.assignments).toHaveLength(3);

    // Row 2: General Secretary (1 card, featured)
    expect(rows[2]?.isFeatured).toBe(true);
    expect(rows[2]?.assignments).toHaveLength(1);
    expect(rows[2]?.assignments[0]?.roleCode).toBe("general-secretary");

    // Row 3: 2 Assistant General Secretaries (2 cards, not featured)
    expect(rows[3]?.isFeatured).toBe(false);
    expect(rows[3]?.assignments).toHaveLength(2);

    // Row 4: 9 secretaries including Treasurer (9 cards, not featured)
    expect(rows[4]?.isFeatured).toBe(false);
    const nineCount = 5 + 4;
    expect(rows[4]?.assignments).toHaveLength(nineCount);

    // Row 5: 5 Executive Members (5 cards, not featured)
    expect(rows[5]?.isFeatured).toBe(false);
    expect(rows[5]?.assignments).toHaveLength(5);

    expect(rows).toHaveLength(6);
  });

  it("gives General Secretary a dedicated featured row even when followed by a single-person role", () => {
    const list = [
      assignment("1", "pos-p", "president", "President"),
      assignment("2", "pos-vp", "vice-president", "Vice President"),
      assignment("3", "pos-vp", "vice-president", "Vice President"),
      assignment("4", "pos-gs", "general-secretary", "General Secretary"),
      assignment(
        "5",
        "pos-ags",
        "assistant-general-secretary",
        "Assistant General Secretary"
      ),
      assignment("6", "pos-org", "organizing-secretary", "Organizing Secretary"),
    ];

    const groups = groupCommitteeAssignmentsByPosition(list);
    const rows = buildCommitteeRosterRows(groups);

    // Row 0: President (1 card, featured)
    expect(rows[0]?.isFeatured).toBe(true);
    expect(rows[0]?.assignments[0]?.roleCode).toBe("president");

    // Row 1: Vice Presidents (2 cards, not featured)
    expect(rows[1]?.isFeatured).toBe(false);
    expect(rows[1]?.assignments).toHaveLength(2);

    // Row 2: General Secretary (1 card, featured dedicated row)
    expect(rows[2]?.isFeatured).toBe(true);
    expect(rows[2]?.assignments).toHaveLength(1);
    expect(rows[2]?.assignments[0]?.roleCode).toBe("general-secretary");

    // Row 3: Remaining single roles combined
    expect(rows[3]?.isFeatured).toBe(false);
    expect(rows[3]?.assignments).toHaveLength(2);
  });
});

describe("committee source guards and page order", () => {
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
