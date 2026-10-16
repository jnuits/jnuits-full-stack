import type {AdminNotificationJobHealth} from "@/lib/admin/notifications/model";
import {formatDhakaDateTime} from "@/lib/admin/activity/format";

export function AdminNotificationHealth({health}:{health:AdminNotificationJobHealth|null}) {
  const labels={current:"Daily job receipt recorded",attention:"Operator attention required",delayed:"Daily job receipt delayed",unavailable:"Job health unavailable"};
  return <section aria-label="Notification job health" className="rounded-xl border border-[var(--line)] bg-[var(--card)] p-4 text-sm" data-testid="admin-notification-health">
    <p className="font-semibold">{labels[health?.state||"unavailable"]}</p>
    {health?.lastFinishedAt&&<p>Last finished: {formatDhakaDateTime(health.lastFinishedAt)} (Asia/Dhaka)</p>}
    {health?.lastSuccessfulAt&&<p>Last successful: {formatDhakaDateTime(health.lastSuccessfulAt)} (Asia/Dhaka)</p>}
    {health?.backlog&&<p>Pending work remains for a later bounded run.</p>}
    {!!health?.operatorAttentionCount&&<p>{health.operatorAttentionCount} uncertain delivery records need operator review. Acceptance and delivery are separate.</p>}
    <p className="mt-1 text-xs text-[var(--muted-foreground)]">This receipt describes job processing. Native audit coverage is shown separately in the Audit Explorer.</p>
  </section>;
}
