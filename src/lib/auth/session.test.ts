import { describe, expect, it } from "vitest";
import {
  hasMemberPortalAccessRole,
  isMutablePortalAccess,
  portalAccessRedirectPath,
  resolveSafeNextPath,
  resolveScopedNextPath,
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
      currentMembershipPathStatus: "open",
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
    expect(isMutablePortalAccess(legacyFormerCurrent)).toBe(false);
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

  it("routes active former members to membership resolution, never to login", () => {
    expect(portalAccessRedirectPath({ lifecycleStatus: "former", memberId: "member-1", memberType: "current", portalAccessStatus: "active", currentMembershipPathStatus: "open" })).toBe("/portal/membership");
  });
  it.each(["departure_requested", "closed_appealable", "closed_final"])("does not restore current-path mutability from %s", (path) => {
    expect(isMutablePortalAccess({ lifecycleStatus: "current", memberId: "member-1", portalAccessStatus: "active", currentMembershipPathStatus: path })).toBe(false);
  });
  it("does not restore mutability from member_type when lifecycle is missing", () => {
    expect(isMutablePortalAccess({ lifecycleStatus: null, memberType: "current", memberId: "member-1", portalAccessStatus: "active", currentMembershipPathStatus: "open" })).toBe(false);
  });

  it("keeps query parameters on explicitly allowlisted handoff routes", () => {
    expect(
      resolveScopedNextPath(
        "/admin/invite/accept?claimed=1",
        ["/portal", "/profile", "/admin/invite/accept"],
        "/portal/dashboard",
      ),
    ).toBe("/admin/invite/accept?claimed=1");
    expect(
      resolveScopedNextPath(
        "/admin/dashboard?claimed=1",
        ["/portal", "/profile", "/admin/invite/accept"],
        "/portal/dashboard",
      ),
    ).toBe("/portal/dashboard");
  });
});
