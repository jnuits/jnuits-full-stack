export type PublicCommitteeAssignment = {
  avatarUrl: string | null;
  departmentName: string | null;
  displayName: string;
  facebookUrl: string | null;
  id: string;
  jnuitsId: string | null;
  linkedinUrl: string | null;
  positionId: string;
  roleCode: string;
  roleGroup: string;
  roleId: string;
  roleTitle: string;
  roleTitleBn: string | null;
  speech: string | null;
  sortOrder: number;
  websiteUrl: string | null;
};

export type PublicCommitteeTerm = {
  assignments: PublicCommitteeAssignment[];
  dateConfidence: "estimated" | "verified";
  electionDate: string | null;
  endsOn: string | null;
  id: string;
  isCurrent: boolean;
  slug: string;
  startsOn: string;
  status: string;
  summary: string | null;
  targetExecutiveSlots: number;
  tenureNote: string | null;
  termNumber: number | null;
  title: string;
  voterRuleNote: string | null;
};

export type PublicAdvisorProfile = {
  advisorJnuitsId: string | null;
  advisorType: "honorable_advisor" | "main_advisor" | "moderator_mentor";
  avatarUrl: string | null;
  bio: string | null;
  dateConfidence: "estimated" | "verified";
  department: string | null;
  designation: string | null;
  facebookUrl: string | null;
  formerTitle: string | null;
  fullName: string;
  id: string;
  isCurrent: boolean;
  jnuProfileUrl: string | null;
  joinedOn: string | null;
  leftOn: string | null;
  linkedinUrl: string | null;
  speech: string | null;
  sortOrder: number;
  statusNote: string | null;
  tenureDisplay: string | null;
  title: string | null;
  websiteUrl: string | null;
};

export type PublicCommitteeAppointment = {
  assignmentId: string;
  dateConfidence: "estimated" | "verified";
  endsOn: string | null;
  roleCode: string;
  roleGroup: string;
  roleTitle: string;
  roleTitleBn: string | null;
  startsOn: string;
  termNumber: number | null;
  termSlug: string;
  termTitle: string;
};

export type PublicCommitteeMemberProfile = {
  appointments: PublicCommitteeAppointment[];
  avatarUrl: string | null;
  departmentName: string | null;
  displayName: string;
  facebookUrl: string | null;
  jnuitsId: string;
  linkedinUrl: string | null;
  websiteUrl: string | null;
};

export type PublicCommitteeDirectory = {
  advisors: PublicAdvisorProfile[];
  currentTerm: PublicCommitteeTerm | null;
  memberProfiles: PublicCommitteeMemberProfile[];
  terms: PublicCommitteeTerm[];
};
