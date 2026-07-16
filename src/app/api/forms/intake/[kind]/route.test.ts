import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  loadPublishedFormByKind: vi.fn(),
}));

vi.mock("@/lib/forms/repository", () => ({
  loadPublishedFormByKind: mocks.loadPublishedFormByKind,
}));

vi.mock("@/lib/security/with-api-guard", () => ({
  withApiGuard: <T>(handler: T) => handler,
}));

import { GET } from "./route";

describe("public intake lookup route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns only the public path and title of the active membership intake", async () => {
    mocks.loadPublishedFormByKind.mockResolvedValue({
      slug: "membership-2026",
      title: "Membership application",
    });

    const response = await GET(
      new NextRequest("https://jnuits.example.test/api/forms/intake/membership"),
      { params: Promise.resolve({ kind: "membership" }) }
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      href: "/forms/membership-2026",
      title: "Membership application",
    });
    expect(mocks.loadPublishedFormByKind).toHaveBeenCalledWith("membership_application");
  });

  it("does not expose an unpublished intake", async () => {
    mocks.loadPublishedFormByKind.mockResolvedValue(null);

    const response = await GET(
      new NextRequest("https://jnuits.example.test/api/forms/intake/alumni"),
      { params: Promise.resolve({ kind: "alumni" }) }
    );

    expect(response.status).toBe(404);
  });
});
