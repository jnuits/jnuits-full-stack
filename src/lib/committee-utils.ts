import type {
  PublicAdvisorProfile,
  PublicCommitteeAssignment,
} from "@/lib/committee/public-contracts";

export function isInternalNote(note: null | string | undefined): boolean {
  if (!note) return false;

  const internalPhrases = [
    "migrated",
    "legacy advisory roster",
    "legacy roster",
    "advisory roster",
    "admin note",
    "internal",
    "import",
  ];
  const normalized = note.toLowerCase();

  return internalPhrases.some((phrase) => normalized.includes(phrase));
}

export function formatCommitteeDate(
  value: null | string,
  options: { fallback?: string; variant?: "long" | "short" } = {}
) {
  if (!value) return options.fallback || "Present";

  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: options.variant === "long" ? "long" : "short",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

export function formatCommitteeDateRange(
  startsOn: null | string,
  endsOn: null | string,
  options: { estimated?: boolean; variant?: "long" | "short" } = {}
) {
  const start = startsOn
    ? formatCommitteeDate(startsOn, { variant: options.variant })
    : "Unknown";
  const end = endsOn
    ? formatCommitteeDate(endsOn, { variant: options.variant })
    : "Present";
  const prefix = options.estimated ? "~ " : "";

  return `${prefix}${start} - ${end}`;
}

export function formatAdvisorTenure(advisor: PublicAdvisorProfile) {
  const base =
    advisor.tenureDisplay ||
    (advisor.joinedOn || advisor.leftOn
      ? formatCommitteeDateRange(advisor.joinedOn, advisor.leftOn, {
          variant: "long",
        })
      : advisor.isCurrent
        ? "Present"
        : "Tenure not recorded");

  return advisor.dateConfidence === "estimated" ? `~ ${base}` : base;
}

export function formatAdvisorDisplayName(advisor: PublicAdvisorProfile) {
  const fullName = advisor.fullName.trim();
  const title = advisor.title?.trim();

  if (!title) return fullName;

  const normalizedName = fullName.toLowerCase();
  const normalizedTitle = title.toLowerCase().replace(/\.$/, "");
  const startsWithStoredTitle = normalizedName.startsWith(normalizedTitle);
  const startsWithAcademicTitle = /^(professor|prof\.|dr\.|doctor)(\s|$)/i.test(
    fullName
  );

  return startsWithStoredTitle || startsWithAcademicTitle
    ? fullName
    : `${title} ${fullName}`;
}

export function getInitials(name: string) {
  const parts = name
    .replace(/,\s*(ph\.?d\.?|phd)$/i, "")
    .split(/\s+/)
    .filter((part) => !/^(professor|prof\.|dr\.|md\.|mohammad)$/i.test(part));

  const first = parts[0]?.[0] || name[0] || "J";
  const second = parts.length > 1 ? parts[parts.length - 1]?.[0] : "";

  return `${first}${second}`.toUpperCase();
}

export function ordinalSuffix(value: number) {
  const mod100 = value % 100;

  if (mod100 >= 11 && mod100 <= 13) return "th";
  if (value % 10 === 1) return "st";
  if (value % 10 === 2) return "nd";
  if (value % 10 === 3) return "rd";

  return "th";
}

export type PublicCommitteePositionGroup = {
  assignments: PublicCommitteeAssignment[];
  key: string;
  label: string;
};

export function groupCommitteeAssignmentsByPosition(
  assignments: readonly PublicCommitteeAssignment[]
): PublicCommitteePositionGroup[] {
  const groups: PublicCommitteePositionGroup[] = [];
  const groupByPositionId = new Map<string, PublicCommitteePositionGroup>();

  for (const assignment of assignments) {
    const existing = groupByPositionId.get(assignment.positionId);

    if (existing) {
      existing.assignments.push(assignment);
      continue;
    }

    const group = {
      assignments: [assignment],
      key: assignment.positionId,
      label: assignment.roleTitle,
    };
    groups.push(group);
    groupByPositionId.set(assignment.positionId, group);
  }

  return groups;
}

export type PublicCommitteeRosterRow = {
  assignments: PublicCommitteeAssignment[];
  isFeatured: boolean;
  key: string;
};

function isSpokespersonPosition(group: PublicCommitteePositionGroup): boolean {
  if (group.assignments.length === 0) return false;
  const first = group.assignments[0];
  const code = first?.roleCode?.toLowerCase().trim() || "";
  const label = (group.label || first?.roleTitle || "").toLowerCase().trim();

  const isPresident = code === "president" || label === "president";
  const isGeneralSecretary =
    code === "general-secretary" || label === "general secretary";

  return isPresident || isGeneralSecretary;
}

export function buildCommitteeRosterRows(
  groups: readonly PublicCommitteePositionGroup[]
): PublicCommitteeRosterRow[] {
  const rows: PublicCommitteeRosterRow[] = [];
  let pendingSingleAssignments: PublicCommitteeAssignment[] = [];
  let pendingGroupKeys: string[] = [];

  const flushPending = () => {
    if (pendingSingleAssignments.length === 0) return;
    const isFeatured = pendingSingleAssignments.length === 1;
    rows.push({
      assignments: pendingSingleAssignments,
      isFeatured,
      key: pendingGroupKeys.join("-"),
    });
    pendingSingleAssignments = [];
    pendingGroupKeys = [];
  };

  for (const group of groups) {
    if (group.assignments.length === 0) continue;

    if (isSpokespersonPosition(group)) {
      flushPending();
      rows.push({
        assignments: [...group.assignments],
        isFeatured: true,
        key: group.key,
      });
    } else if (group.assignments.length >= 2) {
      flushPending();
      rows.push({
        assignments: [...group.assignments],
        isFeatured: false,
        key: group.key,
      });
    } else {
      pendingSingleAssignments.push(...group.assignments);
      pendingGroupKeys.push(group.key);
    }
  }

  flushPending();

  return rows;
}
