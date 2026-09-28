import { describe, expect, it } from "vitest";

import type { PublicCommitteeMemberProfile } from "@/lib/committee/public-contracts";
import type { MemberDirectoryEntry } from "@/lib/members/directory";
import { composePublicMemberProfile } from "./public-profile-contract";

const committeeProfile: PublicCommitteeMemberProfile = {
  appointments: [
    {
      assignmentId: "assignment-1",
      dateConfidence: "verified",
      endsOn: null,
      roleCode: "president",
      roleGroup: "executive",
      roleTitle: "President",
      roleTitleBn: null,
      startsOn: "2026-07-07",
      termNumber: 6,
      termSlug: "sixth-committee",
      termTitle: "6th Executive Committee",
    },
  ],
  avatarUrl: "https://example.com/committee.jpg",
  departmentName: "Computer Science and Engineering",
  displayName: "Committee Member",
  facebookUrl: "https://facebook.com/committee-member",
  jnuitsId: "JnUITS-2023001",
  linkedinUrl: "https://linkedin.com/in/committee-member",
  websiteUrl: "https://example.com/member",
};

const directoryProfile: MemberDirectoryEntry = {
  avatarSecureUrl: "https://example.com/directory.jpg",
  batchNo: 18,
  departmentCode: "cse",
  departmentName: "Computer Science and Engineering",
  facebookUrl: "https://facebook.com/directory-member",
  fullName: "Directory Member",
  id: "private-member-uuid",
  jnuitsId: "JnUITS-2023001",
  linkedinUrl: "https://linkedin.com/in/directory-member",
  memberType: "current",
  websiteUrl: null,
  workplace: {
    currentOrganization: "JnU",
    designation: "Student",
    visibility: "public",
    visible: true,
    workLocation: "Dhaka",
  },
};

describe("public member profile composition", () => {
  it("keeps an ordinary directory profile and appends public committee history", () => {
    const profile = composePublicMemberProfile(
      {
        ...directoryProfile,
        email: "private@example.com",
        phone: "+8801000000000",
      } as MemberDirectoryEntry,
      committeeProfile
    );

    expect(profile).toEqual({
      avatarSecureUrl: "https://example.com/directory.jpg",
      batchNo: 18,
      committeeAppointments: committeeProfile.appointments,
      departmentCode: "cse",
      departmentName: "Computer Science and Engineering",
      facebookUrl: "https://facebook.com/directory-member",
      fullName: "Directory Member",
      jnuitsId: "JnUITS-2023001",
      linkedinUrl: "https://linkedin.com/in/directory-member",
      memberType: "current",
      scope: "directory",
      websiteUrl: null,
      workplace: directoryProfile.workplace,
    });
    expect(Object.keys(profile || {})).not.toContain("email");
    expect(Object.keys(profile || {})).not.toContain("phone");
    expect(Object.keys(profile || {})).not.toContain("id");
  });

  it("returns only approved committee fields when the ordinary profile is unavailable", () => {
    const profile = composePublicMemberProfile(null, {
      ...committeeProfile,
      claim_state: "unclaimed",
      email: "private@example.com",
      portal_access_status: "frozen",
    } as PublicCommitteeMemberProfile);

    expect(profile).toEqual({
      avatarSecureUrl: "https://example.com/committee.jpg",
      committeeAppointments: committeeProfile.appointments,
      departmentName: "Computer Science and Engineering",
      fullName: "Committee Member",
      jnuitsId: "JnUITS-2023001",
      scope: "committee",
    });
    expect(Object.keys(profile || {}).sort()).toEqual([
      "avatarSecureUrl",
      "committeeAppointments",
      "departmentName",
      "fullName",
      "jnuitsId",
      "scope",
    ]);
  });

  it("returns null when neither visibility path is available", () => {
    expect(composePublicMemberProfile(null, null)).toBeNull();
  });
});
