import { PortalShell } from "@/components/portal/portal-shell";

export default function PortalBlogsPage() {
  return (
    <PortalShell
      title="Draft blogs"
      summary="Reserved for safe member authoring. Members can create and manage only their own drafts here once the blog content phase is wired."
    >
      <div className="route-grid">
        <article className="route-tile">
          <h3>Safe authoring</h3>
          <p>No access to publishing, audits, migrations, or privileged content tools.</p>
        </article>
        <article className="route-tile">
          <h3>Review handoff</h3>
          <p>Final publication remains moderator/admin-controlled inside the admin queues.</p>
        </article>
      </div>
    </PortalShell>
  );
}
