import { expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ admin: vi.fn(() => { throw new Error("Unexpected legacy privileged write"); }) }));
vi.mock("@/lib/auth/session", () => ({ requirePortalIdentity: async () => ({ user: { id: "owner" } }), requirePortalUser: async () => ({ user: { id: "owner" } }), requirePortalPermission: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); } }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.admin }));
import { requestAlumniConversionAction } from "./actions";
it("hands legacy alumni entry points to the membership workflow without a second privileged insertion path", async () => {
  await expect(requestAlumniConversionAction(new FormData())).rejects.toThrow("redirect:/portal/membership");
  expect(mocks.admin).not.toHaveBeenCalled();
});
