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
import { getPortalMemberSnapshot } from "@/lib/portal/member";
import { AlertTriangle, Info } from "lucide-react";

export async function ProfileEditScreen() {
  const auth = await requirePortalUser({ fallbackPath: "/portal/profile/edit" });
  const user = auth.user;

  if (!user) return null;

  const cookieStore = await cookies();
  const snapshot = await getPortalMemberSnapshot(user.id);
  const stepUpActive = isStepUpActiveForUser(cookieStore, user.id);
  const member = snapshot.member;

  return (
    <PortalShell
      jnuitsId={member?.jnuits_id ?? null}
      memberName={member?.full_name ?? null}
      portalRole={user.portalRole}
    >
      <div className="portal-page-header">
        <div>
          <p className="portal-page-header__breadcrumb">Portal Profile</p>
          <h1 className="portal-page-header__title">Edit Profile</h1>
          <p className="portal-page-header__desc">
            Directory verification, workplace requests, and step-up protected direct edits.
          </p>
        </div>
      </div>

      {!member ? (
        <div className="portal-section">
          <div className="portal-section__header">
            <div className="portal-section__header-left">
              <div className="portal-section__icon"><AlertTriangle size={14} /></div>
              <p className="portal-section__title">No member record linked</p>
            </div>
          </div>
          <div className="portal-section__body">
            <p style={{ color: "var(--muted-foreground)", fontSize: "0.88rem", lineHeight: 1.7 }}>
              Self-service edits require a linked member profile. Contact an admin to
              link this account, or use the claim flow if you have a JNUITS ID.
            </p>
            <div style={{ marginTop: "1rem" }}>
              <Link href="/portal/profile" className="secondary-button" style={{ display: "inline-flex" }}>
                Back to profile
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <div className="flash-panel" style={{ alignItems: "flex-start", display: "flex", gap: "0.6rem" }}>
            <Info size={14} style={{ color: "var(--brand-blue)", flexShrink: 0, marginTop: "0.15rem" }} />
            <p style={{ color: "var(--muted-foreground)", fontSize: "0.83rem", lineHeight: 1.7 }}>
              Step-up verification unlocks direct edits. Workplace and profile change requests go
              through admin moderation and may take 24–48 hours to reflect publicly.
            </p>
          </div>

          <StepUpVerificationForm initiallyActive={stepUpActive} />

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
            jnuitsId={member.jnuits_id}
          />

          <ProfileChangeRequestForm
            currentValues={{
              email: member.email,
              fullName: member.full_name,
              jnuitsId: member.jnuits_id,
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
