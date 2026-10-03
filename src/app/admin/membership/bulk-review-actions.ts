"use server";
import { revalidatePath } from "next/cache";
import { approveMembershipRequests } from "@/lib/membership/bulk-review";
import { bulkReviewInputSchema, type BulkReviewResult } from "@/lib/membership/bulk-review-model";

export async function bulkApproveMembershipRequestsAction(_previous: BulkReviewResult, form: FormData): Promise<BulkReviewResult> {
  const raw = form.get("requests");
  if (typeof raw !== "string" || raw.length > 12_000) return { status: "error", message: "Choose a valid, bounded request selection.", results: [] };
  let requests: unknown;
  try { requests = JSON.parse(raw); } catch { return { status: "error", message: "The selection is invalid. Refresh and select the requests again.", results: [] }; }
  const parsed = bulkReviewInputSchema.safeParse({ requests, queue: form.get("queue"), note: form.get("note"), confirmation: form.get("confirmation") });
  if (!parsed.success) return { status: "error", message: "Choose 1–25 unique requests, add a note (up to 500 characters), and confirm the decision.", results: [] };
  const result = await approveMembershipRequests(parsed.data);
  if (result.results.length) {
    revalidatePath("/admin/membership"); revalidatePath("/portal"); revalidatePath("/portal/membership"); revalidatePath("/portal/profile");
  }
  return result;
}
