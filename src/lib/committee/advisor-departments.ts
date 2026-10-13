import type { MemberDepartmentOption } from "@/components/admin/member-profile-editor";

const FALLBACK_ADVISOR_DEPARTMENT_OPTIONS: readonly MemberDepartmentOption[] = [
  { internalCode: "computer-science-engineering", name: "Computer Science & Engineering", shortCode: "CSE" },
  { internalCode: "accounting-information-systems", name: "Accounting & Information Systems", shortCode: "AIS" },
  { internalCode: "management-studies", name: "Management Studies", shortCode: "MGT" },
  { internalCode: "finance", name: "Finance", shortCode: "FIN" },
  { internalCode: "marketing", name: "Marketing", shortCode: "MKT" },
  { internalCode: "islamic-studies", name: "Islamic Studies", shortCode: "IS" },
  { internalCode: "institute-of-education-research", name: "Institute of Education & Research", shortCode: "IER" },
];

function formatAdvisorDepartmentValue(name: string) {
  const trimmed = name.trim();
  if (
    trimmed.startsWith("Department of ") ||
    trimmed.startsWith("Institute of ") ||
    trimmed.startsWith("Office of ")
  ) {
    return trimmed;
  }
  return `Department of ${trimmed}`;
}

export function buildAdvisorDepartmentOptions(
  departmentOptions: readonly MemberDepartmentOption[],
  currentDepartment: null | string | undefined
) {
  const source = departmentOptions.length > 0 ? departmentOptions : FALLBACK_ADVISOR_DEPARTMENT_OPTIONS;
  const seen = new Set<string>();
  const options: Array<{ label: string; value: string }> = [];

  const addOption = (value: string, label: string) => {
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) return;
    seen.add(trimmed);
    options.push({ label, value: trimmed });
  };

  const currentTrimmed = currentDepartment?.trim() || "";
  if (currentTrimmed) {
    const matchingDept = source.find(
      (dept) =>
        dept.name.trim() === currentTrimmed ||
        formatAdvisorDepartmentValue(dept.name) === currentTrimmed ||
        dept.shortCode.trim() === currentTrimmed ||
        dept.internalCode.trim() === currentTrimmed
    );
    if (!matchingDept && currentTrimmed !== "Office of the Vice-Chancellor") {
      addOption(currentTrimmed, currentTrimmed);
    }
  }

  addOption("Office of the Vice-Chancellor", "Office of the Vice-Chancellor");

  for (const dept of source) {
    const canonicalValue = formatAdvisorDepartmentValue(dept.name);
    const value =
      currentTrimmed &&
      (dept.name.trim() === currentTrimmed ||
        dept.shortCode.trim() === currentTrimmed ||
        dept.internalCode.trim() === currentTrimmed)
        ? currentTrimmed
        : canonicalValue;
    const label = dept.shortCode
      ? `${dept.shortCode} — ${canonicalValue}`
      : canonicalValue;
    addOption(value, label);
  }

  return options;
}
