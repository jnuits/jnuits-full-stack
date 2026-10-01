import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ issue: vi.fn(), create: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }), useSearchParams: () => new URLSearchParams() }));
vi.mock("@/app/admin/invitations/actions", () => ({
  bulkRevokeInvitationsAction: vi.fn(), commitCsvInvitationsAction: vi.fn(), createInvitationBatchAction: mocks.create,
  issueDirectInvitationAction: vi.fn(), issueInvitationsFromBatchAction: mocks.issue, previewCsvInvitationsAction: vi.fn(),
  reissueInvitationAction: vi.fn(), revokeInvitationAction: vi.fn(), syncInvitationBatchMetricsAction: vi.fn(), updateInvitationBatchStatusAction: vi.fn(),
}));
import { InvitationsWorkspaceClient } from "./invitations-workspace-client";
describe("cycle-free invitation batch UI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.issue.mockResolvedValue({ ok: true, message: "Invitations issued." });
  });
  it("collects explicit IDs and never asks for a cycle window", async () => {
    const user = userEvent.setup();
    render(<InvitationsWorkspaceClient auditEvents={[]} batches={[{
      id: "batch-1", label: "Fictional outreach", claimedCount: 0, createdAt: "2026-10-01T00:00:00Z",
      cycleId: null, cycleLabel: null, expiresAt: null, failedCount: 0, issuedCount: 0, source: "manual", status: "draft",
    }]} deliveries={[]} flash={null} invitations={[]} metrics={{ active: 0, batchClaimed: 0, batchIssued: 0, claimed: 0, expiringSoon: 0, failedDelivery: 0, revokedOrExpired: 0 }} page={1} pageSize={20} totalCount={0} />);
    expect(screen.queryByLabelText("Linked cycle")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /cycle queue/i })).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Batch", { selector: "select#issue-batch" }), "batch-1");
    await user.type(screen.getByLabelText(/JnUITS membership IDs/), "JnUITS-2024001,\nJnUITS-2024002");
    await user.click(screen.getByRole("button", { name: "Issue invitations" }));
    expect(mocks.issue).toHaveBeenCalledWith(expect.objectContaining({ memberIds: ["JnUITS-2024001", "JnUITS-2024002"], batchId: "batch-1" }));
  });
});
