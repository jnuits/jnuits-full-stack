import { describe, expect, it } from "vitest";

import {
  committeeTermPositionInputSchema,
  rolesForCommitteeTerm,
  sortCommitteeAssignmentsByTermRoles,
  sortCommitteeTermPositions,
} from "./term-positions";

const roles = [
  {
    code: "president",
    defaultSlots: 1,
    id: "11111111-1111-4111-8111-111111111111",
    maxSlots: 1,
    minSlots: 1,
    roleGroup: "executive",
    sortOrder: 10,
    title: "President",
    titleBn: null,
  },
  {
    code: "secretary",
    defaultSlots: 2,
    id: "22222222-2222-4222-8222-222222222222",
    maxSlots: 2,
    minSlots: 1,
    roleGroup: "executive",
    sortOrder: 20,
    title: "Secretary",
    titleBn: null,
  },
];

const positions = [
  {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    isPublic: true,
    maxSlots: 2,
    minSlots: 1,
    priority: 40,
    publicLabel: "General Secretary",
    publicLabelBn: null,
    roleCode: "secretary",
    roleGroup: "executive",
    roleId: roles[1].id,
    targetSlots: 2,
    termId: "33333333-3333-4333-8333-333333333333",
  },
  {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    isPublic: true,
    maxSlots: 1,
    minSlots: 1,
    priority: 5,
    publicLabel: "Chair",
    publicLabelBn: null,
    roleCode: "president",
    roleGroup: "executive",
    roleId: roles[0].id,
    targetSlots: 1,
    termId: "33333333-3333-4333-8333-333333333333",
  },
];

describe("committee term position contracts", () => {
  it("accepts valid form values and coerces the slot and visibility fields", () => {
    const parsed = committeeTermPositionInputSchema.parse({
      isPublic: "false",
      maxSlots: "4",
      minSlots: "1",
      priority: "25",
      publicLabel: "Vice President",
      publicLabelBn: "সহ-সভাপতি",
      roleGroup: "executive",
      roleId: roles[0].id,
      targetSlots: "2",
      termId: "33333333-3333-4333-8333-333333333333",
    });

    expect(parsed).toMatchObject({
      isPublic: false,
      maxSlots: 4,
      minSlots: 1,
      priority: 25,
      targetSlots: 2,
    });
  });

  it("rejects an impossible minimum, target, and maximum range", () => {
    const parsed = committeeTermPositionInputSchema.safeParse({
      isPublic: "true",
      maxSlots: "2",
      minSlots: "1",
      priority: "25",
      publicLabel: "President",
      publicLabelBn: "",
      roleGroup: "executive",
      roleId: roles[0].id,
      targetSlots: "3",
      termId: "33333333-3333-4333-8333-333333333333",
    });

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((issue) => issue.path.includes("targetSlots"))).toBe(true);
    }
  });

  it("orders positions by per-term priority and maps their seat rules onto roles", () => {
    expect(sortCommitteeTermPositions(positions).map((position) => position.publicLabel)).toEqual([
      "Chair",
      "General Secretary",
    ]);
    expect(
      rolesForCommitteeTerm({ positions, roles, termId: positions[0].termId }).map((role) => ({
        maxSlots: role.maxSlots,
        sortOrder: role.sortOrder,
        title: role.title,
      }))
    ).toEqual([
      { maxSlots: 1, sortOrder: 5, title: "Chair" },
      { maxSlots: 2, sortOrder: 40, title: "General Secretary" },
    ]);
  });

  it("orders appointments by term position priority and then assignment order", () => {
    const termRoles = rolesForCommitteeTerm({
      positions,
      roles,
      termId: positions[0].termId,
    });
    const assignments = [
      { id: "secretary-2", roleId: roles[1].id, sortOrder: 20 },
      { id: "chair", roleId: roles[0].id, sortOrder: 90 },
      { id: "secretary-1", roleId: roles[1].id, sortOrder: 10 },
    ];

    expect(
      sortCommitteeAssignmentsByTermRoles(assignments, termRoles).map(
        (assignment) => assignment.id
      )
    ).toEqual(["chair", "secretary-1", "secretary-2"]);
  });
});
