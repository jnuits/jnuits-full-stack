import { describe, expect, it } from "vitest";

import {
  ADMIN_INVITATION_ACCEPT_PATH,
  buildAdminInvitationAcceptPath,
  isAdminInvitationAcceptNextPath,
  isAdminInvitationAcceptPath,
  resolveAdminInvitationAcceptanceState,
  resolvePostClaimDestination,
} from "@/lib/admin/admin-invitation-flow";

describe("admin invitation handoff", () => {
  it("recognizes only the exact protected acceptance route as a bootstrap handoff", () => {
    expect(isAdminInvitationAcceptPath("/admin/invite/accept")).toBe(true);
    expect(isAdminInvitationAcceptPath("/admin/invite/accept/anything")).toBe(false);
    expect(isAdminInvitationAcceptNextPath("/admin/invite/accept")).toBe(true);
    expect(isAdminInvitationAcceptNextPath("/admin/dashboard")).toBe(false);
  });

  it("routes a claimed member back to explicit admin acceptance", () => {
    expect(resolvePostClaimDestination(true)).toBe(
      "/admin/invite/accept?claimed=1",
    );
    expect(resolvePostClaimDestination(false)).toBe(
      "/portal/dashboard?claimed=1",
    );
  });

  it("builds local acceptance URLs without external redirect data", () => {
    expect(buildAdminInvitationAcceptPath()).toBe(
      ADMIN_INVITATION_ACCEPT_PATH,
    );
    expect(
      buildAdminInvitationAcceptPath({
        claimed: true,
        state: "claim-required",
      }),
    ).toBe("/admin/invite/accept?claimed=1&state=claim-required");
  });

  it("maps server-side acceptance failures to safe UI states", () => {
    expect(resolveAdminInvitationAcceptanceState(new Error("This legacy invitation requires authorized reissuance."))).toBe("reissue-required");
    expect(
      resolveAdminInvitationAcceptanceState(
        new Error("Claim the linked member profile with this same account before accepting admin access."),
      ),
    ).toBe("claim-required");
    expect(
      resolveAdminInvitationAcceptanceState(
        new Error("This admin invitation has expired."),
      ),
    ).toBe("expired");
    expect(
      resolveAdminInvitationAcceptanceState(
        new Error("This invitation belongs to a different signed-in user."),
      ),
    ).toBe("wrong-account");
    expect(resolveAdminInvitationAcceptanceState(new Error("database down"))).toBe(
      "retry",
    );
  });
});
