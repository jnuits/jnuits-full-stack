import "server-only";
import { z } from "zod";
import { requireAdminPermission } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { renewalQueues, type RenewalQueue, type RenewalQueueData } from "./renewal-queue";

const row = z.object({
  memberId: z.uuid(), fullName: z.string(), jnuitsId: z.string(), joinedOn: z.iso.date().nullable(), dueOn: z.iso.date().nullable(),
  lifecycleStatus: z.string(), portalAccessStatus: z.string(), pathStatus: z.string(), overdueDays: z.number().int().nonnegative(),
  requestId: z.uuid().nullable(), requestType: z.string().nullable(), requestedAt: z.string().nullable(), requestUpdatedAt: z.string().nullable(), requestNote: z.string().max(500).nullable(),
});
const result = z.object({ total: z.number().int().nonnegative(), rows: z.array(row).max(25) });
function single(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }

export async function loadMembershipRenewalQueue(params: Record<string, string | string[] | undefined>): Promise<RenewalQueueData> {
  await requireAdminPermission("admin.membership.manage", { fallbackPath: "/admin/dashboard" });
  const requested = single(params.renewalQueue);
  const queue: RenewalQueue = renewalQueues.some(([key]) => key === requested) ? requested as RenewalQueue : "overdue";
  const rawPage = single(params.renewalPage) || "1";
  const page = /^\d+$/.test(rawPage) ? Math.min(10000, Math.max(1, Number(rawPage))) : 1;
  const base = { queue, page, pageSize: 25, total: 0, rows: [] };
  try {
    const { data, error } = await createAdminClient().rpc("get_membership_admin_queue", { p_queue: queue, p_page: page, p_page_size: 25 });
    const parsed = result.safeParse(data);
    if (!error && parsed.success) return { ...base, ...parsed.data };
  } catch { /* Return a visible safe error rather than a successful empty queue. */ }
  return { ...base, error: "Membership decisions are temporarily unavailable. Refresh before recording a decision." };
}
