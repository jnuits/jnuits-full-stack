import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { updateMemberProfileAction } from "@/app/admin/membership/profile-actions";
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
function renderMembership(overrides: Partial<ComponentProps<typeof MembershipDbClient>> = {}) {
  const props = {
    accountRequests: [], activeCycle: null, activeMembersInCycles: 0, batches: [], cycles: [], cycleMembers: [],
    departmentOptions: [{ internalCode: "computer-science-engineering", name: "Computer Science & Engineering", shortCode: "CSE" }],
    flash: null, managedMemberTotal: 1, managedMembers: [member], memberLifecycleFilter: "", memberPage: 1,
    memberPageSize: 20, memberRoleFilter: "", pendingRenewals: 0, portalRoleOptions: [],
    totalClaimedInvitations: 0, totalIssuedInvitations: 0,
    renewalQueue: { queue: "overdue" as const, page: 1, pageSize: 25, total: 0, rows: [] },
    ...overrides,
  };
  return { ...render(<MembershipDbClient {...props} />), props };
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
  it("a real workspace queue refresh retains the dialog and only unchanged selections", () => {
    const row = { memberId: member.id, fullName: member.full_name, jnuitsId: member.jnuits_id, joinedOn: member.joined_on, dueOn: "2025-07-01", lifecycleStatus: "former", portalAccessStatus: "frozen", pathStatus: "open", overdueDays: 100, requestId: "22222222-2222-4222-8222-222222222222", requestType: "alumni_conversion", requestedAt: "2026-10-03T00:00:00Z", requestUpdatedAt: "2026-10-03T00:00:00Z", requestNote: null };
    const second = { ...row, requestId: "33333333-3333-4333-8333-333333333333", memberId: "44444444-4444-4444-8444-444444444444", fullName: "Second fictional member", jnuitsId: "JNUITS-2099871" };
    const { rerender, props } = renderMembership({ renewalQueue: { queue: "alumni", page: 1, pageSize: 25, total: 2, rows: [row, second] } });
    fireEvent.click(screen.getByRole("checkbox", { name: "Select all on this page" }));
    fireEvent.click(screen.getByRole("button", { name: "Approve selected" }));
    fireEvent.change(screen.getByLabelText("Bulk review note"), { target: { value: "Synthetic reviewed eligibility." } });
    rerender(<MembershipDbClient {...props} renewalQueue={{ queue: "alumni", page: 1, pageSize: 25, total: 2, rows: [{ ...row, requestUpdatedAt: "2026-10-03T01:00:00Z" }, second] }} />);
    expect(screen.getByRole("dialog", { name: "Approve selected membership requests" })).toBeInTheDocument();
    expect(screen.getByLabelText("Bulk review note")).toHaveValue("Synthetic reviewed eligibility.");
    expect(screen.getByText("1 selected")).toBeInTheDocument();
    expect(screen.getByText(/selection changed.*close/i)).toBeInTheDocument();
  });
});


describe("member editor and committee titles", () => {
  beforeEach(() => {
    vi.stubGlobal("IntersectionObserver", class { observe() {} disconnect() {} });
    Element.prototype.scrollIntoView = vi.fn();
  });
  it("opens an accessible editor for the selected member and restores focus on close", async () => {
    const user = userEvent.setup();
    renderMembership();
    const trigger = screen.getByRole("button", { name: "Edit Fictional Member" });
    await user.click(trigger);
    const dialog = screen.getByRole("dialog", { name: /edit fictional member/i });
    expect(within(dialog).getByLabelText("Full name")).toHaveValue("Fictional Member");
    await user.click(within(dialog).getByRole("button", { name: "Close member editor" }));
    expect(screen.queryByRole("dialog", { name: /edit fictional member/i })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
  it("protects unsaved edits on close and Escape until discarded", async () => {
    const user = userEvent.setup();
    renderMembership();
    await user.click(screen.getByRole("button", { name: "Edit Fictional Member" }));
    const editor = within(screen.getByRole("dialog", { name: /edit fictional member/i }));
    await user.clear(editor.getByLabelText("Full name"));
    await user.type(editor.getByLabelText("Full name"), "Changed fictional name");
    await user.click(screen.getByRole("button", { name: "Close member editor" }));
    expect(screen.getByRole("alertdialog", { name: "Discard unsaved changes?" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(within(screen.getByRole("dialog", { name: /edit fictional member/i })).getByLabelText("Full name")).toHaveValue("Changed fictional name");
    fireEvent(screen.getByRole("dialog", { name: /edit fictional member/i }), new Event("cancel", { cancelable: true }));
    expect(screen.getByRole("alertdialog", { name: "Discard unsaved changes?" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Discard changes" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
  it("keeps an account draft after a profile save and blocks closing during the save", async () => {
    const user = userEvent.setup();
    let resolveSave!: (value: Awaited<ReturnType<typeof updateMemberProfileAction>>) => void;
    vi.mocked(updateMemberProfileAction).mockReturnValue(new Promise((resolve) => { resolveSave = resolve; }));
    renderMembership();
    await user.click(screen.getByRole("button", { name: "Edit Fictional Member" }));
    const editor = within(screen.getByRole("dialog", { name: /edit fictional member/i }));
    await user.selectOptions(editor.getByLabelText("Lifecycle"), "alumni");
    await user.clear(editor.getByLabelText("Full name"));
    await user.type(editor.getByLabelText("Full name"), "Canonical fictional name");
    await user.click(editor.getByRole("button", { name: "Save profile" }));
    expect(editor.getByRole("button", { name: "Close member editor" })).toBeDisabled();
    resolveSave({ ok: true, changedFields: ["full_name"], message: "Saved fictional profile", member: { id: member.id, fullName: "Canonical fictional name", email: member.email!, jnuitsId: member.jnuits_id, lifecycleStatus: member.lifecycle_status!, departmentCode: member.department_code, batchNo: member.batch_no, expectedUpdatedAt: "2026-10-12T00:00:00Z", joinedOn: member.joined_on, phone: member.phone, studentId: member.student_id, facebookUrl: null, linkedinUrl: null, websiteUrl: null } });
    await waitFor(() => expect(editor.getByRole("button", { name: "Close member editor" })).toBeEnabled());
    expect(editor.getByLabelText("Lifecycle")).toHaveValue("alumni");
    expect(editor.getByLabelText("Full name")).toHaveValue("Canonical fictional name");
    await user.click(editor.getByRole("button", { name: "Close member editor" }));
    expect(screen.getByRole("alertdialog", { name: "Discard unsaved changes?" })).toBeInTheDocument();
  });
  it("shows committee office separately from the portal access role", () => {
    renderMembership({ managedMembers: [{ ...member, currentCommitteeTitles: ["President"] } as ManagedMemberClientRecord] });
    expect(screen.getByText("President")).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "Member" })).toBeInTheDocument();
  });
});
