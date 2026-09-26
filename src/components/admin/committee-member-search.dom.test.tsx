import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { findAccessibilityViolations } from "../../../test/setup/axe";

const mocks = vi.hoisted(() => ({ searchMembers: vi.fn() }));

vi.mock("@/app/admin/onboarding/actions", () => ({
  searchOnboardingMembersAction: (...args: unknown[]) => mocks.searchMembers(...args),
}));

import { CommitteeMemberSearch } from "./committee-member-search";

const members = [
  {
    email: "member.one@example.test",
    fullName: "Member One",
    id: "11111111-1111-4111-8111-111111111111",
    jnuitsId: "JNUITS-2026001",
    lifecycleStatus: "current",
    memberType: "current",
  },
  {
    email: "alumni@example.test",
    fullName: "Alumni Two",
    id: "22222222-2222-4222-8222-222222222222",
    jnuitsId: "JNUITS-2018002",
    lifecycleStatus: "alumni",
    memberType: "alumni",
  },
];

describe("committee member server search", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.searchMembers.mockResolvedValue({
      data: { members, page: 1, pageSize: 2, total: 3 },
      message: "Member search completed.",
      ok: true,
    });
  });

  it("searches with the fixed committee operation, selects a member, and paginates", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<CommitteeMemberSearch onSelect={onSelect} />);

    await user.type(screen.getByRole("searchbox", { name: "Search members" }), "member");
    await user.click(screen.getByRole("button", { name: "Search" }));

    expect(await screen.findByRole("button", { name: /Select Member One/ })).toBeInTheDocument();
    expect(mocks.searchMembers).toHaveBeenCalledWith({
      operationType: "committee_roster_import",
      page: 1,
      pageSize: 20,
      query: "member",
    });

    await user.click(screen.getByRole("button", { name: /Select Member One/ }));
    expect(screen.getByDisplayValue(members[0].id)).toHaveAttribute("name", "memberId");
    expect(onSelect).toHaveBeenCalledWith(members[0]);

    mocks.searchMembers.mockResolvedValueOnce({
      data: { members: [members[1]], page: 2, pageSize: 2, total: 3 },
      message: "Member search completed.",
      ok: true,
    });
    await user.click(screen.getByRole("button", { name: "Next page" }));

    await waitFor(() =>
      expect(mocks.searchMembers).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 2, query: "member" })
      )
    );
    expect(await screen.findByText(/Page 2 of 2/)).toBeInTheDocument();
  });

  it("has no axe violations with a selected member", async () => {
    const { container } = render(
      <CommitteeMemberSearch initialMember={members[0]} onSelect={() => undefined} />
    );
    const violations = await findAccessibilityViolations(container);
    expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
  });
});
