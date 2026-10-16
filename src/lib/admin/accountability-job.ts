import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { ingestAdminAuthEvents } from "./activity/auth-source";
import { runAdminNotificationWork } from "./notifications/job";

/** One leased daily job; optional mail never owns native collection coverage. */
export async function runAdminAccountability({ now = new Date(), dryRun = true, deadline = new Date(now.getTime() + 20_000) }: { now?: Date; dryRun?: boolean; deadline?: Date } = {}) {
  const result = { imported: 0, read: 0, notices: 0, sends: 0, digests: 0, backlog: false, coverage: "unavailable", errors: [] as string[] };
  const budget = Math.min(20_000, deadline.getTime() - now.getTime());
  if (!Number.isFinite(budget) || budget <= 0) { result.errors.push("deadline_reached"); return result; }
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout>;
  const expired = new Promise<never>((_, reject) => {
    timer = setTimeout(() => { controller.abort(); reject(new Error("deadline_reached")); }, budget);
  });
  const admin = createAdminClient();
  let leaseId: string | null = null;
  let collectionFailed = false;
  try {
    const claim = await Promise.race([admin.rpc("claim_admin_accountability_job").abortSignal(controller.signal), expired]);
    const receipt = claim.data as { claimed?: boolean; leaseId?: string } | null;
    if (claim.error || !receipt?.claimed || !receipt.leaseId) {
      result.errors.push(claim.error ? "lease_unavailable" : "job_already_running"); return result;
    }
    leaseId = receipt.leaseId;
    const batch = await Promise.race([ingestAdminAuthEvents({ limit: 500, dryRun, leaseId, signal: controller.signal }), expired]);
    result.imported = batch.stored; result.read = batch.read; result.backlog = batch.backlog; result.coverage = batch.coverage.state;
    try {
      const notifications = await Promise.race([runAdminNotificationWork({ leaseId, now, dryRun, deadline }), expired]);
      result.notices = notifications.notices; result.sends = notifications.sends; result.digests = notifications.digests;
      result.backlog ||= notifications.backlog; result.errors.push(...notifications.errors);
    } catch { result.errors.push(controller.signal.aborted ? "notification_deadline_reached" : "notification_work_unavailable"); }
  } catch {
    collectionFailed = true;
    result.errors.push(controller.signal.aborted ? "deadline_reached" : "collection_unavailable");
  } finally {
    clearTimeout(timer!);
    if (leaseId) {
      if (!dryRun) {
        try {
          const health = await admin.rpc("record_admin_accountability_health", {p_lease_id:leaseId,p_result:result}).abortSignal(AbortSignal.timeout(2_000));
          if (health.error) result.errors.push("health_receipt_unavailable");
          else if (health.data && typeof health.data === "object" && "backlog" in health.data && typeof health.data.backlog === "boolean") result.backlog=health.data.backlog;
        } catch { result.errors.push("health_receipt_unavailable"); }
      }
      try {
        // Separate small cleanup budget; a lost response still expires by DB lease.
        const release = await admin.rpc("release_admin_accountability_job", { p_lease_id: leaseId, p_failed: collectionFailed }).abortSignal(AbortSignal.timeout(2_000));
        if (release.error) result.errors.push("lease_release_unavailable");
      } catch { result.errors.push("lease_release_unavailable"); }
    }
  }
  return result;
}
