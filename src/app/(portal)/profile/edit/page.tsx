import { cookies } from "next/headers";
import { DirectProfileEditForm } from "@/components/portal/direct-profile-edit-form";
import { DirectoryVerificationForm } from "@/components/portal/directory-verification-form";
import { PortalShell } from "@/components/portal/portal-shell";
import { ProfileChangeRequestForm } from "@/components/portal/profile-change-request-form";
import { StepUpVerificationForm } from "@/components/portal/step-up-verification-form";
import { WorkplaceRequestForm } from "@/components/portal/workplace-request-form";
import { isStepUpActiveForUser } from "@/lib/auth/step-up";
import { requireAuthenticatedUser } from "@/lib/auth/session";
import { getPortalMemberSnapshot } from "@/lib/portal/member";

export default async function EditProfilePage() {
  const auth = await requireAuthenticatedUser({ fallbackPath: "/profile" });
  const user = auth.user;

  if (!user) {
    return null;
  }

  const cookieStore = await cookies();
  const snapshot = await getPortalMemberSnapshot(user.id);
  const stepUpActive = isStepUpActiveForUser(cookieStore, user.id);

  return (
    <PortalShell
      title="Edit profile"
      summary="Directory verification, workplace moderation, and final step-up protected direct edits now live together in one safe member edit surface."
    >
      {!snapshot.member ? (
        <section className="section-band grid gap-4">
          <span className="eyebrow">No member record</span>
          <h2 className="font-[family-name:var(--font-heading)] text-[clamp(1.8rem,3vw,2.4rem)] leading-[0.96] tracking-[-0.04em]">
            Direct profile workflows stay disabled until this account is linked
          </h2>
          <p className="section-copy">
            The signed-in session exists, but safe self-service edits only make
            sense after the account is linked to a member profile.
          </p>
        </section>
      ) : (
        <div className="grid gap-4">
          <StepUpVerificationForm initiallyActive={stepUpActive} />

          <DirectProfileEditForm
            currentValues={{
              fullName: snapshot.member.full_name,
              linkedinUrl: snapshot.member.linkedin_url,
              phone: snapshot.member.phone,
              websiteUrl: snapshot.member.website_url,
            }}
            stepUpActive={stepUpActive}
          />

          <DirectoryVerificationForm
            initiallyVerified={snapshot.directoryVerified}
            jnuitsId={snapshot.member.jnuits_id}
          />

          <ProfileChangeRequestForm
            currentValues={{
              fullName: snapshot.member.full_name,
              linkedinUrl: snapshot.member.linkedin_url,
              phone: snapshot.member.phone,
              websiteUrl: snapshot.member.website_url,
            }}
            initialRequests={snapshot.profileChangeRequests}
          />

          <WorkplaceRequestForm
            currentValues={{
              currentOrganization: snapshot.member.current_organization,
              designation: snapshot.member.designation,
              linkedinUrl: snapshot.member.linkedin_url,
              professionalVisibility: snapshot.member.professional_visibility,
              websiteUrl: snapshot.member.website_url,
              workLocation: snapshot.member.work_location,
            }}
            initialRequests={snapshot.workplaceRequests}
            memberType={snapshot.member.member_type}
          />
        </div>
      )}
    </PortalShell>
  );
}
