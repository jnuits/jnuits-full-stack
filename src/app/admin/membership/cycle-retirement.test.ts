import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/env", () => ({ getAppBaseUrl: () => "https://example.test" }));
import * as actions from "./actions";
describe("retired cycle mutation API", () => {
  it.each(["createMembershipCycleAction", "updateMembershipCycleStatusAction", "enrollMemberInCycleAction", "updateCycleMemberStateAction"])("does not expose %s as a callable action", (name) => {
    expect(actions).not.toHaveProperty(name);
  });
  it("preserves member operations and account request actions", () => {
    expect(actions.saveMemberOperationsAction).toBeTypeOf("function");
    expect(actions.reviewMemberAccountRequestAction).toBeTypeOf("function");
  });
});
