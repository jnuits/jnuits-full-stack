import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listRetentionWorkspace: vi.fn(),
  requireAdminApiPermission: vi.fn(),
  runRetentionAction: vi.fn(),
}));

vi.mock("@/lib/admin/api-auth", () => ({
  requireAdminApiPermission: mocks.requireAdminApiPermission,
}));
vi.mock("@/lib/retention/operations", () => ({
  listRetentionWorkspace: mocks.listRetentionWorkspace,
  runRetentionAction: mocks.runRetentionAction,
}));
vi.mock("@/lib/security/with-api-guard", () => ({
  withApiGuard: <T>(handler: T) => handler,
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));
vi.mock("@/lib/supabase/flexible", () => ({
  asFlexibleClient: <T>(client: T) => client,
}));

import { GET, POST } from "./route";

describe("retention admin route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdminApiPermission.mockResolvedValue({
      auth: { user: { id: "11111111-1111-4111-8111-111111111111" } },
    });
    mocks.listRetentionWorkspace.mockResolvedValue({ eventJobs: [], formJobs: [] });
    mocks.runRetentionAction.mockResolvedValue({ created: 0, success: true });
  });

  it("requires retention permission and AAL2 before listing jobs", async () => {
    const response = await GET(
      new NextRequest("https://jnuits.example.test/api/admin/retention"),
      { params: Promise.resolve({}) }
    );

    expect(response.status).toBe(200);
    expect(mocks.requireAdminApiPermission).toHaveBeenCalledWith(
      "admin.retention.manage",
      expect.objectContaining({ requireAal2: true })
    );
  });

  it("passes explicit archive actions to the protected workflow", async () => {
    const response = await POST(
      new NextRequest("https://jnuits.example.test/api/admin/retention", {
        body: JSON.stringify({
          action: "archive",
          jobId: "22222222-2222-4222-8222-222222222222",
          scope: "form",
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      }),
      { params: Promise.resolve({}) }
    );

    expect(response.status).toBe(200);
    expect(mocks.runRetentionAction).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        action: "archive",
        actorUserId: "11111111-1111-4111-8111-111111111111",
        scope: "form",
      })
    );
  });

  it("rejects purge without explicit confirmation phrase", async () => {
    const response = await POST(
      new NextRequest("https://jnuits.example.test/api/admin/retention", {
        body: JSON.stringify({
          action: "purge",
          jobId: "22222222-2222-4222-8222-222222222222",
          scope: "event",
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      }),
      { params: Promise.resolve({}) }
    );

    expect(response.status).toBe(422);
    expect(mocks.runRetentionAction).not.toHaveBeenCalled();
  });
});
