import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  batchUpdate: vi.fn(),
  batchUpdateEq: vi.fn(),
  claimedEq: vi.fn(),
  claimedGt: vi.fn(),
  failedBatchEq: vi.fn(),
  failedStatusEq: vi.fn(),
  from: vi.fn(),
  issuedEq: vi.fn(),
  memberInvitationSelect: vi.fn(),
}));

vi.mock("@/lib/supabase/flexible", () => ({
  asFlexibleClient: <T>(client: T) => client,
}));

import {
  type AdminClient,
  syncInvitationBatchMetrics,
} from "@/lib/admin/invitations";

describe("syncInvitationBatchMetrics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.issuedEq.mockResolvedValue({ count: 5, data: null, error: null });
    mocks.claimedGt.mockResolvedValue({ count: 2, data: null, error: null });
    mocks.claimedEq.mockReturnValue({ gt: mocks.claimedGt });
    mocks.failedStatusEq.mockResolvedValue({ count: 1, data: null, error: null });
    mocks.failedBatchEq.mockReturnValue({ eq: mocks.failedStatusEq });
    mocks.memberInvitationSelect
      .mockReturnValueOnce({ eq: mocks.issuedEq })
      .mockReturnValueOnce({ eq: mocks.claimedEq })
      .mockReturnValueOnce({ eq: mocks.failedBatchEq });
    mocks.batchUpdateEq.mockResolvedValue({ error: null });
    mocks.batchUpdate.mockReturnValue({ eq: mocks.batchUpdateEq });
    mocks.from.mockImplementation((table: string) => {
      if (table === "member_invitations") {
        return { select: mocks.memberInvitationSelect };
      }

      if (table === "invitation_batches") {
        return { update: mocks.batchUpdate };
      }

      throw new Error(`Unexpected table: ${table}`);
    });
  });

  it("uses count-only batch queries instead of loading every invitation row", async () => {
    await expect(
      syncInvitationBatchMetrics(
        { from: mocks.from } as unknown as AdminClient,
        "batch-1"
      )
    ).resolves.toEqual({ claimedCount: 2, failedCount: 1, issuedCount: 5 });

    expect(mocks.memberInvitationSelect).toHaveBeenNthCalledWith(
      1,
      "id",
      { count: "exact", head: true }
    );
    expect(mocks.memberInvitationSelect).toHaveBeenNthCalledWith(
      2,
      "id",
      { count: "exact", head: true }
    );
    expect(mocks.memberInvitationSelect).toHaveBeenNthCalledWith(
      3,
      "id",
      { count: "exact", head: true }
    );
    expect(mocks.issuedEq).toHaveBeenCalledWith("batch_id", "batch-1");
    expect(mocks.claimedEq).toHaveBeenCalledWith("batch_id", "batch-1");
    expect(mocks.claimedGt).toHaveBeenCalledWith("used_count", 0);
    expect(mocks.failedBatchEq).toHaveBeenCalledWith("batch_id", "batch-1");
    expect(mocks.failedStatusEq).toHaveBeenCalledWith("delivery_status", "failed");
    expect(mocks.batchUpdate).toHaveBeenCalledWith({
      claimed_count: 2,
      issued_count: 5,
      metadata: {
        failedCount: 1,
        lastSyncedAt: expect.any(String),
      },
    });
    expect(mocks.batchUpdateEq).toHaveBeenCalledWith("id", "batch-1");
  });
});