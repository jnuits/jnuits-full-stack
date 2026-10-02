// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ confirm: vi.fn(), review: vi.fn() }));
vi.mock("@/app/admin/membership/renewal-actions", () => ({ confirmRenewalAction: mocks.confirm, reviewMembershipRequestAction: mocks.review }));
import { MembershipRenewalPanel, type RenewalQueueData } from "./membership-renewal-panel";
const row = { memberId: "11111111-1111-4111-8111-111111111111", fullName: "Fictional Member", jnuitsId: "JNUITS-2099001", joinedOn: "2024-09-01", dueOn: "2025-09-01", lifecycleStatus: "former", portalAccessStatus: "frozen", pathStatus: "open", overdueDays: 395, requestId: null, requestType: null, requestedAt: null, requestUpdatedAt: null, requestNote: null };
const queue = (overrides: Partial<RenewalQueueData> = {}): RenewalQueueData => ({ queue: "overdue", page: 1, pageSize: 25, total: 26, rows: [row], ...overrides });
afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  mocks.confirm.mockResolvedValue({ status: "success", message: "Still former. Confirm the next anniversary separately." });
  mocks.review.mockResolvedValue({ status: "error", message: "Request changed. Refresh before reviewing." });
});
describe("membership renewal admin panel", () => {
  it("groups the paginated queues and explains audited, one-period confirmation", () => {
    render(<MembershipRenewalPanel data={queue()} />);
    for (const name of ["Unknown joining dates", "Upcoming renewals", "Overdue renewals", "Renewal requests", "Departure requests", "Departure appeals", "Alumni requests"]) expect(screen.getByRole("link", { name })).toBeTruthy();
    expect(screen.getByText(/395 days overdue/i)).toBeTruthy();
    expect(screen.getByText(/security.*frozen/i)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Next queue page" }).getAttribute("href")).toContain("renewalPage=2");
    expect(screen.queryByText(/create cycle|membership cycle/i)).toBeNull();
  });
  it("requires an explicit confirmation before submitting a safe renewal reference", async () => {
    render(<MembershipRenewalPanel data={queue()} />);
    expect(screen.queryByLabelText("Safe office reference (optional)")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Review anniversary" }));
    const dialog = screen.getByRole("dialog", { name: "Confirm one anniversary" });
    expect(within(dialog).getByText(/does not lift.*security/i)).toBeTruthy();
    const button = within(dialog).getByRole("button", { name: "Confirm anniversary" }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    fireEvent.change(within(dialog).getByLabelText("Review note"), { target: { value: "Office fee verified." } });
    fireEvent.click(within(dialog).getByLabelText(/confirm only this anniversary/i));
    expect(button.disabled).toBe(false);
    fireEvent.click(button);
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("Still former"));
    expect(mocks.confirm.mock.calls[0][1].get("expectedDueOn")).toBe("2025-09-01");
  });
  it("links unknown dates to the existing member editor and disables invalid confirmations", () => {
    render(<MembershipRenewalPanel data={queue({ queue: "unknown", rows: [{ ...row, joinedOn: null, dueOn: null }] })} />);
    expect(screen.getByRole("link", { name: "Correct joining date" }).getAttribute("href")).toContain("memberId=");
    expect(screen.queryByRole("button", { name: "Review anniversary" })).toBeNull();
  });
  it("shows review consequences and a stale-state error accessibly", async () => {
    render(<MembershipRenewalPanel data={queue({ queue: "appeal", rows: [{ ...row, pathStatus: "closed_appealable", requestId: "22222222-2222-4222-8222-222222222222", requestType: "membership_departure_appeal", requestUpdatedAt: "2026-10-01T00:00:00.000Z", requestNote: "Selection was accidental." }] })} />);
    fireEvent.click(screen.getByRole("button", { name: "Review request" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/rejecting.*permanently.*future alumni/i)).toBeTruthy();
    fireEvent.change(within(dialog).getByLabelText("Review note"), { target: { value: "Reviewed evidence." } });
    fireEvent.click(within(dialog).getByLabelText(/understand this decision/i));
    fireEvent.click(within(dialog).getByRole("button", { name: "Record decision" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/Request changed/));
  });
  it("allows an Alumni request with an unknown joining date to use the guarded request review, not renewal confirmation", async () => {
    mocks.review.mockResolvedValue({ status: "success", message: "Request approved. Security restrictions are unchanged." });
    render(<MembershipRenewalPanel data={queue({ queue: "alumni", total: 1, rows: [{ ...row, joinedOn: null, dueOn: null, requestId: "22222222-2222-4222-8222-222222222222", requestType: "alumni_conversion", requestedAt: "2026-10-02T09:00:00+00:00", requestUpdatedAt: "2026-10-02T09:00:00+00:00" }] })} />);
    fireEvent.click(screen.getByRole("button", { name: "Review request" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/identity and committee history remain/i)).toBeTruthy();
    expect(within(dialog).queryByLabelText("Safe office reference (optional)")).toBeNull();
    const button = within(dialog).getByRole("button", { name: "Record decision" }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    fireEvent.change(within(dialog).getByLabelText("Review note"), { target: { value: "Alumni eligibility reviewed." } });
    fireEvent.click(within(dialog).getByLabelText(/understand this decision/i));
    fireEvent.click(button);
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("Request approved"));
    expect(mocks.review.mock.calls[0][1].get("requestId")).toBe("22222222-2222-4222-8222-222222222222");
    expect(mocks.review.mock.calls[0][1].get("expectedUpdatedAt")).toBe("2026-10-02T09:00:00+00:00");
    expect(mocks.confirm).not.toHaveBeenCalled();
  });
});
