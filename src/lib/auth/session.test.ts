import { describe, expect, it } from "vitest";
import {
  hasMemberPortalAccessRole,
  isMutablePortalAccess,
  portalAccessRedirectPath,
  resolveSafeNextPath,
  type PortalAccessState,
} from "@/lib/auth/session";

describe("portal access helpers", () => {
  it("keeps post-authentication redirects on a local path", () => {
    expect(resolveSafeNextPath("/portal/dashboard", "/portal")).toBe(
      "/portal/dashboard"
    );
    expect(resolveSafeNextPath("https://example.com", "/portal")).toBe(
      "/portal"
    );
    expect(resolveSafeNextPath("//example.com", "/portal")).toBe("/portal");
  });

  it("treats only active current or alumni members as mutable portal users", () => {
    const activeCurrent = {
      lifecycleStatus: "current",
      memberId: "member-1",
      portalAccessStatus: "active",
    } satisfies PortalAccessState;
    const suspended = {
      ...activeCurrent,
      portalAccessStatus: "suspended",
    } satisfies PortalAccessState;
    const legacyFormerCurrent = {
      ...activeCurrent,
      lifecycleStatus: "former",
      memberType: "current",
    } satisfies PortalAccessState;
    const deleted = {
      ...activeCurrent,
      lifecycleStatus: "deleted",
    } satisfies PortalAccessState;

    expect(isMutablePortalAccess(activeCurrent)).toBe(true);
    expect(isMutablePortalAccess(legacyFormerCurrent)).toBe(true);
    expect(isMutablePortalAccess(suspended)).toBe(false);
    expect(isMutablePortalAccess(deleted)).toBe(false);
  });

  it("redirects inactive portal users to the explanation route", () => {
    expect(
      portalAccessRedirectPath({
        lifecycleStatus: "current",
        memberId: "member-1",
        portalAccessStatus: "suspended",
      })
    ).toBe("/portal/access-pending?access=suspended");
  });

  it("does not treat advisor-only accounts as member access-status scoped", () => {
    expect(hasMemberPortalAccessRole(["advisor"])).toBe(false);
    expect(hasMemberPortalAccessRole(["advisor", "member"])).toBe(true);
  });
});
