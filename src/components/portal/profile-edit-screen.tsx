import { cookies } from "next/headers";
import Link from "next/link";
import { DirectProfileEditForm } from "@/components/portal/direct-profile-edit-form";
import { DirectoryVerificationForm } from "@/components/portal/directory-verification-form";
import { PortalShell } from "@/components/portal/portal-shell";
import { ProfileChangeRequestForm } from "@/components/portal/profile-change-request-form";
import { StepUpVerificationForm } from "@/components/portal/step-up-verification-form";
import { WorkplaceRequestForm } from "@/components/portal/workplace-request-form";
import { isStepUpActiveForUser } from "@/lib/auth/step-up";
import { requirePortalUser } from "@/lib/auth/session";
import { formatMembershipIdForDisplay } from "@/lib/members/jnuits-id";
import { getPortalMemberSnapshot } from "@/lib/portal/member";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  FileText,
  Info,
  LockKeyhole,
  ShieldCheck,
  UserRoundCog,
} from "lucide-react";

export async function ProfileEditScreen() {
  const auth = await requirePortalUser({ fallbackPath: "/portal/profile/edit" });
  const user = auth.user;

  if (!user) return null;

  const cookieStore = await cookies();
  const snapshot = await getPortalMemberSnapshot(user.id);
  const stepUpActive = isStepUpActiveForUser(cookieStore, user.id);
  const member = snapshot.member;
  const displayJnuitsId = formatMembershipIdForDisplay(member?.jnuits_id);
  const pendingProfileRequests = snapshot.profileChangeRequests.filter(
    (request) => request.status === "pending"
  ).length;
  const pendingWorkplaceRequests = snapshot.workplaceRequests.filter(
    (request) => request.status === "pending"
  ).length;
  const memberInitials =
    member?.full_name
      .split(" ")
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "M";

  return (
    <PortalShell
      jnuitsId={displayJnuitsId || null}
      memberName={member?.full_name ?? null}
      portalRole={user.portalRole}
    >
      <div className="portal-page-header profile-edit-header">
        <div>
          <p className="portal-page-header__breadcrumb">Portal Profile</p>
          <h1 className="portal-page-header__title">Edit Profile</h1>
          <p className="portal-page-header__desc">
            Secure direct edits, directory verification, and moderated profile requests.
          </p>
        </div>
        {member ? (
          <div className="profile-edit-header-card" aria-label="Current member profile">
            <div className="profile-edit-header-card__avatar" aria-hidden="true">
              {memberInitials}
            </div>
            <div>
              <p className="profile-edit-header-card__name">{member.full_name}</p>
              <p className="profile-edit-header-card__meta">
                {displayJnuitsId || "JnUITS ID pending"} · {member.member_type}
              </p>
            </div>
          </div>
        ) : null}
      </div>

      {!member ? (
        <div className="profile-edit-card profile-edit-card--empty">
          <div className="profile-edit-card__header">
            <div className="profile-edit-card__icon" data-tone="warning">
              <AlertTriangle size={18} />
            </div>
            <div>
              <p className="profile-edit-kicker">Account setup</p>
              <h2 className="profile-edit-title">No member record linked</h2>
            </div>
          </div>
          <p className="profile-edit-copy">
            Self-service edits require a linked member profile. Contact an admin to
            link this account, or use the claim flow if you have a JnUITS ID.
          </p>
          <div className="profile-edit-actions">
            <Link href="/portal/profile" className="secondary-button">
              Back to profile
            </Link>
          </div>
        </div>
      ) : (
        <div className="profile-edit-shell">
          <section className="profile-edit-command" aria-label="Profile edit status">
            <div className="profile-edit-command__intro">
              <span className="profile-edit-card__icon" data-tone="info">
                <Info size={18} />
              </span>
              <div>
                <p className="profile-edit-kicker">Profile control center</p>
                <h2 className="profile-edit-command__title">
                  Choose the right lane for each profile change
                </h2>
                <p className="profile-edit-copy">
                  Step-up unlocks direct low-risk edits. Identity, directory, and
                  workplace changes stay reviewable when they need moderation.
                </p>
              </div>
            </div>

            <div className="profile-edit-command__steps">
              <div
                className="profile-edit-step"
                data-state={stepUpActive ? "complete" : "locked"}
              >
                {stepUpActive ? <CheckCircle2 size={16} /> : <LockKeyhole size={16} />}
                <span>Direct edits</span>
                <strong>{stepUpActive ? "Unlocked" : "Locked"}</strong>
              </div>
              <div
                className="profile-edit-step"
                data-state={snapshot.directoryVerified ? "complete" : "locked"}
              >
                {snapshot.directoryVerified ? (
                  <ShieldCheck size={16} />
                ) : (
                  <LockKeyhole size={16} />
                )}
                <span>Directory</span>
                <strong>{snapshot.directoryVerified ? "Verified" : "Needs code"}</strong>
              </div>
              <div
                className="profile-edit-step"
                data-state={pendingProfileRequests > 0 ? "pending" : "idle"}
              >
                {pendingProfileRequests > 0 ? <Clock3 size={16} /> : <FileText size={16} />}
                <span>Profile queue</span>
                <strong>
                  {pendingProfileRequests > 0
                    ? `${pendingProfileRequests} pending`
                    : "Ready"}
                </strong>
              </div>
              <div
                className="profile-edit-step"
                data-state={pendingWorkplaceRequests > 0 ? "pending" : "idle"}
              >
                {pendingWorkplaceRequests > 0 ? (
                  <Clock3 size={16} />
                ) : (
                  <UserRoundCog size={16} />
                )}
                <span>Workplace queue</span>
                <strong>
                  {pendingWorkplaceRequests > 0
                    ? `${pendingWorkplaceRequests} pending`
                    : member.member_type === "alumni"
                      ? "Ready"
                      : "Alumni only"}
                </strong>
              </div>
            </div>
          </section>

          <StepUpVerificationForm
            initiallyActive={stepUpActive}
            username={user.email}
          />

          <div className="profile-edit-grid">
            <DirectProfileEditForm
              currentValues={{
                fullName: member.full_name,
                linkedinUrl: member.linkedin_url,
                phone: member.phone,
                websiteUrl: member.website_url,
              }}
              stepUpActive={stepUpActive}
            />

            <DirectoryVerificationForm
              initiallyVerified={snapshot.directoryVerified}
              jnuitsId={displayJnuitsId}
            />
          </div>

          <ProfileChangeRequestForm
            currentValues={{
              email: member.email,
              fullName: member.full_name,
              jnuitsId: displayJnuitsId,
              linkedinUrl: member.linkedin_url,
              phone: member.phone,
              websiteUrl: member.website_url,
            }}
            initialRequests={snapshot.profileChangeRequests}
          />

          <WorkplaceRequestForm
            currentValues={{
              currentOrganization: member.current_organization,
              designation: member.designation,
              linkedinUrl: member.linkedin_url,
              professionalVisibility: member.professional_visibility,
              websiteUrl: member.website_url,
              workLocation: member.work_location,
            }}
            initialRequests={snapshot.workplaceRequests}
            memberType={member.member_type}
          />
        </div>
      )}
    </PortalShell>
  );
}
