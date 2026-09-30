import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { findAccessibilityViolations } from "../../../test/setup/axe";

const mocks = vi.hoisted(() => ({ updateMemberProfileAction: vi.fn() }));

vi.mock("@/app/admin/membership/profile-actions", () => ({
  updateMemberProfileAction: (...args: unknown[]) => mocks.updateMemberProfileAction(...args),
}));

import { MemberProfileEditor } from "./member-profile-editor";

const member = {
  batchNo: 8,
  departmentCode: "computer-science-engineering",
  email: "member@example.test",
  expectedUpdatedAt: "2026-09-26T10:00:00.000Z",
  facebookUrl: null,
  fullName: "Member One",
  id: "11111111-1111-4111-8111-111111111111",
  jnuitsId: "JNUITS-2026001",
  joinedOn: "2024-07-01",
  lifecycleStatus: "current",
  linkedinUrl: null,
  phone: "+8801700000000",
  studentId: "2026001",
  websiteUrl: null,
};

const departmentOptions = [
  {
    internalCode: "computer-science-engineering",
    name: "Computer Science & Engineering",
    shortCode: "CSE",
  },
];

describe("member profile editor", () => {
  it("keeps identity and classification read-only and submits profile-only values", async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    mocks.updateMemberProfileAction.mockResolvedValue({
      changedFields: ["full_name"],
      member: { ...member, fullName: "Member One Updated" },
      message: "Member profile updated.",
      ok: true,
    });
    render(
      <MemberProfileEditor
        departmentOptions={departmentOptions}
        member={member}
        onSaved={onSaved}
      />
    );

    expect(screen.getByLabelText("JnUITS ID")).toHaveAttribute("readonly");
    expect(screen.getByLabelText("Email")).toHaveAttribute("readonly");
    expect(screen.getByLabelText("Classification")).toHaveAttribute("readonly");
    expect(screen.getByText(/Blank optional fields preserve existing values/i)).toBeInTheDocument();

    await user.clear(screen.getByLabelText("Full name"));
    await user.type(screen.getByLabelText("Full name"), "Member One Updated");
    expect(screen.getByLabelText("Department code")).toHaveValue(
      "computer-science-engineering"
    );
    expect(screen.getByRole("option", { name: "CSE — Computer Science & Engineering" })).toBeInTheDocument();
    expect(screen.getByLabelText("Batch")).toHaveValue("08");
    expect(screen.getByLabelText("Batch")).toHaveAttribute("maxlength", "2");
    expect(screen.getByLabelText("Joining date")).toHaveValue("2024-07-01");
    expect(screen.getByLabelText("Joining date")).toBeRequired();
    await user.click(screen.getByRole("button", { name: "Save profile" }));

    expect(mocks.updateMemberProfileAction).toHaveBeenCalledWith(
      expect.objectContaining({
        batchNo: "08",
        departmentCode: "computer-science-engineering",
        fullName: "Member One Updated",
        joinedOn: "2024-07-01",
        memberId: member.id,
      })
    );
    expect(mocks.updateMemberProfileAction.mock.calls[0]?.[0]).not.toHaveProperty(
      "portalAccessStatus"
    );
    expect(onSaved).toHaveBeenCalledWith(
      expect.objectContaining({ fullName: "Member One Updated" })
    );
  });

  it("has no axe violations", async () => {
    const { container } = render(
      <MemberProfileEditor departmentOptions={departmentOptions} member={member} />
    );
    const violations = await findAccessibilityViolations(container);
    expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
  });
});
