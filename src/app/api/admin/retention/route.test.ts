import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listRetentionWorkspace: vi.fn(),
  requireAdminApiPermission: vi.fn(),
  requireVerifiedRetentionArchive: vi.fn(),
  runRetentionAction: vi.fn(),
}));

vi.mock("@/lib/admin/api-auth", () => ({ requireAdminApiPermission: mocks.requireAdminApiPermission }));
vi.mock("@/lib/retention/approval", () => ({
  requireVerifiedRetentionArchive: mocks.requireVerifiedRetentionArchive,
  RetentionArchiveVerificationError: class RetentionArchiveVerificationError extends Error {},
}));
vi.mock("@/lib/retention/operations", () => ({
  listRetentionWorkspace: mocks.listRetentionWorkspace,
  RetentionWorkflowError: class RetentionWorkflowError extends Error { status = 500; },
  runRetentionAction: mocks.runRetentionAction,
}));
vi.mock("@/lib/security/with-api-guard", () => ({ withApiGuard: <T>(handler: T) => handler }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));
vi.mock("@/lib/supabase/flexible", () => ({ asFlexibleClient: <T>(client: T) => client }));

import { GET, POST } from "./route";

const jobId = "22222222-2222-4222-8222-222222222222";
function actionRequest(action: "approve_purge" | "archive" | "purge") {
  return new NextRequest("https://jnuits.example.test/api/admin/retention", {
    body: JSON.stringify({
      action,
      jobId,
      scope: "form",
      ...(action === "purge" ? { confirmation: "PURGE" } : {}),
    }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
}

describe("retention admin route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdminApiPermission.mockResolvedValue({ auth: { user: { id: "11111111-1111-4111-8111-111111111111" } } });
    mocks.listRetentionWorkspace.mockResolvedValue({ eventJobs: [], formJobs: [] });
    mocks.requireVerifiedRetentionArchive.mockResolvedValue({});
    mocks.runRetentionAction.mockResolvedValue({ created: 0, success: true });
  });

  it("requires retention permission and AAL2 before listing jobs", async () => {
    const response = await GET(new NextRequest("https://jnuits.example.test/api/admin/retention"), { params: Promise.resolve({}) });
    expect(response.status).toBe(200);
    expect(mocks.requireAdminApiPermission).toHaveBeenCalledWith("admin.retention.manage", expect.objectContaining({ requireAal2: true }));
  });

  it("passes explicit archive actions without purge verification", async () => {
    const response = await POST(actionRequest("archive"), { params: Promise.resolve({}) });
    expect(response.status).toBe(200);
    expect(mocks.requireVerifiedRetentionArchive).not.toHaveBeenCalled();
    expect(mocks.runRetentionAction).toHaveBeenCalledWith({}, expect.objectContaining({ action: "archive", scope: "form" }));
  });

  it("verifies the signed archive before purge approval", async () => {
    const response = await POST(actionRequest("approve_purge"), { params: Promise.resolve({}) });
    expect(response.status).toBe(200);
    expect(mocks.requireVerifiedRetentionArchive).toHaveBeenCalledWith({}, "form", jobId);
    expect(mocks.requireVerifiedRetentionArchive.mock.invocationCallOrder[0])
      .toBeLessThan(mocks.runRetentionAction.mock.invocationCallOrder[0]);
  });

  it("re-verifies the signed archive immediately before purge", async () => {
    const response = await POST(actionRequest("purge"), { params: Promise.resolve({}) });

    expect(response.status).toBe(200);
    expect(mocks.requireVerifiedRetentionArchive).toHaveBeenCalledWith(
      {},
      "form",
      jobId,
      {
        allowedStatuses: ["purge_approved"],
        statusMessage: "Purge requires an archived, approved job.",
      }
    );
    expect(mocks.requireVerifiedRetentionArchive.mock.invocationCallOrder[0])
      .toBeLessThan(mocks.runRetentionAction.mock.invocationCallOrder[0]);
  });

  it("blocks purge approval when archive verification fails", async () => {
    const { RetentionArchiveVerificationError } = await import("@/lib/retention/approval");
    mocks.requireVerifiedRetentionArchive.mockRejectedValue(new RetentionArchiveVerificationError("Archive manifest signature verification failed."));
    const response = await POST(actionRequest("approve_purge"), { params: Promise.resolve({}) });
    expect(response.status).toBe(409);
    expect(mocks.runRetentionAction).not.toHaveBeenCalled();
  });

  it("rejects purge without explicit confirmation phrase", async () => {
    const response = await POST(new NextRequest("https://jnuits.example.test/api/admin/retention", {
      body: JSON.stringify({ action: "purge", jobId, scope: "event" }),
      headers: { "Content-Type": "application/json" }, method: "POST",
    }), { params: Promise.resolve({}) });
    expect(response.status).toBe(422);
    expect(mocks.runRetentionAction).not.toHaveBeenCalled();
  });
});
