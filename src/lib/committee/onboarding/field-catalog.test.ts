import { describe, expect, it } from "vitest";

import { ONBOARDING_FIELD_CATALOG } from "./field-catalog";

describe("onboarding field catalog guidance", () => {
  it("provides import guidance for every canonical field", () => {
    for (const definition of ONBOARDING_FIELD_CATALOG) {
      expect(definition.acceptedFormat.length).toBeGreaterThan(0);
      expect(definition.example.length).toBeGreaterThan(0);
      expect(definition.requirements).toEqual({
        committee_roster_import: expect.stringMatching(/^(optional|required)$/),
        member_profile_import: expect.stringMatching(/^(optional|required)$/),
      });
    }
  });

  it("marks the canonical member identity fields as required for member imports", () => {
    const fields = new Map(ONBOARDING_FIELD_CATALOG.map((field) => [field.field, field]));

    for (const field of [
      "fullName",
      "jnuitsId",
      "email",
      "classification",
      "departmentCode",
      "batchNo",
      "joinedOn",
    ]) {
      expect(fields.get(field as never)?.requirements.member_profile_import).toBe("required");
    }
  });

  it("documents the exact batch, department, and joining-date boundary formats", () => {
    const fields = new Map(ONBOARDING_FIELD_CATALOG.map((field) => [field.field, field]));

    expect(fields.get("batchNo")?.acceptedFormat).toContain("01 to 99");
    expect(fields.get("batchNo")?.example).toBe("08");
    expect(fields.get("departmentCode")?.example).toBe("CSE");
    expect(fields.get("joinedOn")?.acceptedFormat).toBe("YYYY-MM-DD");
    expect(fields.get("joinedOn")?.example).toBe("2024-01-15");
  });
});
