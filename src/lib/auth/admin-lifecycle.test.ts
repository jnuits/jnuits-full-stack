import { describe, expect, it } from "vitest";
import { resolveAdminLifecycleAccessState } from "@/lib/auth/admin-lifecycle";

describe("admin lifecycle access", () => {
  it("permits only an explicitly active admin profile", () => {
    expect(
      resolveAdminLifecycleAccessState({
        is_active: true,
        status: "active",
      }),
    ).toBe("active");
  });

  it("fails closed for frozen, removed, pending, missing, and inconsistent identities", () => {
    expect(
      resolveAdminLifecycleAccessState({
        is_active: false,
        status: "frozen",
      }),
    ).toBe("frozen");
    expect(
      resolveAdminLifecycleAccessState({
        is_active: false,
        status: "removed",
      }),
    ).toBe("removed");
    expect(
      resolveAdminLifecycleAccessState({
        is_active: false,
        status: "pending_invite",
      }),
    ).toBe("pending_invite");
    expect(
      resolveAdminLifecycleAccessState({
        is_active: false,
        status: "active",
      }),
    ).toBe("inactive");
    expect(resolveAdminLifecycleAccessState(null)).toBe("missing");
  });
});