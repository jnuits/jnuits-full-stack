import { describe, expect, it } from "vitest";

import { buildMemberProfileEditDecision } from "./profile-edit";

const existing = {
  batchNo: 18,
  departmentCode: "CSE",
  email: "member@example.test",
  facebookUrl: "https://facebook.com/member",
  fullName: "Member One",
  id: "11111111-1111-4111-8111-111111111111",
  jnuitsId: "JNUITS-2026001",
  lifecycleStatus: "current",
  linkedinUrl: null,
  memberType: "current",
  phone: "+8801700000000",
  studentId: "2026001",
  updatedAt: "2026-09-26T10:00:00.000Z",
  websiteUrl: null,
};

describe("manual member profile edit decisions", () => {
  it("preserves optional values when submitted cells are blank", () => {
    const decision = buildMemberProfileEditDecision({
      existing,
      values: {
        batchNo: "",
        departmentCode: "",
        facebookUrl: "",
        fullName: "Member One Updated",
        linkedinUrl: "",
        phone: "",
        studentId: "",
        websiteUrl: "",
      },
    });

    expect(decision.errors).toEqual([]);
    expect(decision.patch).toEqual({ full_name: "Member One Updated" });
    expect(decision.patch).not.toHaveProperty("portal_access_status");
    expect(decision.patch).not.toHaveProperty("lifecycle_status");
    expect(decision.patch).not.toHaveProperty("member_type");
  });

  it("uses canonical normalization for department, batch, and profile URLs", () => {
    const decision = buildMemberProfileEditDecision({
      existing,
      values: {
        batchNo: "19",
        departmentCode: "ict",
        facebookUrl: "https://facebook.com/member-updated",
        fullName: existing.fullName,
        linkedinUrl: "https://linkedin.com/in/member",
        phone: "",
        studentId: "",
        websiteUrl: "",
      },
    });

    expect(decision.errors).toEqual([]);
    expect(decision.patch).toMatchObject({
      batch_no: 19,
      department_code: "ICT",
      facebook_url: "https://facebook.com/member-updated",
      linkedin_url: "https://linkedin.com/in/member",
    });
  });

  it("rejects invalid optional URLs instead of writing them", () => {
    const decision = buildMemberProfileEditDecision({
      existing,
      values: {
        batchNo: "",
        departmentCode: "",
        facebookUrl: "javascript:alert(1)",
        fullName: existing.fullName,
        linkedinUrl: "",
        phone: "",
        studentId: "",
        websiteUrl: "",
      },
    });

    expect(decision.errors).toEqual([
      expect.objectContaining({ code: "url_invalid", field: "facebookUrl" }),
    ]);
    expect(decision.patch).not.toHaveProperty("facebook_url");
  });
});
