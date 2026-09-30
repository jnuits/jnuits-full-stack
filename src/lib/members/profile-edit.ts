import type { CommitteeOnboardingColumnMapping } from "@/lib/committee/onboarding/contracts";
import {
  normalizeOnboardingRow,
  type ExistingDepartmentSnapshot,
  type ExistingMemberSnapshot,
  type OnboardingRowIssue,
} from "@/lib/committee/onboarding/normalize-draft";

export type MemberProfileEditValues = {
  batchNo: string;
  departmentCode: string;
  facebookUrl: string;
  fullName: string;
  joinedOn: string;
  linkedinUrl: string;
  phone: string;
  studentId: string;
  websiteUrl: string;
};

export type EditableMemberProfilePatch = Partial<{
  batch_no: number;
  department_code: string;
  facebook_url: string;
  full_name: string;
  joined_on: string;
  linkedin_url: string;
  phone: string;
  student_id: string;
  website_url: string;
}>;

export type MemberProfileEditDecision = {
  errors: OnboardingRowIssue[];
  patch: EditableMemberProfilePatch;
  warnings: OnboardingRowIssue[];
};

const profileMapping = {
  batchNo: "batch_no",
  classification: "classification",
  departmentCode: "department_code",
  email: "email",
  facebookUrl: "facebook_url",
  fullName: "full_name",
  jnuitsId: "jnuits_id",
  joinedOn: "joined_on",
  linkedinUrl: "linkedin_url",
  phone: "phone",
  studentId: "student_id",
  websiteUrl: "website_url",
} satisfies CommitteeOnboardingColumnMapping;

const editablePatchKeys = [
  "batch_no",
  "department_code",
  "facebook_url",
  "full_name",
  "joined_on",
  "linkedin_url",
  "phone",
  "student_id",
  "website_url",
] as const;

export function memberClassification(
  member: Pick<ExistingMemberSnapshot, "lifecycleStatus" | "memberType">
) {
  if (member.lifecycleStatus === "alumni") return "alumni" as const;
  if (member.lifecycleStatus === "former") return "former" as const;
  if (member.memberType === "alumni") return "alumni" as const;
  return "current" as const;
}

export function buildMemberProfileEditDecision({
  departments,
  existing,
  values,
}: {
  departments?: readonly ExistingDepartmentSnapshot[];
  existing: ExistingMemberSnapshot;
  values: MemberProfileEditValues;
}): MemberProfileEditDecision {
  const result = normalizeOnboardingRow({
    approvedMedia: [],
    departments,
    existingAssignments: [],
    existingMembers: [existing],
    mapping: profileMapping,
    operationType: "member_profile_import",
    positions: [],
    row: {
      sourceRowNumber: 1,
      values: {
        batch_no: values.batchNo,
        classification: memberClassification(existing),
        department_code: values.departmentCode,
        email: existing.email || "",
        facebook_url: values.facebookUrl,
        full_name: values.fullName,
        jnuits_id: existing.jnuitsId,
        joined_on: values.joinedOn,
        linkedin_url: values.linkedinUrl,
        phone: values.phone,
        student_id: values.studentId,
        website_url: values.websiteUrl,
      },
    },
    targetTermId: null,
  });
  const patch: EditableMemberProfilePatch = {};

  for (const key of editablePatchKeys) {
    if (Object.prototype.hasOwnProperty.call(result.memberPatch, key)) {
      Object.assign(patch, { [key]: result.memberPatch[key] });
    }
  }

  return { errors: result.errors, patch, warnings: result.warnings };
}
