import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ action: vi.fn() }));
vi.mock("@/app/(portal)/portal/membership/actions", () => ({ requestMembershipAction: mocks.action }));
import { FormerMemberScreen, type MembershipView } from "./former-member-screen";
const membership: MembershipView = { fullName: "Fictional Member", jnuitsId: "JNUITS-2024001", lifecycleStatus: "former", currentMembershipPathStatus: "open", joinedOn: "2024-07-01", renewalDueOn: "2025-07-01", graceEndsOn: "2026-01-01", renewalState: "former", revision: 2, hasDepartureCase: false, hasAppeal: false };
describe("membership resolution screen", () => {
  beforeEach(() => { mocks.action.mockReset(); mocks.action.mockResolvedValue({ status: "success", code: "requested", message: "Request sent for administrator review." }); });
  it("explains the outstanding anniversary and offers plain-language choices without profile fields", () => {
    render(<FormerMemberScreen membership={membership} requests={[]} />);
    expect(screen.getByRole("heading", { name: "Former member" })).toBeInTheDocument();
    expect(screen.getAllByText(/1 July 2025/).length).toBeGreaterThan(0);
    expect(screen.getByText(/administrator.*confirm each/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Request renewal" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Apply for Alumni" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Leave JnUITS" })).toBeInTheDocument();
    expect(screen.queryByLabelText(/full name|email|phone|department|workplace/i)).not.toBeInTheDocument();
  });
  it("requires a keyboard-accessible confirmation before departure and shows the review consequence", async () => {
    const user = userEvent.setup();
    render(<FormerMemberScreen membership={membership} requests={[]} />);
    const button = screen.getByRole("button", { name: "Leave JnUITS" });
    expect(button).toBeDisabled();
    expect(screen.getByText(/one appeal.*permanently/i)).toBeInTheDocument();
    expect(screen.getByText(/if that appeal is rejected/i)).toBeInTheDocument();
    const input = screen.getByLabelText("Type LEAVE JNUITS to confirm");
    await user.click(input);
    await user.keyboard("LEAVE JNUITS");
    expect(button).toBeEnabled();
    await user.click(button);
    expect(await screen.findByRole("status")).toHaveTextContent("Request sent for administrator review.");
    expect(mocks.action.mock.calls[0][1].get("confirmation")).toBe("LEAVE JNUITS");
  });
  it("offers withdrawal instead of renewal while departure is pending", () => {
    render(<FormerMemberScreen membership={{ ...membership, currentMembershipPathStatus: "departure_requested", hasDepartureCase: true }} requests={[]} />);
    expect(screen.getByRole("button", { name: "Withdraw departure request" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Request renewal" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Leave JnUITS" })).not.toBeInTheDocument();
  });
  it("offers one appeal only while eligible and preserves alumni after final closure", () => {
    const { rerender } = render(<FormerMemberScreen membership={{ ...membership, currentMembershipPathStatus: "closed_appealable", hasDepartureCase: true }} requests={[]} />);
    expect(screen.getByRole("button", { name: "Submit appeal" })).toBeDisabled();
    rerender(<FormerMemberScreen membership={{ ...membership, currentMembershipPathStatus: "closed_appealable", hasDepartureCase: true, hasAppeal: true }} requests={[]} />);
    expect(screen.queryByRole("button", { name: "Submit appeal" })).not.toBeInTheDocument();
    rerender(<FormerMemberScreen membership={{ ...membership, currentMembershipPathStatus: "closed_final" }} requests={[]} />);
    expect(screen.queryByRole("button", { name: "Request renewal" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Apply for Alumni" })).toBeInTheDocument();
    expect(screen.getByText(/current.membership path is permanently closed/i)).toBeInTheDocument();
  });
  it("shows accessible errors and disables a duplicate pending alumni request", async () => {
    mocks.action.mockResolvedValue({ status: "error", code: "stale", message: "Refresh before trying again." });
    const user = userEvent.setup();
    render(<FormerMemberScreen membership={membership} requests={[{ id: "request", request_type: "alumni_conversion", status: "pending", requested_at: "2026-10-01T00:00:00Z" }]} />);
    expect(screen.getByRole("button", { name: "Apply for Alumni" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Request renewal" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Refresh before trying again.");
  });
  it("keeps current grace access and hides former-only destructive choices", () => {
    render(<FormerMemberScreen membership={{ ...membership, lifecycleStatus: "current", renewalState: "grace" }} requests={[]} />);
    const main = screen.getByRole("heading", { name: "Renewal overdue — grace period" });
    expect(main).toBeInTheDocument();
    expect(screen.getByText(/continue using your member portal/i)).toBeInTheDocument();
    expect(within(main.parentElement!).queryByRole("button", { name: "Leave JnUITS" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Apply for Alumni" })).not.toBeInTheDocument();
  });
});
