import "server-only";
import { z } from "zod";
import { authorizeAdminOperation } from "@/lib/auth/admin-verification/guard";
import { createClient } from "@/lib/supabase/server";
import { bulkRequestTypes, bulkReviewInputSchema, type BulkReviewInput, type BulkReviewResult } from "./bulk-review-model";
export type { BulkReviewInput, BulkReviewResult } from "./bulk-review-model";

const rowsSchema = z.array(z.object({ id: z.uuid(), request_type: z.string(), status: z.string(), payload: z.record(z.string(), z.unknown()) })).max(25);
const outcome = z.object({ status: z.enum(["approved", "already_reviewed"]), requestId: z.uuid() });
function denied(message: string): BulkReviewResult { return { status: "error", message, results: [] }; }

export async function approveMembershipRequests(input: BulkReviewInput): Promise<BulkReviewResult> {
  const parsed = bulkReviewInputSchema.safeParse(input);
  if (!parsed.success) return denied("Select 1–25 unique requests from one page, provide a note (up to 500 characters), and confirm the consequences.");
  const { queue, note, requests } = parsed.data;
  const ordered = [...requests].sort((a, b) => a.requestId.localeCompare(b.requestId));
  try {
    const auth = await authorizeAdminOperation({ operation: "membership.request.review", payload: { ...ordered[0], decision: "approved", note, confirmation: "CONFIRM" } });
    if (!auth.ok) return denied("Membership administration and any mandatory account verification are required.");
    const client = await createClient();
    const fetched = await client.from("profile_update_requests").select("id,request_type,status,payload").in("id", ordered.map(row => row.requestId));
    const rows = rowsSchema.safeParse(fetched.data);
    if (fetched.error || !rows.success) return denied("The selected requests could not be checked. Refresh before trying again.");
    const byId = new Map(rows.data.map(row => [row.id, row]));
    if (byId.size !== ordered.length || ordered.some(row => byId.get(row.requestId)?.request_type !== bulkRequestTypes[queue])) {
      return denied("The selection includes a missing request or a different request type. Refresh and select one queue only. No decisions were recorded.");
    }
    const results: BulkReviewResult["results"] = [];
    for (const snapshot of ordered) {
      const row = byId.get(snapshot.requestId)!;
      if (!["pending", "approved"].includes(row.status) || row.payload.withdrawn === true || row.payload.withdrawn === "true") {
        results.push({ requestId: snapshot.requestId, status: "ineligible" }); continue;
      }
      try {
        // Each existing transaction rechecks live permission, request version,
        // transition eligibility and the independent security freeze.
        const response = await client.rpc("review_membership_request", { p_request_id: snapshot.requestId, p_expected_updated_at: snapshot.expectedUpdatedAt, p_decision: "approved", p_note: note });
        if (response.error) {
          const status = response.error.code === "40001" ? "stale" : ["22023", "P0002"].includes(response.error.code) ? "ineligible" : "failed";
          results.push({ requestId: snapshot.requestId, status }); continue;
        }
        const result = outcome.safeParse(response.data);
        results.push({ requestId: snapshot.requestId, status: !result.success || result.data.requestId !== snapshot.requestId ? "failed" : result.data.status === "already_reviewed" ? "already_approved" : "approved" });
      } catch { results.push({ requestId: snapshot.requestId, status: "failed" }); }
    }
    const counts = { approved: 0, already_approved: 0, stale: 0, ineligible: 0, failed: 0 };
    for (const row of results) counts[row.status]++;
    const completed = counts.approved + counts.already_approved;
    return { status: completed === results.length ? "success" : completed > 0 ? "partial" : "error", results,
      message: `${counts.approved} approved; ${counts.already_approved} already approved; ${counts.stale} changed; ${counts.ineligible} ineligible; ${counts.failed} failed. Security restrictions are unchanged.` };
  } catch { return denied("The selection could not be checked. Refresh its status before retrying."); }
}
