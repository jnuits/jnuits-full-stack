import "server-only";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseJoiningDate } from "./intake-fields";

const schema = z.object({
  memberId: z.string().uuid().optional(),
  batchSize: z.number().int().min(1).max(1000).optional(),
  effectiveDate: z.string().refine((value) => parseJoiningDate(value).ok).optional(),
});

/** Server-only adapter. PostgreSQL owns dates, grace rules and transitions. */
export async function reconcileMembershipLifecycle(options: {
  memberId?: string; batchSize?: number; effectiveDate?: string;
} = {}): Promise<{ status: "reconciled"; transitioned: number }> {
  const parsed = schema.parse(options);
  const { data, error } = await createAdminClient().rpc("reconcile_membership_lifecycle", {
    p_batch_size: parsed.memberId ? 1 : parsed.batchSize ?? 500,
    ...(parsed.memberId ? { p_member_id: parsed.memberId } : {}),
    ...(parsed.effectiveDate ? { p_effective_date: parsed.effectiveDate } : {}),
  });
  const value = data && typeof data === "object" && !Array.isArray(data) ? data : null;
  if (error || !value || value.status !== "reconciled" || typeof value.transitioned !== "number"
    || !Number.isInteger(value.transitioned) || value.transitioned < 0) {
    throw new Error("Membership status could not be verified. Please try again later.");
  }
  return { status: "reconciled", transitioned: value.transitioned };
}
