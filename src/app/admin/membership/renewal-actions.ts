"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdminPermission } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export type RenewalActionResult = { status: "idle" | "success" | "error"; code?: string; message: string };
const confirmation = z.literal("CONFIRM");
const note = z.string().trim().min(1, "Explain the reviewed decision.").max(500);
const renewalSchema = z.object({
  memberId: z.uuid(), expectedDueOn: z.iso.date(), resolution: z.enum(["paid", "waived"]),
  reference: z.string().trim().max(96).regex(/^[A-Za-z0-9._/-]*$/, "Use a short office reference, not financial or personal details."),
  note, confirmation,
});
const reviewSchema = z.object({ requestId: z.uuid(), expectedUpdatedAt: z.iso.datetime({ offset: true }), decision: z.enum(["approved", "rejected"]), note, confirmation });
const renewalResult = z.object({ status: z.enum(["confirmed", "already_confirmed"]), nextDueOn: z.iso.date(), lifecycleStatus: z.enum(["current", "former", "alumni", "deleted"]) });
const reviewResult = z.object({ status: z.enum(["approved", "rejected", "already_reviewed"]), requestId: z.uuid(), pathStatus: z.string().optional() });

function invalid(message: string): RenewalActionResult { return { status: "error", code: "invalid_input", message }; }
function databaseFailure(code?: string): RenewalActionResult {
  if (code === "40001") return { status: "error", code: "stale", message: "This record changed. Refresh the queue before continuing." };
  if (code === "42501") return { status: "error", code: "permission_denied", message: "Membership administration and verified MFA are required." };
  if (code === "22023" || code === "P0002") return { status: "error", code: "invalid_transition", message: "This record is not eligible for that decision. Refresh and check its current state." };
  return { status: "error", code: "database_error", message: "The decision could not be recorded. Retry after refreshing the queue." };
}
function fields(form: FormData, names: string[]) { return Object.fromEntries(names.map((name) => [name, form.get(name) ?? ""])); }
function refreshMembershipViews() {
  revalidatePath("/admin/membership"); revalidatePath("/portal"); revalidatePath("/portal/membership"); revalidatePath("/portal/profile");
}

export async function confirmRenewalAction(_previous: RenewalActionResult, formData: FormData): Promise<RenewalActionResult> {
  const auth = await requireAdminPermission("admin.membership.manage", { fallbackPath: "/admin/membership", requireAal2: true });
  if (!auth.user) return databaseFailure("42501");
  const parsed = renewalSchema.safeParse(fields(formData, ["memberId", "expectedDueOn", "resolution", "reference", "note", "confirmation"]));
  if (!parsed.success) return invalid(parsed.error.issues[0]?.message || "Check the member, anniversary and confirmation fields.");
  let response;
  try {
    const client = await createClient();
    response = await client.rpc("confirm_membership_renewal", {
      p_member_id: parsed.data.memberId, p_expected_due_on: parsed.data.expectedDueOn, p_resolution: parsed.data.resolution,
      ...(parsed.data.reference ? { p_reference: parsed.data.reference } : {}), p_note: parsed.data.note,
    });
  } catch { return databaseFailure(); }
  if (response.error) return databaseFailure(response.error.code);
  const result = renewalResult.safeParse(response.data);
  if (!result.success) return databaseFailure();
  refreshMembershipViews();
  if (result.data.status === "already_confirmed") return { status: "success", message: "This anniversary was already confirmed. No additional anniversary was advanced. Refresh to see the latest state." };
  const outcome = result.data.lifecycleStatus === "current" ? "Membership is current; security restrictions are unchanged." : "Membership is still former; confirm the next outstanding period separately. Security restrictions are unchanged.";
  return { status: "success", message: `Confirmed one anniversary. Next due date: ${result.data.nextDueOn}. ${outcome}` };
}

export async function reviewMembershipRequestAction(_previous: RenewalActionResult, formData: FormData): Promise<RenewalActionResult> {
  const auth = await requireAdminPermission("admin.membership.manage", { fallbackPath: "/admin/membership", requireAal2: true });
  if (!auth.user) return databaseFailure("42501");
  const parsed = reviewSchema.safeParse(fields(formData, ["requestId", "expectedUpdatedAt", "decision", "note", "confirmation"]));
  if (!parsed.success) return invalid(parsed.error.issues[0]?.message || "Check the request, decision and review note.");
  let response;
  try {
    const client = await createClient();
    response = await client.rpc("review_membership_request", { p_request_id: parsed.data.requestId, p_expected_updated_at: parsed.data.expectedUpdatedAt, p_decision: parsed.data.decision, p_note: parsed.data.note });
  } catch { return databaseFailure(); }
  if (response.error) return databaseFailure(response.error.code);
  const result = reviewResult.safeParse(response.data);
  if (!result.success) return databaseFailure();
  refreshMembershipViews();
  return { status: "success", message: `${result.data.status === "already_reviewed" ? "The decision was already recorded" : `Request ${result.data.status}`}. Security restrictions are unchanged. Refresh to see the resulting membership state.` };
}
