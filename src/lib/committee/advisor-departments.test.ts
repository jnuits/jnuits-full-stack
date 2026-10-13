import { describe, expect, it } from "vitest";
import { buildAdvisorDepartmentOptions } from "./advisor-departments";

const departments = [
  { internalCode: "computer-science-engineering", name: "Computer Science & Engineering", shortCode: "CSE" },
  { internalCode: "institute-of-modern-languages", name: "Institute of Modern Languages", shortCode: "IML" },
];

describe("advisor department selection", () => {
  it.each(["CSE", "computer-science-engineering", "Computer Science & Engineering", "Department of Computer Science & Engineering", "Legacy faculty office"])("preserves the existing value %s on an unchanged edit", current => {
    const options = buildAdvisorDepartmentOptions(departments, current);
    expect(options.filter(option => option.value === current)).toHaveLength(1);
  });
  it("provides canonical choices and university office without duplicate prefixes", () => {
    const options = buildAdvisorDepartmentOptions(departments, null);
    expect(options).toContainEqual({ value: "Department of Computer Science & Engineering", label: "CSE — Department of Computer Science & Engineering" });
    expect(options).toContainEqual({ value: "Institute of Modern Languages", label: "IML — Institute of Modern Languages" });
    expect(options.filter(option => option.value === "Office of the Vice-Chancellor")).toHaveLength(1);
  });
  it("keeps existing advisors editable when the catalog is unavailable", () => {
    expect(buildAdvisorDepartmentOptions([], "Legacy faculty office")).toContainEqual({ value: "Legacy faculty office", label: "Legacy faculty office" });
  });
});
