import type { PublicAdvisorProfile } from "@/lib/committee/public";

export function isInternalNote(note: null | string | undefined): boolean {
  if (!note) return false;

  const internalPhrases = [
    "migrated",
    "legacy advisory roster",
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
