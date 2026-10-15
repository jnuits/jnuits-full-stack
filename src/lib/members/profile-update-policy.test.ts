import { describe, expect, it } from "vitest";
import { directProfileSchema } from "./profile-update-policy";
describe("workplace declaration allowlist", () => {
  it.each(["applicable", "not_applicable", ""])("accepts explicit %s without admitting identity keys", (workplaceApplicability) => {
    expect(directProfileSchema.safeParse({workplaceApplicability}).success).toBe(true);
    expect(directProfileSchema.safeParse({workplaceApplicability, userId:"forged"}).success).toBe(false);
  });
  it.each([null, true, "student", {}, 1])("rejects unknown declaration %s", (workplaceApplicability) => {
    expect(directProfileSchema.safeParse({workplaceApplicability}).success).toBe(false);
  });
  it("rejects an explicitly contradictory declaration", () => {
    expect(directProfileSchema.safeParse({workplaceApplicability:"not_applicable", currentOrganization:"Real company"}).success).toBe(false);
    expect(directProfileSchema.safeParse({workplaceApplicability:"not_applicable", currentOrganization:"", designation:"", workLocation:""}).success).toBe(true);
  });
});
