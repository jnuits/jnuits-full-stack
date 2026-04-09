import Link from "next/link";
import { PortalShell } from "@/components/portal/portal-shell";
import { requireAuthenticatedUser } from "@/lib/auth/session";
import { getPortalMemberSnapshot } from "@/lib/portal/member";

export default async function PortalOverviewPage() {
  const auth = await requireAuthenticatedUser({ fallbackPath: "/portal" });
  const user = auth.user;

  if (!user) {
    return null;
  }

  const snapshot = await getPortalMemberSnapshot(user.id);

  return (
    <PortalShell
      title="Member portal overview"
      summary="This is the safe surface for claimed members, executive/sub-executive users, and general members. It now starts exposing real member-linked context instead of placeholder tiles, while operator-grade tools remain inside the technical admin workspace."
    >
      <section className="grid gap-4 md:grid-cols-3">
        <article className="metric-card">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--muted)]">
            Linked profile
          </p>
          <p className="metric-card__value mt-3">
            {snapshot.member ? "Ready" : "Missing"}
          </p>
          <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
            {snapshot.member
              ? `${snapshot.member.jnuits_id} is connected to this signed-in account.`
              : "This account is signed in, but no member record is linked yet."}
          </p>
        </article>
        <article className="metric-card">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--muted)]">
            Directory gate
          </p>
          <p className="metric-card__value mt-3">
            {snapshot.directoryVerified ? "Open" : "Locked"}
          </p>
          <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
            Sensitive workplace data remains hidden until directory verification
            succeeds in this browser.
          </p>
        </article>
        <article className="metric-card">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--muted)]">
            Timeline entries
          </p>
          <p className="metric-card__value mt-3">{snapshot.timeline.length}</p>
          <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
            Lifecycle history is now connected to the claimed member account and
            available from the portal surface.
          </p>
        </article>
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
    </PortalShell>
  );
}
