import { render, screen, fireEvent, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/app/admin/committee/actions", () => ({
  bulkUpdateCommitteeAssignments: vi.fn(), archiveAdvisorProfile: vi.fn(), linkAdvisorAuthUser: vi.fn(),
  removeCommitteeAssignment: vi.fn(), saveAdvisorProfile: vi.fn(), saveCommitteeAssignment: vi.fn(),
  saveCommitteeTerm: vi.fn(), setCommitteeTermCurrent: vi.fn(),
}));
// Intake owns independent HTTP effects and has dedicated behavioral coverage.
vi.mock("@/components/admin/committee-onboarding-panel", () => ({ CommitteeOnboardingPanel: () => null }));
import { CommitteeWorkspaceClient, type AdvisorProfileClientRecord } from "./committee-workspace-client";
const advisor: AdvisorProfileClientRecord = {
  id: "fixture-advisor", advisorJnuitsId: "JnUITS-CA0001", advisorType: "main_advisor", avatarSecureUrl: null,
  bio: null, dateConfidence: "verified", department: "CSE", designation: null, email: "advisor@example.com",
  facebookUrl: null, formerTitle: null, fullName: "Fixture Advisor", isCurrent: true, isPublic: true,
  jnuProfileUrl: null, joinedOn: "2020-01-01", leftOn: null, linkedinUrl: null, phone: null,
  publications: [], sortOrder: 0, speech: null, statusNote: null, tenureDisplay: null, title: null,
  userId: null, websiteUrl: null, workExperience: [],
};
function view(overrides: Partial<AdvisorProfileClientRecord> = {}) {
  render(<CommitteeWorkspaceClient advisors={[{...advisor, ...overrides}]} assignments={[]} flash={null} history={[]} positions={[]} roles={[]} terms={[]} departmentOptions={[]} />);
  fireEvent.click(screen.getByRole("button", { name: "Open actions for Fixture Advisor" }));
}
describe("advisor menu intent", () => {
  beforeEach(() => { Element.prototype.scrollIntoView = vi.fn(); });
  it("opens portal linking on the Access tab", () => {
    view(); fireEvent.click(screen.getByRole("menuitem", { name: "Invite/link portal user" }));
    expect(screen.getByRole("tab", { name: "access" })).toHaveAttribute("aria-selected", "true");
  });
  it("explains and confirms advisor portal linking before submission", () => {
    view(); fireEvent.click(screen.getByRole("menuitem", { name: "Invite/link portal user" }));
    fireEvent.click(screen.getByRole("button", { name: "Link auth user" }));
    const confirmation = screen.getByRole("dialog", { name: "Link advisor portal account?" });
    expect(confirmation).toBeInTheDocument();
    fireEvent.click(within(confirmation).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog", {name: "Link advisor portal account?"})).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /Advisor login email/i })).toHaveValue("advisor@example.com");
  });
  it("closes only the nested linking confirmation on Escape", () => {
    view(); fireEvent.click(screen.getByRole("menuitem", { name: "Invite/link portal user" }));
    fireEvent.click(screen.getByRole("button", { name: "Link auth user" }));
    const confirmation = screen.getByRole("dialog", { name: "Link advisor portal account?" });
    fireEvent.keyDown(confirmation, {key: "Escape"});
    expect(screen.queryByRole("dialog", {name: "Link advisor portal account?"})).not.toBeInTheDocument();
    expect(screen.getByRole("tab", {name: "access"})).toHaveAttribute("aria-selected", "true");
  });
  it("opens profile editing on Profile and removes the editable raw Auth UUID", () => {
    view(); fireEvent.click(screen.getByRole("menuitem", { name: "Edit profile" }));
    expect(screen.getByRole("tab", { name: "profile" })).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByRole("textbox", { name: /Auth user ID/i })).not.toBeInTheDocument();
  });
  it("returns keyboard focus to the advisor row action button after closing the editor", () => {
    view();
    const trigger = screen.getByRole("button", { name: "Open actions for Fixture Advisor" });
    const item = screen.getByRole("menuitem", { name: "Edit profile" });
    item.focus(); fireEvent.click(item);
    fireEvent.click(screen.getByRole("button", { name: "Close panel" }));
    expect(trigger).toHaveFocus();
  });
  it.each([[true, "/committee#advisor-board"], [false, "/committee#former-advisors"]])("links current=%s to the real public section", (isCurrent, href) => {
    view({ isCurrent: Boolean(isCurrent) });
    const item = screen.getByRole("menuitem", { name: "View public profile" });
    expect(item.tagName).toBe("A"); expect(item).toHaveAttribute("href", href);
  });
  it("does not offer a public navigation target for a private advisor", () => {
    view({ isPublic: false });
    expect(screen.getByRole("menuitem", { name: "View public profile" })).toBeDisabled();
  });
});
