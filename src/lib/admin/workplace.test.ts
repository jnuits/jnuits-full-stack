import { createClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Database } from "@/lib/db/types";
import { SafeAdminActionError } from "@/lib/admin/action-error";

const mail = vi.hoisted(() => vi.fn());
vi.mock("@/lib/notifications/send-email", () => ({ sendEmail: mail }));
import { cancelWorkplaceRequest, reviewWorkplaceRequest } from "./workplace";

describe("workplace transactional callers", () => {
  beforeEach(() => vi.clearAllMocks());
  function client(conflict = false) {
    const calls: { path: string; body: unknown }[] = [];
    const admin = createClient<Database>("https://fixture.supabase.co", "fixture-key", {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: async (input, init) => {
        const url = new URL(String(input));
        calls.push({ path: url.pathname, body: init?.body ? JSON.parse(String(init.body)) : null });
        if (url.pathname.endsWith("/profile_update_requests")) return Response.json({ id: "fictional-request", member_id: "fictional-member", request_type: "workplace_update", status: "pending", payload: { currentOrganization: "Fictional Org" }, members: { id: "fictional-member", full_name: "Fictional Alumni", user_id: "fictional-owner", email: "fixture@local.invalid" } });
        if (conflict) return Response.json({ code: "PT409", message: "Permanent profile conflict" }, { status: 409 });
        return Response.json({ memberId: "fictional-member", memberName: "Fictional Alumni", changedFields: ["current_organization"] });
      } },
    });
    return { admin, calls };
  }
  it("returns a safe actionable conflict without sending a decision notification", async () => {
    const { admin, calls } = client(true);
    await expect(reviewWorkplaceRequest({ admin, actorUserId: "fictional-reviewer", requestId: "fictional-request", decision: "approved" })).rejects.toBeInstanceOf(SafeAdminActionError);
    expect(calls.at(-1)).toEqual({ path: "/rest/v1/rpc/review_member_profile_update", body: { p_request_id: "fictional-request", p_actor_user_id: "fictional-reviewer", p_decision: "approved", p_review_note: "" } });
    expect(mail).not.toHaveBeenCalled();
  });
  it("notifies only after a committed review", async () => {
    const { admin, calls } = client();
    await expect(reviewWorkplaceRequest({ admin, actorUserId: "fictional-reviewer", requestId: "fictional-request", decision: "rejected" })).resolves.toMatchObject({ memberId: "fictional-member" });
    expect(calls.at(-1)?.path).toBe("/rest/v1/rpc/review_member_profile_update");
    expect(mail).toHaveBeenCalledOnce();
  });
  it("cancels through the ownership/status-checked transaction", async () => {
    const { admin, calls } = client();
    await cancelWorkplaceRequest({ admin, requestId: "fictional-request", userId: "fictional-owner" });
    expect(calls.at(-1)).toEqual({ path: "/rest/v1/rpc/cancel_member_workplace_update", body: { p_request_id: "fictional-request", p_user_id: "fictional-owner" } });
    expect(mail).not.toHaveBeenCalled();
  });
});
