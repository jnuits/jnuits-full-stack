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
          <p>View and update personal/member fields without exposing raw admin controls.</p>
        </article>
        <article className="route-tile">
          <h3>Workplace moderation</h3>
          <p>Alumni workplace requests feed a dedicated moderation queue rather than direct edits.</p>
        </article>
        <article className="route-tile">
          <h3>Blog drafting</h3>
          <p>Committee members draft articles from a role-limited workspace, not `/admin`.</p>
        </article>
      </div>
    </PortalShell>
  );
}
