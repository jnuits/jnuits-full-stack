import { PortalShell } from "@/components/portal/portal-shell";

export default function PortalOverviewPage() {
  return (
    <PortalShell
      title="Member portal overview"
      summary="This is the safe surface for claimed members, executive/sub-executive users, and general members. Blog drafting lives here, while powerful moderation and migration tools remain inside the technical admin workspace."
    >
      <div className="route-grid">
        <article className="route-tile">
          <h3>Profile management</h3>
          <p>View and update personal and member-facing fields without exposing raw operator controls.</p>
        </article>
        <article className="route-tile">
          <h3>Workplace moderation</h3>
          <p>Alumni workplace requests move through review instead of direct edits, preserving auditability.</p>
        </article>
        <article className="route-tile">
          <h3>Blog drafting</h3>
          <p>Committee members will draft articles from a role-limited workspace, not <code>/admin</code>.</p>
        </article>
        <article className="route-tile">
          <h3>Step-up verification</h3>
          <p>Sensitive profile updates are planned to require fresh password verification before mutation.</p>
        </article>
      </div>
    </PortalShell>
  );
}
