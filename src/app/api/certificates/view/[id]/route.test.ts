import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { RATE_LIMITS } from "@/lib/security/rate-limit";

const routeMocks = vi.hoisted(() => ({
  findCertificateById: vi.fn(),
  withApiGuard: vi.fn((handler: unknown) => handler),
}));

vi.mock("@/lib/certificates/queries", () => ({
  findCertificateById: routeMocks.findCertificateById,
}));

vi.mock("@/lib/security/with-api-guard", () => ({
  withApiGuard: routeMocks.withApiGuard,
}));

import { GET } from "./route";

const context = (id: string) => ({
  params: Promise.resolve({ id }),
});

function request(path = "/api/certificates/view/CERT-1") {
  return new NextRequest(`https://jnuits.org.bd${path}`, {
    method: "GET",
  });
}

describe("certificate view route", () => {
  it("wraps public GET with the certificate view rate limit", () => {
    expect(routeMocks.withApiGuard).toHaveBeenCalledWith(expect.any(Function), {
      enforceSameOrigin: false,
      rateLimit: RATE_LIMITS.certificateView,
    });
  });

  it("rejects invalid certificate IDs before querying", async () => {
    routeMocks.findCertificateById.mockReset();
    const response = await GET(request(), context("x".repeat(81)));

    await expect(response.json()).resolves.toEqual({
      message: "Enter a valid certificate ID.",
    });
    expect(response.status).toBe(400);
    expect(routeMocks.findCertificateById).not.toHaveBeenCalled();
  });

  it("returns a safe public certificate payload", async () => {
    routeMocks.findCertificateById.mockResolvedValueOnce({
      asset_url: "https://example.test/cert.pdf",
      certificate_id: "24007",
      details: "Completed",
      exam_or_event: "Event",
      exam_or_event_name: "Workshop",
      first_name: "Ayesha",
      issue_date: "2026-01-02",
      last_name: "Rahman",
    });

    const response = await GET(request(), context("24007"));

    await expect(response.json()).resolves.toEqual({
      data: {
        asset_url: "https://example.test/cert.pdf",
        certificate_id: "24007",
        details: "Completed",
        exam_or_event: "Event",
        exam_or_event_name: "Workshop",
        first_name: "Ayesha",
        issue_date: "2026-01-02",
        last_name: "Rahman",
      },
    });
    expect(response.status).toBe(200);
  });

  it("returns 404 for a valid but unknown certificate", async () => {
    routeMocks.findCertificateById.mockResolvedValueOnce(null);
    const response = await GET(request(), context("24007"));

    await expect(response.json()).resolves.toEqual({
      message: "Certificate not found.",
    });
    expect(response.status).toBe(404);
  });
});
