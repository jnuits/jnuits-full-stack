// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ confirm: vi.fn(), review: vi.fn(), bulk: vi.fn(), refresh: vi.fn() }));
vi.mock("@/app/admin/membership/renewal-actions", () => ({ confirmRenewalAction: mocks.confirm, reviewMembershipRequestAction: mocks.review }));
vi.mock("@/app/admin/membership/bulk-review-actions", () => ({ bulkApproveMembershipRequestsAction: mocks.bulk }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh, replace: vi.fn() }) }));
import { MembershipRenewalPanel, type RenewalQueueData } from "./membership-renewal-panel";
const row = { memberId: "11111111-1111-4111-8111-111111111111", fullName: "Fictional Member", jnuitsId: "JNUITS-2099001", joinedOn: "2024-09-01", dueOn: "2025-09-01", lifecycleStatus: "former", portalAccessStatus: "frozen", pathStatus: "open", overdueDays: 395, requestId: null, requestType: null, requestedAt: null, requestUpdatedAt: null, requestNote: null };
const queue = (overrides: Partial<RenewalQueueData> = {}): RenewalQueueData => ({ queue: "overdue", page: 1, pageSize: 25, total: 26, rows: [row], ...overrides });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, value: { decision: { status: "allowed" } } }) }));
  mocks.confirm.mockResolvedValue({ status: "success", message: "Still former. Confirm the next anniversary separately." });
  mocks.review.mockResolvedValue({ status: "error", message: "Request changed. Refresh before reviewing." });
  mocks.bulk.mockResolvedValue({ status: "success", message: "Requests approved.", results: [] });
});

const alumniRows = [
  { ...row, requestId: "22222222-2222-4222-8222-222222222222", requestType: "alumni_conversion", requestUpdatedAt: "2026-10-02T00:00:00Z" },
  { ...row, memberId: "33333333-3333-4333-8333-333333333333", fullName: "Second Fictional Member", jnuitsId: "JNUITS-2099002", requestId: "44444444-4444-4444-8444-444444444444", requestType: "alumni_conversion", requestUpdatedAt: "2026-10-02T01:00:00Z" },
];
const alumniQueue = () => queue({ queue: "alumni", rows: alumniRows, total: 70 });
describe("current-page bulk membership selection", () => {
  it("page_only_select_all and indeterminate_selection never include payments or missing snapshots", () => {
    render(<MembershipRenewalPanel data={queue({ queue: "alumni", total: 70, rows: [...alumniRows, { ...row, requestId: "55555555-5555-4555-8555-555555555555", requestType: "membership_renewal", requestUpdatedAt: "2026-10-02T00:00:00Z" }, { ...row, requestId: "66666666-6666-4666-8666-666666666666", requestType: "alumni_conversion" }] })} />);
    const boxes = screen.getAllByRole("checkbox"); expect(boxes).toHaveLength(3);
    const all = screen.getByRole("checkbox", { name: "Select all on this page" }) as HTMLInputElement;
    fireEvent.click(boxes[1]); expect(all.indeterminate).toBe(true); expect(screen.getByText("1 selected")).toBeInTheDocument();
    fireEvent.click(all); expect(screen.getByText("2 selected")).toBeInTheDocument(); expect(all.indeterminate).toBe(false);
    expect(boxes[1]).toBeChecked(); expect(boxes[2]).toBeChecked();
  });
  it("queue_change_clears_selection and changed_refresh_removes_selection permanently", () => {
    const { rerender } = render(<MembershipRenewalPanel data={alumniQueue()} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Select all on this page" }));
    rerender(<MembershipRenewalPanel data={queue({ queue: "alumni", total: 70, rows: [{ ...alumniRows[0], requestUpdatedAt: "2026-10-03T00:00:00Z" }, alumniRows[1]] })} />);
    expect(screen.getByText("1 selected")).toBeInTheDocument();
    rerender(<MembershipRenewalPanel data={alumniQueue()} />); expect(screen.getByText("1 selected")).toBeInTheDocument();
    rerender(<MembershipRenewalPanel data={queue({ queue: "departure", rows: [{ ...alumniRows[0], requestType: "membership_departure" }] })} />);
    expect(screen.getByText("0 selected")).toBeInTheDocument();
  });
  it("partial_result_keeps_failed_rows and preserves each selected timestamp", async () => {
    mocks.bulk.mockResolvedValue({ status: "partial", message: "One approved; one changed.", results: [{ requestId: alumniRows[0].requestId, status: "approved" }, { requestId: alumniRows[1].requestId, status: "stale" }] });
    render(<MembershipRenewalPanel data={alumniQueue()} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Select all on this page" }));
    fireEvent.click(screen.getByRole("button", { name: "Approve selected" }));
    const dialog = screen.getByRole("dialog", { name: "Approve selected membership requests" });
    expect(within(dialog).getByRole("button", { name: "Approve selected requests" })).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText("Bulk review note"), { target: { value: "Eligibility reviewed." } });
    fireEvent.click(within(dialog).getByLabelText(/understand these decisions/i));
    fireEvent.click(within(dialog).getByRole("button", { name: "Approve selected requests" }));
    await screen.findByText("One approved; one changed.");
    const submitted = JSON.parse(mocks.bulk.mock.calls[0][1].get("requests"));
    expect(submitted).toEqual(alumniRows.map(row => ({ requestId: row.requestId, expectedUpdatedAt: row.requestUpdatedAt })));
    fireEvent.click(within(dialog).getByRole("button", { name: "Close bulk review" }));
    await waitFor(() => expect(screen.getByText("1 selected")).toBeInTheDocument());
    expect(screen.getByRole("checkbox", { name: "Select Fictional Member JNUITS-2099001" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Select Fictional Member JNUITS-2099001" })).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: "Select Second Fictional Member JNUITS-2099002" })).toBeChecked();
    fireEvent.click(screen.getByRole("checkbox", { name: "Select all on this page" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Select all on this page" }));
    expect(screen.getByText("1 selected")).toBeInTheDocument();
    expect(mocks.confirm).not.toHaveBeenCalled();
  });
  it("a refreshed request cannot be submitted from an older open bulk confirmation", () => {
    const { rerender } = render(<MembershipRenewalPanel data={alumniQueue()} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Select all on this page" }));
    fireEvent.click(screen.getByRole("button", { name: "Approve selected" }));
    fireEvent.change(screen.getByLabelText("Bulk review note"), { target: { value: "Eligibility reviewed." } });
    fireEvent.click(screen.getByLabelText(/understand these decisions/i));
    rerender(<MembershipRenewalPanel data={queue({ queue: "alumni", rows: [{ ...alumniRows[0], requestUpdatedAt: "2026-10-03T00:00:00Z" }, alumniRows[1]] })} />);
    expect(screen.getByRole("button", { name: "Approve selected requests" })).toBeDisabled();
    expect(screen.getByText(/selection changed.*close/i)).toBeInTheDocument();
    expect(mocks.bulk).not.toHaveBeenCalled();
  });
  it("page navigation resets selections and an in-flight batch locks all decision controls", async () => {
    let finish!: (value: unknown) => void;
    mocks.bulk.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    const { rerender } = render(<MembershipRenewalPanel data={alumniQueue()} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Select all on this page" }));
    rerender(<MembershipRenewalPanel data={queue({ queue: "alumni", rows: alumniRows, page: 2 })} />);
    expect(screen.getByText("0 selected")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: "Select all on this page" }));
    fireEvent.click(screen.getByRole("button", { name: "Approve selected" }));
    fireEvent.change(screen.getByLabelText("Bulk review note"), { target: { value: "Eligibility reviewed." } });
    fireEvent.click(screen.getByLabelText(/understand these decisions/i));
    fireEvent.click(screen.getByRole("button", { name: "Approve selected requests" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Close bulk review" })).toBeDisabled());
    for (const control of screen.getAllByRole("checkbox")) expect(control).toBeDisabled();
    for (const button of screen.getAllByRole("button", { name: "Review request" })) expect(button).toBeDisabled();
    expect(screen.getByLabelText("Bulk review note")).toBeDisabled();
    finish({ status: "error", message: "Refresh before retrying.", results: [] });
    await screen.findByText("Refresh before retrying.");
    fireEvent.click(screen.getByRole("button", { name: "Close bulk review" }));
    expect(screen.getByText("2 selected")).toBeInTheDocument();
  });
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
  it("preserves renewal note and confirmation when verification is cancelled", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, value: { decision: { status: "required", methods: ["totp", "email"] } } }) }));
    render(<MembershipRenewalPanel data={queue()} />);
    fireEvent.click(screen.getByRole("button", { name: "Review anniversary" }));
    fireEvent.change(screen.getByLabelText("Review note"), { target: { value: "Office fee verified." } });
    fireEvent.click(screen.getByLabelText(/confirm only this anniversary/i));
    fireEvent.click(screen.getByRole("button", { name: "Confirm anniversary" }));
    fireEvent.click(await screen.findByRole("button", { name: "Cancel verification" }));
    expect(screen.getByLabelText("Review note")).toHaveValue("Office fee verified.");
    expect(screen.getByLabelText(/confirm only this anniversary/i)).toBeChecked();
    expect(mocks.confirm).not.toHaveBeenCalled();
  });
  it("dismissing verification with Escape does not close the original renewal draft", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, value: { decision: { status: "required", methods: ["totp", "email"] } } }) }));
    render(<MembershipRenewalPanel data={queue()} />);
    fireEvent.click(screen.getByRole("button", { name: "Review anniversary" }));
    fireEvent.change(screen.getByLabelText("Review note"), { target: { value: "Office fee verified." } });
    fireEvent.click(screen.getByLabelText(/confirm only this anniversary/i));
    fireEvent.click(screen.getByRole("button", { name: "Confirm anniversary" }));
    const verification = await screen.findByRole("dialog", { name: "Verify your account" });
    fireEvent(verification, new Event("cancel", { bubbles: true, cancelable: true }));
    expect(screen.getByRole("dialog", { name: "Confirm one anniversary" })).toBeInTheDocument();
    expect(screen.getByLabelText("Review note")).toHaveValue("Office fee verified.");
    expect(mocks.confirm).not.toHaveBeenCalled();
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
