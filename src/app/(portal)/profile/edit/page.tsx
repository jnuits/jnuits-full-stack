import { DirectoryVerificationForm } from "@/components/portal/directory-verification-form";
import { PortalShell } from "@/components/portal/portal-shell";
import { ProfileChangeRequestForm } from "@/components/portal/profile-change-request-form";
import { WorkplaceRequestForm } from "@/components/portal/workplace-request-form";
import { requireAuthenticatedUser } from "@/lib/auth/session";
import { getPortalMemberSnapshot } from "@/lib/portal/member";

export default async function EditProfilePage() {
  const auth = await requireAuthenticatedUser();
  const user = auth.user;

  if (!user) {
    return null;
  }

  const snapshot = await getPortalMemberSnapshot(user.id);

  return (
    <PortalShell
      title="Edit profile"
      summary="Phase 06 now opens the real safe edit surface: directory verification and workplace updates are live here, while direct sensitive mutation stays gated until step-up policy is completed."
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
          <section className="section-band grid gap-4">
            <span className="eyebrow">Step-up policy</span>
            <h2 className="font-[family-name:var(--font-heading)] text-[clamp(1.8rem,3vw,2.4rem)] leading-[0.96] tracking-[-0.04em]">
              Sensitive direct mutations remain intentionally locked
            </h2>
            <p className="section-copy">
              Until the full step-up verification policy is finished, the portal
              keeps direct identity edits disabled instead of silently weakening
              security. The working self-service lanes below are request-based or
              verification-gated.
            </p>
          </section>

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
