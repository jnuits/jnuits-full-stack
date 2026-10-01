import Link from "next/link";
import {
  requestAlumniConversionAction,
  requestProfileDeletionAction,
} from "@/app/(portal)/portal/profile/actions";
import { requirePortalUser } from "@/lib/auth/session";
import { formatMembershipIdForDisplay } from "@/lib/members/jnuits-id";
import { getPortalMemberSnapshot } from "@/lib/portal/member";
import { getPortalAdvisorSnapshot } from "@/lib/portal/advisor";
import { getMemberProjects } from "@/lib/content/projects";
import { formatRenewalState } from "@/lib/membership/anniversary";
import { PortalShell } from "@/components/portal/portal-shell";
import {
  BookOpen,
  FolderKanban,
  GraduationCap,
  KeyRound,
  Link2,
  MessageSquareHeart,
  PauseCircle,
  ShieldCheck,
  Trash2,
  User,
  UserCheck,
  UserPen,
} from "lucide-react";

type PortalOverviewScreenProps = {
  access?: null | string;
  error?: null | string;
  message?: null | string;
};

function resolvePortalMessage(value: null | string) {
  if (value === "alumni-conversion-requested") {
    return "Alumni conversion request submitted for admin review.";
  }

  if (value === "alumni-conversion-pending") {
    return "Your alumni conversion request is already pending.";
  }

  if (value === "profile-deletion-requested") {
    return "Profile deletion request submitted for admin review.";
  }

  if (value === "profile-deletion-pending") {
    return "Your profile deletion request is already pending.";
  }

  if (value === "already-alumni") {
    return "This account is already registered as alumni.";
  }

  return null;
}

function resolvePortalError(value: null | string) {
  if (value === "member-not-linked") {
    return "No linked member profile exists for this account.";
  }

  if (value) {
    return decodeURIComponent(value);
  }

  return null;
}

function resolveRestrictedTitle(access: null | string) {
  if (access === "suspended") {
    return "Portal access suspended";
  }

  if (access === "deletion_requested") {
    return "Profile deletion under review";
  }

  if (access === "former" || access === "frozen") {
    return "Former member profile frozen";
  }

  return "Portal access restricted";
}

export async function PortalOverviewScreen({
  access = null,
  error = null,
  message = null,
}: PortalOverviewScreenProps = {}) {
  const auth = await requirePortalUser({ fallbackPath: "/portal" });
  const user = auth.user;
  if (!user) return null;

  const snapshot = await getPortalMemberSnapshot(user.id);
  const member = snapshot.member;

  if (!member && user.portalRole === "advisor") {
    const advisorSnapshot = await getPortalAdvisorSnapshot(user.id);
    const advisor = advisorSnapshot.advisor;

    return (
      <PortalShell
        avatarUrl={advisor?.avatarSecureUrl ?? null}
        memberName={advisor?.fullName ?? null}
        portalRole="advisor"
      >
        <div className="portal-page-header">
          <div>
            <p className="portal-page-header__breadcrumb">Advisor Portal</p>
            <h1 className="portal-page-header__title">
              Welcome back{advisor ? `, ${advisor.fullName.split(" ")[0]}` : ""}
            </h1>
            <p className="portal-page-header__desc">
              Your advisor workspace for maintaining profile context, public messages, publications, and blog drafts.
            </p>
          </div>
          {advisor ? (
            <span className="portal-badge portal-badge--member">
              {advisor.advisorType.replaceAll("_", " ")}
            </span>
          ) : null}
        </div>

        <div className="portal-stat-grid">
          <div className="portal-stat-card" data-tone={advisor ? "success" : "danger"}>
            <div className="portal-stat-card__icon"><GraduationCap size={15} /></div>
            <p className="portal-stat-card__label">Advisor profile</p>
            <p className="portal-stat-card__value">{advisor ? "Linked" : "Missing"}</p>
            <p className="portal-stat-card__sub">
              {advisor?.department || "Teacher advisor identity"}
            </p>
          </div>
          <div className="portal-stat-card" data-tone={advisor?.isPublic ? "success" : "warning"}>
            <div className="portal-stat-card__icon"><ShieldCheck size={15} /></div>
            <p className="portal-stat-card__label">Public board</p>
            <p className="portal-stat-card__value">{advisor?.isPublic ? "Visible" : "Private"}</p>
            <p className="portal-stat-card__sub">Committee admin controlled</p>
          </div>
          <div className="portal-stat-card">
            <div className="portal-stat-card__icon"><BookOpen size={15} /></div>
            <p className="portal-stat-card__label">Publications</p>
            <p className="portal-stat-card__value">{advisor?.publications.length || 0}</p>
            <p className="portal-stat-card__sub">Profile highlights</p>
          </div>
          <div className="portal-stat-card" data-tone={advisor?.speech ? "success" : undefined}>
            <div className="portal-stat-card__icon"><MessageSquareHeart size={15} /></div>
            <p className="portal-stat-card__label">Advisor message</p>
            <p className="portal-stat-card__value">{advisor?.speech ? "Set" : "Empty"}</p>
            <p className="portal-stat-card__sub">Shown on public committee</p>
          </div>
        </div>

        <div>
          <p className="portal-page-header__breadcrumb" style={{ marginBottom: "0.75rem" }}>Quick actions</p>
          <div className="portal-actions-grid">
            <Link href="/portal/advisor/profile" className="portal-quick-action">
              <div className="portal-quick-action__icon"><GraduationCap size={16} /></div>
              <p className="portal-quick-action__title">Advisor Profile</p>
              <p className="portal-quick-action__desc">Update your message, bio, work experience, publications, and public links.</p>
              <span className="portal-quick-action__arrow">↗</span>
            </Link>

            <Link href="/portal/blogs" className="portal-quick-action">
              <div className="portal-quick-action__icon"><BookOpen size={16} /></div>
              <p className="portal-quick-action__title">Draft Blogs</p>
              <p className="portal-quick-action__desc">Write and submit advisor blog posts for editorial review.</p>
              <span className="portal-quick-action__arrow">↗</span>
            </Link>

            <Link href="/portal/profile/change-password" className="portal-quick-action">
              <div className="portal-quick-action__icon"><KeyRound size={16} /></div>
              <p className="portal-quick-action__title">Change Password</p>
              <p className="portal-quick-action__desc">Update your login password from the shared portal account.</p>
              <span className="portal-quick-action__arrow">↗</span>
            </Link>
          </div>
        </div>
      </PortalShell>
    );
  }

  const memberProjects = member
    ? await getMemberProjects(member.id).catch(() => [])
    : [];

  const pendingRequests = snapshot.workplaceRequests.filter((r) => r.status === "pending").length;
  const pendingAlumniConversion = snapshot.accountRequests.some(
    (request) =>
      request.request_type === "alumni_conversion" && request.status === "pending"
  );
  const pendingDeletion = snapshot.accountRequests.some(
    (request) =>
      request.request_type === "account_deletion" && request.status === "pending"
  );
  const feedbackMessage = resolvePortalMessage(message);
  const feedbackError = resolvePortalError(error);
  const accessStatus = snapshot.access.portalAccessStatus || access;
  const isRestricted = Boolean(member && snapshot.access.isRestricted);
  const displayJnuitsId = formatMembershipIdForDisplay(member?.jnuits_id);
  const renewalWarning = snapshot.membership?.renewalState === "grace"
    ? formatRenewalState({ state: "grace", dueOn: snapshot.membership.renewalDueOn, graceEndsOn: snapshot.membership.graceEndsOn }) : null;

  return (
    <PortalShell
      avatarUrl={member?.avatar_secure_url ?? null}
      memberName={member?.full_name ?? null}
      jnuitsId={displayJnuitsId || null}
      portalRole={user.portalRole}
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
          <span className="portal-badge portal-badge--member">
            {member.member_type}
          </span>
        )}
      </div>

      {feedbackMessage ? (
        <div className="flash-panel" data-tone="success">
          <p style={{ fontSize: "0.84rem", lineHeight: 1.6 }}>{feedbackMessage}</p>
        </div>
      ) : null}
      {renewalWarning ? <section className="flash-panel" data-tone="warning" role="status">
        <h2 className="font-semibold">{renewalWarning.label}</h2>
        <p className="mt-2 text-sm leading-7">{renewalWarning.description}</p>
        <Link href="/portal/membership" className="queue-link">Manage renewal</Link>
      </section> : null}
      {feedbackError ? (
        <div className="flash-panel" data-tone="error">
          <p style={{ fontSize: "0.84rem", lineHeight: 1.6 }}>{feedbackError}</p>
        </div>
      ) : null}

      {isRestricted ? (
        <div className="portal-section">
          <div className="portal-section__header">
            <div className="portal-section__header-left">
              <div className="portal-section__icon"><PauseCircle size={14} /></div>
              <p className="portal-section__title">
                {resolveRestrictedTitle(accessStatus)}
              </p>
            </div>
            <span className="portal-badge portal-badge--locked">
              {snapshot.access.portalAccessStatus || snapshot.access.lifecycleStatus}
            </span>
          </div>
          <div className="portal-section__body">
            <p style={{ color: "var(--muted-foreground)", fontSize: "0.88rem", lineHeight: 1.7 }}>
              Your profile is currently read-only. You can keep it frozen, request alumni access,
              or ask admins to delete the public JnUITS profile after review.
            </p>
            <div
              style={{
                display: "grid",
                gap: "0.9rem",
                gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 16rem), 1fr))",
                marginTop: "1rem",
              }}
            >
              <Link href="/portal/profile" className="portal-quick-action">
                <div className="portal-quick-action__icon"><PauseCircle size={16} /></div>
                <p className="portal-quick-action__title">Keep frozen</p>
                <p className="portal-quick-action__desc">
                  View profile and timeline in read-only mode.
                </p>
                <span className="portal-quick-action__arrow">↗</span>
              </Link>

              <form action={requestAlumniConversionAction} className="portal-quick-action">
                <div className="portal-quick-action__icon"><UserCheck size={16} /></div>
                <p className="portal-quick-action__title">Join alumni</p>
                <p className="portal-quick-action__desc">
                  Request conversion to alumni access.
                </p>
                <input name="note" type="hidden" value="Requested from frozen portal onboarding." />
                <button
                  className="secondary-button"
                  disabled={pendingAlumniConversion}
                  style={{ justifyContent: "center", marginTop: "auto" }}
                  type="submit"
                >
                  {pendingAlumniConversion ? "Pending review" : "Request alumni"}
                </button>
              </form>

              <form action={requestProfileDeletionAction} className="portal-quick-action">
                <div className="portal-quick-action__icon"><Trash2 size={16} /></div>
                <p className="portal-quick-action__title">Delete profile</p>
                <p className="portal-quick-action__desc">
                  Submit an admin-reviewed deletion request.
                </p>
                <input name="note" type="hidden" value="Requested from frozen portal onboarding." />
                <button
                  className="secondary-button"
                  disabled={pendingDeletion}
                  style={{ justifyContent: "center", marginTop: "auto" }}
                  type="submit"
                >
                  {pendingDeletion ? "Pending review" : "Request deletion"}
                </button>
              </form>
            </div>
          </div>
        </div>
      ) : null}

      {isRestricted ? null : (
        <>

      {/* Stat cards */}
      <div className="portal-stat-grid">
        <div className="portal-stat-card" data-tone={member ? "success" : "danger"}>
          <div className="portal-stat-card__icon"><Link2 size={15} /></div>
          <p className="portal-stat-card__label">Linked profile</p>
          <p className="portal-stat-card__value">{member ? "Active" : "Missing"}</p>
          <p className="portal-stat-card__sub">
            {member ? `${displayJnuitsId} connected` : "No member record linked yet"}
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
          <Link href="/portal/profile" className="portal-quick-action">
            <div className="portal-quick-action__icon"><User size={16} /></div>
            <p className="portal-quick-action__title">My Profile</p>
            <p className="portal-quick-action__desc">View your member identity, directory data, and recent request history.</p>
            <span className="portal-quick-action__arrow">↗</span>
          </Link>

          <Link href="/portal/profile/edit" className="portal-quick-action">
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

          <Link href="/portal/profile/change-password" className="portal-quick-action">
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
            <p style={{ fontSize: "0.86rem", color: "var(--muted-foreground)", lineHeight: 1.6 }}>
              You haven&apos;t been added to any JnUITS projects yet. Contact an admin to be assigned as a contributor.
            </p>
          ) : (
            <div className="portal-stat-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 18rem), 1fr))" }}>
              {memberProjects.slice(0, 3).map((project) => (
                <div key={project.id} className="portal-project-card">
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.6rem", flexWrap: "wrap" }}>
                    <p style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: "0.96rem", letterSpacing: "-0.02em", lineHeight: 1.25 }}>
                      {project.title}
                    </p>
                    <span className={`portal-badge portal-badge--${project.status === "active" ? "verified" : "draft"}`}>
                      {project.status}
                    </span>
                  </div>
                  {project.tagline && (
                    <p style={{ fontSize: "0.8rem", color: "var(--muted-foreground)", lineHeight: 1.5 }}>{project.tagline}</p>
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
        </>
      )}
    </PortalShell>
  );
}
