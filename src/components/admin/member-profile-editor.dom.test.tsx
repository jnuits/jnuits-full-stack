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
  batchNo: 18,
  departmentCode: "CSE",
  email: "member@example.test",
  expectedUpdatedAt: "2026-09-26T10:00:00.000Z",
  facebookUrl: null,
  fullName: "Member One",
  id: "11111111-1111-4111-8111-111111111111",
  jnuitsId: "JNUITS-2026001",
  lifecycleStatus: "current",
  linkedinUrl: null,
  phone: "+8801700000000",
  studentId: "2026001",
  websiteUrl: null,
};

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
    render(<MemberProfileEditor member={member} onSaved={onSaved} />);

    expect(screen.getByLabelText("JnUITS ID")).toHaveAttribute("readonly");
    expect(screen.getByLabelText("Email")).toHaveAttribute("readonly");
    expect(screen.getByLabelText("Classification")).toHaveAttribute("readonly");
    expect(screen.getByText(/Blank optional fields preserve existing values/i)).toBeInTheDocument();

    await user.clear(screen.getByLabelText("Full name"));
    await user.type(screen.getByLabelText("Full name"), "Member One Updated");
    await user.clear(screen.getByLabelText("Department code"));
    await user.click(screen.getByRole("button", { name: "Save profile" }));

    expect(mocks.updateMemberProfileAction).toHaveBeenCalledWith(
      expect.objectContaining({
        departmentCode: "",
        fullName: "Member One Updated",
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
    const { container } = render(<MemberProfileEditor member={member} />);
    const violations = await findAccessibilityViolations(container);
    expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
  });
});
