import { PortalShell } from "@/components/portal/portal-shell";

export default function ProfilePage() {
  return (
    <PortalShell
      title="Profile view"
      summary="Profile, timeline, verification gate status, and member-linked identity will live here after the Supabase membership schema is applied."
    >
      <div className="route-grid">
        <article className="route-tile">
          <h3>Directory gate</h3>
          <p>Sensitive workplace fields stay behind the short-lived verification cookie.</p>
        </article>
        <article className="route-tile">
          <h3>Timeline</h3>
          <p>Lifecycle events and committee-role history will flow from normalized event tables.</p>
        </article>
      </div>
    </PortalShell>
  );
}
