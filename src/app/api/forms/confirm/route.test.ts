import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  confirmFormSubmission: vi.fn(),
}));

vi.mock("@/lib/forms/repository", () => ({
  confirmFormSubmission: mocks.confirmFormSubmission,
}));

vi.mock("@/lib/security/with-api-guard", () => ({
  withApiGuard: <T>(handler: T) => handler,
}));

import { POST } from "./route";

const submissionId = "33333333-3333-4333-8333-333333333333";
const token = "A".repeat(43);

function request(body: unknown) {
  return new NextRequest("https://jnuits.example.test/api/forms/confirm", {
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
}

describe("form confirmation route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("confirms a pending submission without returning private application data", async () => {
    mocks.confirmFormSubmission.mockResolvedValue({
      form_kind: "membership_application",
      form_submission_id: submissionId,
      result_status: "confirmed",
      review_case_id: "44444444-4444-4444-8444-444444444444",
    });

    const response = await POST(request({ submissionId, token }), {
      params: Promise.resolve({}),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true });
    expect(mocks.confirmFormSubmission).toHaveBeenCalledWith({
      submissionId,
      tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
  });

  it("treats an already-confirmed link as idempotent success", async () => {
    mocks.confirmFormSubmission.mockResolvedValue({ result_status: "already_confirmed" });

    const response = await POST(request({ submissionId, token }), {
      params: Promise.resolve({}),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true });
  });

  it("returns an expiry response without exposing form data", async () => {
    mocks.confirmFormSubmission.mockResolvedValue({ result_status: "expired" });

    const response = await POST(request({ submissionId, token }), {
      params: Promise.resolve({}),
    });

    expect(response.status).toBe(410);
    await expect(response.json()).resolves.toEqual({
      error: "This confirmation link has expired. Use the recovery form below to request a new one.",
    });
  });

  it("rejects malformed confirmation tokens before calling the database", async () => {
    const response = await POST(request({ submissionId, token: "short" }), {
      params: Promise.resolve({}),
    });

    expect(response.status).toBe(400);
    expect(mocks.confirmFormSubmission).not.toHaveBeenCalled();
  });
});
