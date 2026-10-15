import { cookies } from "next/headers";
import Link from "next/link";
import { AlertTriangle, LockKeyhole } from "lucide-react";
import { DirectProfileEditForm } from "@/components/portal/direct-profile-edit-form";
import { PortalShell } from "@/components/portal/portal-shell";
import { ProfileChangeRequestForm } from "@/components/portal/profile-change-request-form";
import { StepUpVerificationForm } from "@/components/portal/step-up-verification-form";
import { WorkplaceRequestHistory } from "@/components/portal/workplace-request-form";
import { AvatarUploadField } from "@/components/profile/avatar-upload-field";
import { ProfileAvatar } from "@/components/profile/profile-avatar";
import { requirePortalUser } from "@/lib/auth/session";
import { isStepUpActiveForUser } from "@/lib/auth/step-up";
import { getActiveDepartmentOptions } from "@/lib/departments.server";
import { formatMembershipIdForDisplay } from "@/lib/members/jnuits-id";
import { getPortalMemberSnapshot } from "@/lib/portal/member";

export async function ProfileEditScreen() {
  const auth = await requirePortalUser({ fallbackPath: "/portal/profile/edit" });
  const user = auth.user;

  if (!user) return null;

  const cookieStore = await cookies();
  const snapshot = await getPortalMemberSnapshot(user.id);
  const stepUpActive = isStepUpActiveForUser(cookieStore, user.id);
  const departments = stepUpActive ? await getActiveDepartmentOptions() : [];
  const member = snapshot.member;
  const displayJnuitsId = formatMembershipIdForDisplay(member?.jnuits_id);

  return (
    <PortalShell
      avatarUrl={member?.avatar_secure_url ?? null}
      jnuitsId={displayJnuitsId || null}
      memberName={member?.full_name ?? null}
      portalRole={user.portalRole}
    >
      <div className="portal-page-header profile-edit-header">
        <div>
          <p className="portal-page-header__breadcrumb">Portal Profile</p>
          <h1 className="portal-page-header__title">Edit Profile</h1>
          <p className="portal-page-header__desc">
            Enter your current password once to unlock profile editing for 15 minutes.
          </p>
        </div>
        {member ? (
          <div className="profile-edit-header-card" aria-label="Current member profile">
            <ProfileAvatar name={member.full_name} src={member.avatar_secure_url ?? null} size="sm" />
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
          <StepUpVerificationForm
            initiallyActive={stepUpActive}
            username={user.email}
          />

          {!stepUpActive ? (
            <section className="profile-edit-card" aria-label="Locked profile details">
              <div className="profile-edit-card__header">
                <div className="profile-edit-card__icon" data-tone="locked">
                  <LockKeyhole size={18} />
                </div>
                <div>
                  <p className="profile-edit-kicker">Privacy protection</p>
                  <h2 className="profile-edit-title">
                    Profile details stay hidden until you unlock editing
                  </h2>
                </div>
              </div>
              <p className="profile-edit-copy">
                Verify your current password above. Your editable information and all
                update forms will then appear on this page—no directory code is needed.
              </p>
            </section>
          ) : (
            <>
              <DirectProfileEditForm
                currentValues={{
                  facebookUrl: member.facebook_url ?? null,
                  linkedinUrl: member.linkedin_url,
                  phone: member.phone,
                  currentOrganization: member.current_organization,
                  designation: member.designation,
                  workLocation: member.work_location,
                  professionalVisibility: member.professional_visibility,
                  websiteUrl: member.website_url,
                }}
                stepUpActive
                workplaceContractReady
                workplaceApplicability={member.workplace_applicability === "applicable" || member.workplace_applicability === "not_applicable" ? member.workplace_applicability : null}
              />

              <AvatarUploadField canUpload currentUrl={member.avatar_secure_url ?? null} displayName={member.full_name} targetId={member.id} targetType="member" showLegacyAvatar={false} />

              <ProfileChangeRequestForm
                currentValues={{
                  departmentCode: member.department_code ?? null,
                  email: member.email,
                  fullName: member.full_name,
                  jnuitsId: displayJnuitsId,
                  studentId: member.student_id ?? null,
                  batchNo: member.batch_no,
                  graduationYear: member.graduation_year ?? null,
                }}
                departments={departments}
                initialRequests={snapshot.profileChangeRequests}
              />

              <WorkplaceRequestHistory initialRequests={snapshot.workplaceRequests} />
            </>
          )}
        </div>
      )}
    </PortalShell>
  );
}
