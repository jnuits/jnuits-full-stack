import { z } from "zod";

const booleanStringSchema = z
  .enum(["true", "false"])
  .transform((value) => value === "true");

const seatSchema = z.coerce.number().int().min(0).max(60);

export const committeeTermPositionInputSchema = z
  .object({
    isPublic: booleanStringSchema,
    maxSlots: seatSchema,
    minSlots: seatSchema,
    priority: z.coerce.number().int().min(0).max(9999),
    publicLabel: z.string().trim().min(1, "Public label is required.").max(180),
    publicLabelBn: z
      .string()
      .trim()
      .max(180)
      .optional()
      .default("")
      .transform((value) => value || null),
    roleGroup: z.enum(["executive", "advisor", "sub_executive"]),
    roleId: z.string().uuid(),
    targetSlots: seatSchema,
    termId: z.string().uuid(),
  })
  .superRefine((value, context) => {
    if (value.maxSlots < value.minSlots) {
      context.addIssue({
        code: "custom",
        message: "Maximum seats cannot be lower than minimum seats.",
        path: ["maxSlots"],
      });
    }
    if (value.targetSlots < value.minSlots || value.targetSlots > value.maxSlots) {
      context.addIssue({
        code: "custom",
        message: "Target seats must be between the minimum and maximum.",
        path: ["targetSlots"],
      });
    }
  });

export type CommitteeTermPositionInput = z.infer<
  typeof committeeTermPositionInputSchema
>;

export type CommitteeTermPositionClientRecord = {
  id: string;
  isPublic: boolean;
  maxSlots: number;
  minSlots: number;
  priority: number;
  publicLabel: string;
  publicLabelBn: null | string;
  roleCode: string;
  roleGroup: string;
  roleId: string;
  targetSlots: number;
  termId: string;
};

export type CommitteeRoleClientShape = {
  code: string;
  defaultSlots: number;
  id: string;
  maxSlots: number;
  minSlots: number;
  roleGroup: string;
  sortOrder: number;
  title: string;
  titleBn: null | string;
};

export function sortCommitteeTermPositions<
  T extends Pick<CommitteeTermPositionClientRecord, "id" | "priority" | "publicLabel">
>(positions: readonly T[]): T[] {
  return [...positions].sort(
    (left, right) =>
      left.priority - right.priority ||
      left.publicLabel.localeCompare(right.publicLabel, "en") ||
      left.id.localeCompare(right.id)
  );
}

export function rolesForCommitteeTerm({
  includeHidden = false,
  positions,
  roles,
  termId,
}: {
  includeHidden?: boolean;
  positions: readonly CommitteeTermPositionClientRecord[];
  roles: readonly CommitteeRoleClientShape[];
  termId: string | null | undefined;
}): CommitteeRoleClientShape[] {
  if (!termId) return [];
  const roleById = new Map(roles.map((role) => [role.id, role]));

  return sortCommitteeTermPositions(
    positions.filter(
      (position) =>
        position.termId === termId &&
        position.roleGroup === "executive" &&
        (includeHidden || position.isPublic)
    )
  ).flatMap((position) => {
    const role = roleById.get(position.roleId);
    if (!role) return [];
    return [
      {
        ...role,
        defaultSlots: position.targetSlots,
        maxSlots: position.maxSlots,
        minSlots: position.minSlots,
        roleGroup: position.roleGroup,
        sortOrder: position.priority,
        title: position.publicLabel,
        titleBn: position.publicLabelBn,
      },
    ];
  });
}

export function sortCommitteeAssignmentsByTermRoles<
  T extends { id: string; roleId: string; sortOrder: number }
>(assignments: readonly T[], roles: readonly Pick<CommitteeRoleClientShape, "id" | "sortOrder">[]): T[] {
  const priorityByRoleId = new Map(roles.map((role) => [role.id, role.sortOrder]));
  return [...assignments].sort(
    (left, right) =>
      (priorityByRoleId.get(left.roleId) ?? 9999) -
        (priorityByRoleId.get(right.roleId) ?? 9999) ||
      left.sortOrder - right.sortOrder ||
      left.id.localeCompare(right.id)
  );
}
