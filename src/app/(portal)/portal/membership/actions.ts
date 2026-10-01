"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePortalIdentity } from "@/lib/auth/session";
import { getPortalMemberSnapshot } from "@/lib/portal/member";
import { createClient } from "@/lib/supabase/server";

export type MembershipActionResult = {
  status: "idle" | "success" | "error";
  code?: string;
  message: string;
};
const schema = z.object({
  action: z.enum(["renewal", "alumni", "departure", "withdraw_departure", "appeal"]),
  revision: z.string().regex(/^(0|[1-9]\d*)$/).transform(Number).refine(Number.isSafeInteger),
  confirmation: z.string().default(""),
  note: z.string().trim().max(500).default(""),
});
function fail(code: string, message: string): MembershipActionResult {
  return { status: "error", code, message };
}

/** Next.js enforces same-origin Server Action requests. SQL derives auth.uid()
 * and locks/revalidates ownership, revision and state inside the transaction. */
export async function requestMembershipAction(
  _previous: MembershipActionResult,
  formData: FormData,
): Promise<MembershipActionResult> {
  const auth = await requirePortalIdentity({ fallbackPath: "/portal/membership" });
  if (!auth.user) return fail("not_eligible", "Sign in to manage your membership.");
  const parsed = schema.safeParse({
    action: formData.get("action"), revision: formData.get("revision"),
    confirmation: formData.get("confirmation") ?? "", note: formData.get("note") ?? "",
  });
  if (!parsed.success) return fail("invalid_input", "Choose a valid membership action. Reasons must be 500 characters or fewer; refresh if the form is out of date.");
  const { action, revision, confirmation, note } = parsed.data;
  let snapshot: Awaited<ReturnType<typeof getPortalMemberSnapshot>>;
  try { snapshot = await getPortalMemberSnapshot(auth.user.id); }
  catch { return fail("database_error", "Membership status could not be verified. Refresh and try again."); }
  const member = snapshot.membership;
  if (!member || snapshot.access.mode === "blocked" || member.portalAccessStatus !== "active"
    || !["current", "former"].includes(member.lifecycleStatus ?? "")) {
    return fail("not_eligible", "This account cannot submit a membership request. Contact an administrator.");
  }
  if (member.revision !== revision) return fail("stale", "Your membership changed. Refresh this page before trying again.");
  const path = member.currentMembershipPathStatus;
  const former = member.lifecycleStatus === "former";
  if (action === "renewal" && (path !== "open" || !member.renewalDueOn)) {
    return fail("invalid_transition", "Renewal needs an open current-membership path and a recorded joining date. Contact an administrator.");
  }
  if (action === "departure") {
    if (!former || path !== "open") return fail("invalid_transition", "Only a former member with an open membership path can request departure.");
    if (confirmation !== "LEAVE JNUITS") return fail("confirmation_required", "Type LEAVE JNUITS exactly to confirm that you understand the departure consequences.");
  }
  if (action === "withdraw_departure" && (path !== "departure_requested" || !member.currentCaseId)) {
    return fail("invalid_transition", "Only a still-pending departure request can be withdrawn.");
  }
  if (action === "appeal") {
    if (!former || path !== "closed_appealable" || !member.currentCaseId || member.appealId) {
      return fail("invalid_transition", "Only one appeal is available after a departure is approved.");
    }
    if (!note) return fail("reason_required", "Explain why you want to appeal, using 1–500 characters.");
  }
  if (action === "alumni" && !former) return fail("invalid_transition", "Alumni applications here are for former members.");

  let response;
  try {
    const client = await createClient();
    response = await client.rpc("request_membership_transition", {
      p_action: action, p_expected_revision: revision,
      ...(confirmation ? { p_confirmation: confirmation } : {}),
      ...(note ? { p_note: note } : {}),
    });
  } catch {
    return fail("database_error", "Your request could not be saved. Please try again later.");
  }
  const { data, error } = response;
  if (error) {
    if (error.code === "40001") return fail("stale", "Your membership changed. Refresh this page before trying again.");
    if (error.code === "42501") return fail("not_eligible", "This account is no longer eligible. Refresh or contact an administrator.");
    if (error.code === "22023") return fail("invalid_transition", "This choice is no longer available. Refresh to see your current options.");
    return fail("database_error", "Your request could not be saved. Please try again later.");
  }
  const result = data && typeof data === "object" && !Array.isArray(data) ? data : null;
  if (!result || !["requested", "already_requested", "withdrawn"].includes(String(result.status))) {
    return fail("database_error", "Your request could not be verified. Refresh before trying again.");
  }
  revalidatePath("/portal/membership");
  revalidatePath("/portal");
  revalidatePath("/admin/membership");
  const message = result.status === "already_requested" ? "This request is already pending administrator review."
    : result.status === "withdrawn" ? "Your pending departure request was withdrawn. Outstanding renewals still need administrator confirmation."
    : action === "renewal" ? "Renewal request sent. Contact an administrator about fees; an administrator must confirm each outstanding anniversary. No payment was processed here."
    : "Your request was sent for administrator review. Your identity and committee history have not been deleted.";
  return { status: "success", code: String(result.status), message };
}
