import Link from "next/link";
import { MetricCard } from "@/components/ui/metric-card";
import { PortalShell } from "@/components/portal/portal-shell";
import { requireAuthenticatedUser } from "@/lib/auth/session";
import { getPortalMemberSnapshot } from "@/lib/portal/member";
import { getMemberProjects } from "@/lib/content/projects";

export default async function PortalOverviewPage() {
  const auth = await requireAuthenticatedUser({ fallbackPath: "/portal" });
  const user = auth.user;

  if (!user) {
    return null;
  }

  const [snapshot, memberProjects] = await Promise.all([
    getPortalMemberSnapshot(user.id),
    getMemberProjects(user.id).catch(() => []),
  ]);

  return (
    <PortalShell
      title="Member portal overview"
      summary="Your personal portal surface — view your linked profile, check your directory status, and access safe self-service tools for workplace and profile updates."
    >
      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard
          label="Linked profile"
          value={snapshot.member ? "Ready" : "Missing"}
          description={
            snapshot.member
              ? `${snapshot.member.jnuits_id} is connected to this signed-in account.`
              : "This account is signed in, but no member record is linked yet."
          }
          tone={snapshot.member ? "success" : "danger"}
        />
        <MetricCard
          label="Directory gate"
          value={snapshot.directoryVerified ? "Open" : "Locked"}
          description="Sensitive workplace data stays hidden until directory verification succeeds in this browser."
          tone={snapshot.directoryVerified ? "success" : "default"}
        />
        <MetricCard
          label="Timeline entries"
          value={snapshot.timeline.length}
          description="Lifecycle events linked to your claimed member account."
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(18rem,0.95fr)]">
        <article className="section-band">
          <span className="eyebrow">Safe next actions</span>
          <div className="mt-5 route-grid">
            <Link className="route-tile" href="/profile">
              <h3>Open profile</h3>
              <p>Review linked member identity, visibility status, and recent timeline activity.</p>
            </Link>
            <Link className="route-tile" href="/profile/edit">
              <h3>Request workplace changes</h3>
              <p>Use the moderated self-service lane instead of touching raw records or admin tools.</p>
            </Link>
            <Link className="route-tile" href="/profile/change-password">
              <h3>Change password</h3>
              <p>Stay inside the portal for secure password updates and reauthentication if needed.</p>
            </Link>
            <Link className="route-tile" href="/portal/blogs">
              <h3>Draft blogs</h3>
              <p>Role-limited authoring remains separate from privileged publication and moderation controls.</p>
            </Link>
          </div>
        </article>

        <article className="section-band">
          <span className="eyebrow">Portal state</span>
          <div className="mt-5 grid gap-3">
            <div className="timeline-item">
              <strong className="font-[family-name:var(--font-heading)] text-lg">
                Linked member type
              </strong>
              <p className="mt-2 text-sm text-[var(--muted)]">
                {snapshot.member?.member_type || "No linked member"}
              </p>
            </div>
            <div className="timeline-item">
              <strong className="font-[family-name:var(--font-heading)] text-lg">
                Pending workplace requests
              </strong>
              <p className="mt-2 text-sm text-[var(--muted)]">
                {
                  snapshot.workplaceRequests.filter((request) => request.status === "pending")
                    .length
                }{" "}
                request(s) currently waiting for moderation.
              </p>
            </div>
          </div>
        </article>
      </section>

      {/* My Projects */}
      <section className="section-band">
        <span className="eyebrow">My project contributions</span>
        <h2 className="mt-4 font-[family-name:var(--font-heading)] text-[clamp(1.6rem,2.5vw,2.2rem)] leading-[1.02] tracking-[-0.04em]">
          {memberProjects.length === 0
            ? "No project contributions yet"
            : `${memberProjects.length} project${memberProjects.length === 1 ? "" : "s"}`}
        </h2>
        {memberProjects.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--muted)]">
            Contact an admin to be added to a JnUITS project. Your contributions will appear here.
          </p>
        ) : (
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {memberProjects.slice(0, 3).map((project) => (
              <article key={project.id} className="application-card flex flex-col gap-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h3 className="font-[family-name:var(--font-heading)] text-xl leading-tight">
                    {project.title}
                  </h3>
                  <span className="status-pill shrink-0">{project.category}</span>
                </div>
                {project.tagline ? (
                  <p className="text-xs text-[var(--muted)]">{project.tagline}</p>
                ) : null}
                <div className="flex flex-wrap gap-1.5">
                  {project.techStack.slice(0, 4).map((tech) => (
                    <span key={tech} className="detail-chip text-xs">{tech}</span>
                  ))}
                </div>
                <div className="mt-auto flex flex-wrap gap-2">
                  <Link href={`/projects/${project.slug}`} className="queue-link">
                    View project
                  </Link>
                  <span className="detail-chip" style={{ background: project.status === "active" ? "color-mix(in oklab,#22c55e 12%,transparent)" : undefined }}>
                    {project.status}
                  </span>
                </div>
              </article>
            ))}
          </div>
        )}
        {memberProjects.length > 3 ? (
          <Link href="/projects" className="secondary-button mt-4 inline-block">
            View all {memberProjects.length} projects →
          </Link>
        ) : null}
      </section>
    </PortalShell>
  );
}
