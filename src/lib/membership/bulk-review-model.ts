import { z } from "zod";
import type { RenewalQueueData, RenewalQueueRow } from "./renewal-queue";

export const bulkRequestTypes = { alumni: "alumni_conversion", departure: "membership_departure", appeal: "membership_departure_appeal" } as const;
export const bulkReviewInputSchema = z.strictObject({
  queue: z.enum(["alumni", "departure", "appeal"]),
  requests: z.array(z.strictObject({ requestId: z.uuid().transform(value => value.toLowerCase()), expectedUpdatedAt: z.string().max(64).pipe(z.iso.datetime({ offset: true })) })).min(1).max(25)
    .refine(rows => new Set(rows.map(row => row.requestId)).size === rows.length, "Select each request only once."),
  note: z.string().trim().min(1).max(500), confirmation: z.literal("CONFIRM"),
});
export type BulkReviewInput = z.infer<typeof bulkReviewInputSchema>;
export type BulkReviewResult = {
  status: "idle" | "success" | "partial" | "error"; message: string;
  results: { requestId: string; status: "approved" | "already_approved" | "stale" | "ineligible" | "failed" }[];
};
export const initialBulkReviewResult: BulkReviewResult = { status: "idle", message: "", results: [] };

export function reviewableBulkRows(data: RenewalQueueData) {
  if (data.error || !Object.hasOwn(bulkRequestTypes, data.queue)) return [];
  const type = bulkRequestTypes[data.queue as BulkReviewInput["queue"]];
  // The server queue contains pending requests only. Never reach beyond this
  // visible page or include a fee/waiver record in bulk membership decisions.
  return data.rows.slice(0, 25).filter(row => row.requestType === type && z.uuid().safeParse(row.requestId).success && z.iso.datetime({ offset: true }).safeParse(row.requestUpdatedAt).success);
}
export function bulkRowSnapshot(row: RenewalQueueRow) {
  return JSON.stringify([row.memberId, row.requestId, row.requestType, row.requestUpdatedAt, row.fullName, row.jnuitsId, row.joinedOn, row.dueOn, row.lifecycleStatus, row.portalAccessStatus, row.pathStatus, row.requestNote, row.requestedAt]);
}
