import Link from "next/link";
import { PortalShell } from "@/components/portal/portal-shell";
import { requirePortalUser } from "@/lib/auth/session";
import { getPortalMemberSnapshot } from "@/lib/portal/member";
import { getMemberProjects } from "@/lib/content/projects";
import { FolderKanban, GitBranch, Globe, Info } from "lucide-react";

export const metadata = { title: "My Projects | JnUITS Member Portal" };

export default async function PortalProjectsPage() {
  const auth = await requirePortalUser({ fallbackPath: "/portal/projects" });
  if (!auth.user) return null;

  const snapshot = await getPortalMemberSnapshot(auth.user.id);
  const member = snapshot.member;

  const projects = member
    ? await getMemberProjects(member.id).catch(() => [])
    : [];

  return (
    <PortalShell
      avatarUrl={member?.avatar_secure_url ?? null}
      memberName={member?.full_name ?? null}
      jnuitsId={member?.jnuits_id ?? null}
      portalRole={auth.user.portalRole}
    >
      {/* Page header */}
      <div className="portal-page-header">
        <div>
          <p className="portal-page-header__breadcrumb">Member Services</p>
          <h1 className="portal-page-header__title">My Projects</h1>
          <p className="portal-page-header__desc">
            JnUITS projects you have contributed to as a team member.
          </p>
        </div>
        <span className="portal-badge portal-badge--draft">{projects.length} projects</span>
      </div>

      {/* No member */}
      {!member ? (
        <div className="portal-section">
          <div className="portal-section__header">
            <div className="portal-section__header-left">
              <div className="portal-section__icon"><Info size={14} /></div>
              <p className="portal-section__title">Account not linked</p>
            </div>
          </div>
          <div className="portal-section__body">
            <p style={{ fontSize: "0.88rem", color: "var(--muted-foreground)", lineHeight: 1.7 }}>
              A linked member record is required to view project contributions.
              Contact an admin to link your account.
            </p>
          </div>
        </div>
      ) : projects.length === 0 ? (
        /* Empty state */
        <div className="portal-section">
          <div className="portal-section__header">
            <div className="portal-section__header-left">
              <div className="portal-section__icon"><FolderKanban size={14} /></div>
              <p className="portal-section__title">No project contributions yet</p>
            </div>
          </div>
          <div className="portal-section__body">
            <p style={{ fontSize: "0.88rem", color: "var(--muted-foreground)", lineHeight: 1.7 }}>
              You haven&apos;t been assigned to any JnUITS projects yet. Once an admin
              adds you as a contributor on a project, it will appear here with its full details.
            </p>
            <div style={{ marginTop: "1rem" }}>
              <Link href="/projects" target="_blank" className="secondary-button" style={{ display: "inline-flex" }}>
                Browse public projects ↗
              </Link>
            </div>
          </div>
        </div>
      ) : (
        /* Project grid */
        <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 21rem), 1fr))" }}>
          {projects.map((project) => (
            <div key={project.id} className="portal-project-card">
              {/* Header */}
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.65rem" }}>
                <h2
                  style={{
                    fontFamily: "var(--font-heading), sans-serif",
                    fontSize: "1rem",
                    fontWeight: 800,
                    letterSpacing: "-0.03em",
                    lineHeight: 1.25,
                    flex: 1,
                  }}
                >
                  {project.title}
                </h2>
                <span
                  className={`portal-badge portal-badge--${
                    project.status === "active" ? "verified" :
                    project.status === "completed" ? "claimed" :
                    "draft"
                  }`}
                >
                  {project.status}
                </span>
              </div>

              {/* Tagline */}
              {project.tagline && (
                <p style={{ fontSize: "0.82rem", color: "var(--muted-foreground)", lineHeight: 1.6 }}>
                  {project.tagline}
                </p>
              )}

              {/* Tech stack */}
              {project.techStack && project.techStack.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.38rem" }}>
                  {project.techStack.slice(0, 6).map((tech) => (
                    <span key={tech} className="detail-chip">{tech}</span>
                  ))}
                </div>
              )}

              {/* Category */}
              {project.category && (
                <div className="portal-info-row" style={{ padding: "0.55rem 0.8rem" }}>
                  <span className="portal-info-row__label">Category</span>
                  <span className="portal-info-row__value" style={{ fontSize: "0.82rem", textTransform: "capitalize" }}>
                    {project.category.replaceAll("_", " ")}
                  </span>
                </div>
              )}

              {/* Links */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.8rem",
                  marginTop: "auto",
                  paddingTop: "0.6rem",
                  borderTop: "1px solid var(--line)",
                  flexWrap: "wrap",
                }}
              >
                <Link href={`/projects/${project.slug}`} className="queue-link">
                  <FolderKanban size={12} /> View project
                </Link>
                {project.githubUrl && (
                  <a
                    href={project.githubUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="queue-link"
                  >
                    <GitBranch size={12} /> GitHub
                  </a>
                )}
                {project.demoUrl && (
                  <a
                    href={project.demoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="queue-link"
                  >
                    <Globe size={12} /> Live demo
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </PortalShell>
  );
}
