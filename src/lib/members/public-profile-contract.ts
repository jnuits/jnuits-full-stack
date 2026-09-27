import type {
  PublicCommitteeAppointment,
  PublicCommitteeMemberProfile,
} from "@/lib/committee/public-contracts";
import type { MemberDirectoryEntry } from "@/lib/members/directory";

type PublicMemberProfileBase = {
  avatarSecureUrl: string | null;
  committeeAppointments: PublicCommitteeAppointment[];
  departmentName: string | null;
  fullName: string;
  jnuitsId: string;
};

export type PublicDirectoryMemberProfile = PublicMemberProfileBase &
  Pick<
    MemberDirectoryEntry,
    | "batchNo"
    | "departmentCode"
    | "facebookUrl"
    | "linkedinUrl"
    | "memberType"
    | "websiteUrl"
    | "workplace"
  > & {
    scope: "directory";
  };

export type PublicCommitteeOnlyMemberProfile = PublicMemberProfileBase & {
  scope: "committee";
};

export type PublicMemberProfile =
  | PublicCommitteeOnlyMemberProfile
  | PublicDirectoryMemberProfile;

export function composePublicMemberProfile(
  directoryProfile: MemberDirectoryEntry | null,
  committeeProfile: PublicCommitteeMemberProfile | null
): PublicMemberProfile | null {
  if (directoryProfile) {
    return {
      avatarSecureUrl: directoryProfile.avatarSecureUrl,
      batchNo: directoryProfile.batchNo,
      committeeAppointments: committeeProfile?.appointments || [],
      departmentCode: directoryProfile.departmentCode,
      departmentName: directoryProfile.departmentName,
      facebookUrl: directoryProfile.facebookUrl,
      fullName: directoryProfile.fullName,
      jnuitsId: directoryProfile.jnuitsId,
      linkedinUrl: directoryProfile.linkedinUrl,
      memberType: directoryProfile.memberType,
      scope: "directory",
      websiteUrl: directoryProfile.websiteUrl,
      workplace: {
        currentOrganization: directoryProfile.workplace.currentOrganization,
        designation: directoryProfile.workplace.designation,
        visibility: directoryProfile.workplace.visibility,
        visible: directoryProfile.workplace.visible,
        workLocation: directoryProfile.workplace.workLocation,
      },
    };
  }

  if (!committeeProfile || committeeProfile.appointments.length === 0) {
    return null;
  }

  return {
    avatarSecureUrl: committeeProfile.avatarUrl,
    committeeAppointments: [...committeeProfile.appointments],
    departmentName: committeeProfile.departmentName,
    fullName: committeeProfile.displayName,
    jnuitsId: committeeProfile.jnuitsId,
    scope: "committee",
  };
}
