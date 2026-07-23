import { describe, expect, it } from "vitest";
import {
  canAccessFormStudioKind,
  formStudioKindFilter,
  getFormStudioKindScope,
} from "./form-studio-access";

describe("Form Studio kind authorization", () => {
  it.each(["admin", "super_admin"])(
    "allows %s to manage every form kind",
    (role) => {
      expect(getFormStudioKindScope([role])).toBe("all");
      expect(canAccessFormStudioKind([role], "event_registration")).toBe(true);
      expect(canAccessFormStudioKind([role], "membership_application")).toBe(true);
      expect(canAccessFormStudioKind([role], "alumni_onboarding")).toBe(true);
      expect(formStudioKindFilter([role])).toBeUndefined();
    }
  );

  it("restricts content admins to event registration forms", () => {
    const roles = ["content_admin"];
    expect(getFormStudioKindScope(roles)).toBe("event_registration");
    expect(canAccessFormStudioKind(roles, "event_registration")).toBe(true);
    expect(canAccessFormStudioKind(roles, "membership_application")).toBe(false);
    expect(canAccessFormStudioKind(roles, "alumni_onboarding")).toBe(false);
    expect(formStudioKindFilter(roles)).toBe("event_registration");
  });

  it("denies users without an active Form Studio operator role", () => {
    expect(getFormStudioKindScope(["member"])).toBeNull();
    expect(canAccessFormStudioKind(["member"], "event_registration")).toBe(false);
  });
});
