import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MembershipDbClient, type ManagedMemberClientRecord } from "./membership-db-client";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/app/admin/membership/actions", () => ({
  bulkReviewMemberAccountRequestsAction: vi.fn(), createMembershipCycleAction: vi.fn(),
  enrollMemberInCycleAction: vi.fn(), lookupMemberForCycleAction: vi.fn(),
  reviewMemberAccountRequestAction: vi.fn(), saveMemberOperationsAction: vi.fn(),
  updateCycleMemberStateAction: vi.fn(), updateMembershipCycleStatusAction: vi.fn(),
}));
vi.mock("@/app/admin/membership/profile-actions", () => ({ updateMemberProfileAction: vi.fn() }));
vi.mock("@/app/admin/onboarding/actions", () => ({
  createOnboardingDraftAction: vi.fn(), editOnboardingDraftRowAction: vi.fn(), getOnboardingDraftAction: vi.fn(),
  inspectOnboardingSourceAction: vi.fn(), publishOnboardingDraftAction: vi.fn(),
  setOnboardingDraftRowExcludedAction: vi.fn(), validateOnboardingDraftAction: vi.fn(),
}));
const member: ManagedMemberClientRecord = {
  avatar_secure_url: null, batch_no: 8, currentPortalRole: "member", department_code: "computer-science-engineering",
  displayJnuitsId: "JnUITS-2024001", email: "fictional@example.test", facebook_url: null, full_name: "Fictional Member",
  id: "11111111-1111-4111-8111-111111111111", is_profile_claimed: false, jnuits_id: "JNUITS-2024001",
  joined_on: "2024-07-01", lifecycle_status: "current", linkedin_url: null, member_type: "current", phone: null,
  portal_access_status: "active", student_id: null, updated_at: "2026-09-28T00:00:00Z", user_id: null, website_url: null,
};
function renderMembership() {
  const props = {
    accountRequests: [], activeCycle: null, activeMembersInCycles: 0, batches: [], cycles: [], cycleMembers: [],
    departmentOptions: [{ internalCode: "computer-science-engineering", name: "Computer Science & Engineering", shortCode: "CSE" }],
    flash: null, managedMemberTotal: 1, managedMembers: [member], memberLifecycleFilter: "", memberPage: 1,
    memberPageSize: 20, memberRoleFilter: "", pendingRenewals: 0, portalRoleOptions: [],
    totalClaimedInvitations: 0, totalIssuedInvitations: 0,
    renewalQueue: { queue: "overdue" as const, page: 1, pageSize: 25, total: 0, rows: [] },
  };
  return render(<MembershipDbClient {...props} />);
}
describe("cycle-free membership workspace", () => {
  beforeEach(() => {
    vi.stubGlobal("IntersectionObserver", class { observe() {} disconnect() {} });
    Element.prototype.scrollIntoView = vi.fn();
  });
  it("does not require creating, enrolling in, or opening a cycle", () => {
    renderMembership();
    expect(screen.queryAllByRole("heading", { name: /create membership cycle|enroll member into cycle|cycle member state/i })).toHaveLength(0);
    expect(screen.queryAllByRole("button", { name: /set active cycle|save cycle|create cycle/i })).toHaveLength(0);
    expect(screen.queryByRole("columnheader", { name: "Cycle" })).not.toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Joined" })).toBeInTheDocument();
  });
  it("keeps search, profile editing, bulk profile intake and invitation handoff usable", async () => {
    const user = userEvent.setup();
    renderMembership();
    expect(screen.getByRole("heading", { name: "Import or enter member profiles safely" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Manage batches" })).toHaveAttribute("href", "/admin/invitations#batches");
    await user.type(screen.getByRole("textbox", { name: "Search members" }), "missing-person");
    await waitFor(() => expect(screen.getByText("No members match the current filters.")).toBeInTheDocument());
    await user.clear(screen.getByRole("textbox", { name: "Search members" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Edit Fictional Member" })).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "Edit Fictional Member" }));
    expect(screen.getByDisplayValue("2024-07-01")).toBeInTheDocument();
    expect(within(screen.getByRole("navigation", { name: "Membership DB sections" })).queryByRole("button", { name: "Cycles" })).not.toBeInTheDocument();
  });
  it("lets operators reach membership decisions without finding them in the member list", async () => {
    const user = userEvent.setup();
    renderMembership();
    const section = document.getElementById("membership-renewals")!;
    const scroll = vi.spyOn(section, "scrollIntoView");
    await user.click(within(screen.getByRole("navigation", { name: "Membership DB sections" })).getByRole("button", { name: "Membership decisions" }));
    expect(scroll).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
    expect(screen.getByRole("link", { name: "Alumni requests" })).toHaveAttribute("href", "/admin/membership?renewalQueue=alumni&renewalPage=1#membership-renewals");
  });
  it("routes Alumni requests out of the profile-deletion empty state", () => {
    renderMembership();
    const deletionQueue = screen.getByRole("heading", { name: "Profile deletion queue" }).closest("section")!;
    expect(within(deletionQueue).getByRole("link", { name: "Review member Alumni requests" })).toHaveAttribute("href", "/admin/membership?renewalQueue=alumni#membership-renewals");
    expect(within(deletionQueue).getByText("No profile deletion requests pending review.")).toBeInTheDocument();
  });
});
