import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const db = vi.hoisted(() => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: db.createAdminClient }));
vi.mock("@/lib/security/rate-limit", async (importOriginal) => ({ ...(await importOriginal<object>()), checkRateLimitForApi: async () => ({ success: true, resetAt: 0 }) }));
import { GET } from "@/app/api/membership-form/status/route";

describe("retired membership status lookup", () => {
  beforeEach(() => {
    db.createAdminClient.mockReturnValue({ from: () => ({ select: () => ({ eq: () => ({ order: () => ({ limit: async () => ({ data: [{ status: "pending", updated_at: "2026-10-01" }], error: null }) }) }) }) }) });
  });
  it("returns the same gone response for known, unknown, absent and malformed addresses without applicant access", async () => {
    const results = [];
    for (const query of ["?email=known%40example.test", "?email=unknown%40example.test", "", "?email=%25invalid"]) {
      const response = await GET(new NextRequest("https://jnuits.example.test/api/membership-form/status" + query), { params: Promise.resolve({}) });
      expect(response.status).toBe(410);
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      const body = await response.json();
      expect(body).toMatchObject({ supportUrl: "/membership-form" });
      expect(body).not.toHaveProperty("status");
      expect(body).not.toHaveProperty("updatedAt");
      results.push(body);
    }
    for (const result of results) expect(result).toEqual(results[0]);
    expect(db.createAdminClient).not.toHaveBeenCalled();
  });
});
