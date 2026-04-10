import Link from "next/link";
import { requireAuthenticatedUser } from "@/lib/auth/session";
import { getPortalMemberSnapshot } from "@/lib/portal/member";
import { getMemberProjects } from "@/lib/content/projects";
import { PortalShell } from "@/components/portal/portal-shell";
import {
  BookOpen,
  FolderKanban,
  KeyRound,
  Link2,
  ShieldCheck,
  User,
  UserPen,
} from "lucide-react";

export const metadata = { title: "Portal — Member Workspace | JnUITS" };

export default async function PortalOverviewPage() {
  const auth = await requireAuthenticatedUser({ fallbackPath: "/portal" });
  const user = auth.user;
  if (!user) return null;

  const snapshot = await getPortalMemberSnapshot(user.id);
  const member = snapshot.member;

  const memberProjects = member
    ? await getMemberProjects(member.id).catch(() => [])
    : [];

  const pendingRequests = snapshot.workplaceRequests.filter((r) => r.status === "pending").length;

  return (
    <PortalShell
      memberName={member?.full_name ?? null}
      jnuitsId={member?.jnuits_id ?? null}
    >
      {/* Page header */}
      <div className="portal-page-header">
        <div>
          <p className="portal-page-header__breadcrumb">Member Portal</p>
          <h1 className="portal-page-header__title">Welcome back{member ? `, ${member.full_name.split(" ")[0]}` : ""}</h1>
          <p className="portal-page-header__desc">
            Your personal member workspace — profile, tools, and contributions at a glance.
          </p>
        </div>
        {member && (
          <span className="portal-badge portal-badge--member">{member.member_type}</span>
        )}
      </div>

      {/* Stat cards */}
      <div className="portal-stat-grid">
        <div className="portal-stat-card" data-tone={member ? "success" : "danger"}>
          <div className="portal-stat-card__icon"><Link2 size={15} /></div>
          <p className="portal-stat-card__label">Linked profile</p>
          <p className="portal-stat-card__value">{member ? "Active" : "Missing"}</p>
          <p className="portal-stat-card__sub">
            {member ? `${member.jnuits_id} connected` : "No member record linked yet"}
          </p>
        </div>

        <div className="portal-stat-card" data-tone={snapshot.directoryVerified ? "success" : "warning"}>
          <div className="portal-stat-card__icon"><ShieldCheck size={15} /></div>
          <p className="portal-stat-card__label">Directory access</p>
          <p className="portal-stat-card__value">{snapshot.directoryVerified ? "Open" : "Locked"}</p>
          <p className="portal-stat-card__sub">Workplace data visibility</p>
        </div>

        <div className="portal-stat-card">
          <div className="portal-stat-card__icon"><BookOpen size={15} /></div>
          <p className="portal-stat-card__label">Timeline entries</p>
          <p className="portal-stat-card__value">{snapshot.timeline.length}</p>
          <p className="portal-stat-card__sub">Lifecycle events on this account</p>
        </div>

        <div
          className="portal-stat-card"
          data-tone={pendingRequests > 0 ? "warning" : undefined}
        >
          <div className="portal-stat-card__icon"><UserPen size={15} /></div>
          <p className="portal-stat-card__label">Pending requests</p>
          <p className="portal-stat-card__value">{pendingRequests}</p>
          <p className="portal-stat-card__sub">Awaiting admin moderation</p>
        </div>
      </div>

      {/* Quick actions */}
      <div>
        <p className="portal-page-header__breadcrumb" style={{ marginBottom: "0.75rem" }}>Quick actions</p>
        <div className="portal-actions-grid">
          <Link href="/profile" className="portal-quick-action">
            <div className="portal-quick-action__icon"><User size={16} /></div>
            <p className="portal-quick-action__title">My Profile</p>
            <p className="portal-quick-action__desc">View your member identity, directory data, and recent request history.</p>
            <span className="portal-quick-action__arrow">↗</span>
          </Link>

          <Link href="/profile/edit" className="portal-quick-action">
            <div className="portal-quick-action__icon"><UserPen size={16} /></div>
            <p className="portal-quick-action__title">Edit Profile</p>
            <p className="portal-quick-action__desc">Submit workplace updates and profile change requests for admin moderation.</p>
            <span className="portal-quick-action__arrow">↗</span>
          </Link>

          <Link href="/portal/blogs" className="portal-quick-action">
            <div className="portal-quick-action__icon"><BookOpen size={16} /></div>
            <p className="portal-quick-action__title">Draft Blogs</p>
            <p className="portal-quick-action__desc">Write and submit member blog posts for editorial review and publication.</p>
            <span className="portal-quick-action__arrow">↗</span>
          </Link>

          <Link href="/portal/projects" className="portal-quick-action">
            <div className="portal-quick-action__icon"><FolderKanban size={16} /></div>
            <p className="portal-quick-action__title">My Projects</p>
            <p className="portal-quick-action__desc">View all JnUITS projects you have contributed to as a member.</p>
            <span className="portal-quick-action__arrow">↗</span>
          </Link>

          <Link href="/profile/change-password" className="portal-quick-action">
            <div className="portal-quick-action__icon"><KeyRound size={16} /></div>
            <p className="portal-quick-action__title">Change Password</p>
            <p className="portal-quick-action__desc">Update your account password securely within the member portal.</p>
            <span className="portal-quick-action__arrow">↗</span>
          </Link>
        </div>
      </div>

      {/* My projects preview */}
      <div className="portal-section">
        <div className="portal-section__header">
          <div className="portal-section__header-left">
            <div className="portal-section__icon"><FolderKanban size={14} /></div>
            <p className="portal-section__title">My project contributions</p>
          </div>
          {memberProjects.length > 0 && (
            <Link href="/portal/projects" className="portal-badge portal-badge--claimed" style={{ cursor: "pointer" }}>
              View all {memberProjects.length}
            </Link>
          )}
        </div>
        <div className="portal-section__body">
          {memberProjects.length === 0 ? (
            <p style={{ fontSize: "0.86rem", color: "var(--muted)", lineHeight: 1.6 }}>
              You haven&apos;t been added to any JnUITS projects yet. Contact an admin to be assigned as a contributor.
            </p>
          ) : (
            <div className="portal-stat-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(18rem, 1fr))" }}>
              {memberProjects.slice(0, 3).map((project) => (
                <div key={project.id} className="portal-project-card">
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.6rem" }}>
                    <p style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: "0.96rem", letterSpacing: "-0.02em", lineHeight: 1.25 }}>
                      {project.title}
                    </p>
                    <span className={`portal-badge portal-badge--${project.status === "active" ? "verified" : "draft"}`}>
                      {project.status}
                    </span>
                  </div>
                  {project.tagline && (
                    <p style={{ fontSize: "0.8rem", color: "var(--muted)", lineHeight: 1.5 }}>{project.tagline}</p>
                  )}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                    {project.techStack.slice(0, 4).map((tech) => (
                      <span key={tech} className="detail-chip">{tech}</span>
                    ))}
                  </div>
                  <Link href={`/projects/${project.slug}`} className="queue-link" style={{ marginTop: "auto" }}>
                    View project →
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </PortalShell>
  );
}
