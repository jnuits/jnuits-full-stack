import { describe, expect, it } from "vitest";

import { resolveMembershipAccessMode } from "./lifecycle";

const current = {
  lifecycleStatus: "current",
  memberType: "current",
  portalAccessStatus: "active",
  currentMembershipPathStatus: "open",
};

describe("membership access precedence", () => {
  it("keeps current and overdue-grace members mutable", () => {
    expect(resolveMembershipAccessMode(current)).toBe("mutable");
  });

  it("does not make a former member mutable through member_type=current", () => {
    expect(resolveMembershipAccessMode({ ...current, lifecycleStatus: "former" })).toBe("restricted");
  });

  it.each(["departure_requested", "closed_appealable", "closed_final"])(
    "keeps %s signed-in but restricted regardless of current classification",
    (path) => {
      expect(resolveMembershipAccessMode({ ...current, currentMembershipPathStatus: path })).toBe("restricted");
      expect(resolveMembershipAccessMode({ ...current, lifecycleStatus: "former", currentMembershipPathStatus: path })).toBe("restricted");
    },
  );

  it("permits active alumni even though their current-membership path is permanently closed", () => {
    expect(resolveMembershipAccessMode({
      ...current, lifecycleStatus: "alumni", memberType: "alumni", currentMembershipPathStatus: "closed_final",
    })).toBe("mutable");
  });

  it.each(["frozen", "suspended", "deactivated", "deletion_requested", null, "unexpected"])(
    "blocks security state %s before considering former or alumni eligibility",
    (security) => {
      expect(resolveMembershipAccessMode({ ...current, portalAccessStatus: security })).toBe("blocked");
      expect(resolveMembershipAccessMode({ ...current, lifecycleStatus: "former", portalAccessStatus: security })).toBe("blocked");
      expect(resolveMembershipAccessMode({ ...current, lifecycleStatus: "alumni", portalAccessStatus: security })).toBe("blocked");
    },
  );

  it.each(["deleted", null, "unknown"])("fails closed for lifecycle %s", (lifecycle) => {
    expect(resolveMembershipAccessMode({ ...current, lifecycleStatus: lifecycle })).toBe("blocked");
  });

  it.each([null, "unexpected"])("fails closed for unknown current-path state %s", (path) => {
    expect(resolveMembershipAccessMode({ ...current, currentMembershipPathStatus: path })).toBe("blocked");
  });
});
