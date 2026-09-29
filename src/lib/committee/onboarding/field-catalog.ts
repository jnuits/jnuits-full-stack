import type { IntakeHeader } from "./intake-contracts";
import type {
  CommitteeOnboardingCanonicalField,
  CommitteeOnboardingColumnMapping,
  CommitteeOnboardingOperationType,
} from "./contracts";

type FieldRequirement = "optional" | "required";

export type OnboardingFieldDefinition = {
  acceptedFormat: string;
  aliases: readonly string[];
  example: string;
  field: CommitteeOnboardingCanonicalField;
  label: string;
  limits?: string;
  requirements: Readonly<Record<CommitteeOnboardingOperationType, FieldRequirement>>;
};

const OPTIONAL = {
  committee_roster_import: "optional",
  member_profile_import: "optional",
} as const;

const MEMBER_REQUIRED = {
  committee_roster_import: "optional",
  member_profile_import: "required",
} as const;

const IDENTITY_REQUIRED = {
  committee_roster_import: "required",
  member_profile_import: "required",
} as const;

const COMMITTEE_REQUIRED = {
  committee_roster_import: "required",
  member_profile_import: "optional",
} as const;

export const ONBOARDING_FIELD_CATALOG: readonly OnboardingFieldDefinition[] = [
  {
    acceptedFormat: "Plain text",
    aliases: ["full name", "name", "member name", "পূর্ণ নাম", "নাম", "সদস্যের নাম"],
    example: "Sample Member",
    field: "fullName",
    label: "Full name",
    limits: "1 to 160 characters",
    requirements: IDENTITY_REQUIRED,
  },
  {
    acceptedFormat: "A unique JnUITS membership ID",
    aliases: [
      "jnuits id",
      "jnuits_id",
      "membership id",
      "member id",
      "সদস্য আইডি",
      "জেএনইউআইটিএস আইডি",
    ],
    example: "JNUITS-2099001",
    field: "jnuitsId",
    label: "JnUITS ID",
    requirements: IDENTITY_REQUIRED,
  },
  {
    acceptedFormat: "A valid email address",
    aliases: ["email", "email address", "e-mail", "ইমেইল", "ইমেইল ঠিকানা"],
    example: "sample.member@example.com",
    field: "email",
    label: "Email",
    requirements: IDENTITY_REQUIRED,
  },
  {
    acceptedFormat: "current, former, or alumni",
    aliases: [
      "classification",
      "member type",
      "lifecycle status",
      "member classification",
      "শ্রেণি",
      "সদস্যের ধরন",
      "সদস্য ধরন",
    ],
    example: "current",
    field: "classification",
    label: "Classification",
    requirements: IDENTITY_REQUIRED,
  },
  {
    acceptedFormat: "An active code from the Department codes download",
    aliases: ["department", "department code", "বিভাগ", "বিভাগ কোড"],
    example: "CSE",
    field: "departmentCode",
    label: "Department",
    requirements: MEMBER_REQUIRED,
  },
  {
    acceptedFormat: "Exactly two digits from 01 to 99",
    aliases: ["batch", "batch no", "batch number", "ব্যাচ"],
    example: "08",
    field: "batchNo",
    label: "Batch",
    requirements: MEMBER_REQUIRED,
  },
  {
    acceptedFormat: "YYYY-MM-DD",
    aliases: [
      "joined on",
      "joining date",
      "membership start date",
      "যোগদানের তারিখ",
      "সদস্যপদ শুরুর তারিখ",
    ],
    example: "2024-01-15",
    field: "joinedOn",
    label: "Joining date",
    requirements: MEMBER_REQUIRED,
  },
  {
    acceptedFormat: "International or local phone number",
    aliases: ["phone", "mobile", "phone number", "ফোন", "মোবাইল"],
    example: "+8801700000000",
    field: "phone",
    label: "Phone",
    requirements: OPTIONAL,
  },
  {
    acceptedFormat: "University-issued student identifier",
    aliases: ["student id", "student_id", "university id", "শিক্ষার্থী আইডি", "স্টুডেন্ট আইডি"],
    example: "2024-0001",
    field: "studentId",
    label: "Student ID",
    requirements: OPTIONAL,
  },
  {
    acceptedFormat: "Absolute https:// Facebook profile URL",
    aliases: ["facebook", "facebook url", "ফেসবুক"],
    example: "https://www.facebook.com/sample.member",
    field: "facebookUrl",
    label: "Facebook URL",
    requirements: OPTIONAL,
  },
  {
    acceptedFormat: "Absolute https:// LinkedIn profile URL",
    aliases: ["linkedin", "linkedin url", "লিংকডইন"],
    example: "https://www.linkedin.com/in/sample-member",
    field: "linkedinUrl",
    label: "LinkedIn URL",
    requirements: OPTIONAL,
  },
  {
    acceptedFormat: "Absolute https:// website URL",
    aliases: ["website", "website url", "ওয়েবসাইট"],
    example: "https://example.com",
    field: "websiteUrl",
    label: "Website URL",
    requirements: OPTIONAL,
  },
  {
    acceptedFormat: "An existing approved media UUID",
    aliases: ["avatar media id", "photo media id", "approved photo id", "ছবির মিডিয়া আইডি"],
    example: "00000000-0000-4000-8000-000000000000",
    field: "avatarMediaId",
    label: "Approved photo",
    requirements: OPTIONAL,
  },
  {
    acceptedFormat: "Configured committee term number or label",
    aliases: ["committee", "committee term", "committee number", "কমিটি", "কমিটি নম্বর"],
    example: "7",
    field: "committeeTerm",
    label: "Committee",
    requirements: OPTIONAL,
  },
  {
    acceptedFormat: "Configured committee position code or title",
    aliases: ["position", "role", "designation", "পদ", "পদবি"],
    example: "president",
    field: "position",
    label: "Position",
    requirements: COMMITTEE_REQUIRED,
  },
  {
    acceptedFormat: "YYYY-MM-DD",
    aliases: ["starts on", "start date", "শুরুর তারিখ"],
    example: "2026-09-26",
    field: "startsOn",
    label: "Starts on",
    requirements: OPTIONAL,
  },
  {
    acceptedFormat: "YYYY-MM-DD",
    aliases: ["ends on", "end date", "শেষ তারিখ"],
    example: "2027-09-25",
    field: "endsOn",
    label: "Ends on",
    requirements: OPTIONAL,
  },
  {
    acceptedFormat: "Whole number",
    aliases: ["sort order", "order", "priority", "ক্রম"],
    example: "10",
    field: "sortOrder",
    label: "Order",
    requirements: OPTIONAL,
  },
  {
    acceptedFormat: "true or false",
    aliases: ["is public", "public", "visible", "প্রকাশ্য"],
    example: "true",
    field: "isPublic",
    label: "Public",
    requirements: OPTIONAL,
  },
  {
    acceptedFormat: "planned, active, or completed",
    aliases: ["assignment status", "appointment status", "appointment state", "দায়িত্বের অবস্থা"],
    example: "active",
    field: "assignmentStatus",
    label: "Appointment status",
    requirements: OPTIONAL,
  },
] as const;

function comparableHeader(value: string) {
  return value
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase("en-US")
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, "_")
    .replace(/^_+|_+$/g, "");
}

const aliasesByField = new Map(
  ONBOARDING_FIELD_CATALOG.map((definition) => [
    definition.field,
    new Set([definition.label, ...definition.aliases].map(comparableHeader)),
  ])
);

export function inferColumnMapping(headers: readonly IntakeHeader[]) {
  const mapping: CommitteeOnboardingColumnMapping = {};

  for (const definition of ONBOARDING_FIELD_CATALOG) {
    const aliases = aliasesByField.get(definition.field) ?? new Set<string>();
    const candidates = headers.filter(
      (header) => aliases.has(comparableHeader(header.key)) || aliases.has(comparableHeader(header.label))
    );

    if (candidates.length === 1) {
      mapping[definition.field] = candidates[0].key;
    }
  }

  return mapping;
}

export function resolveColumnMapping(
  headers: readonly IntakeHeader[],
  overrides: CommitteeOnboardingColumnMapping = {}
) {
  const availableKeys = new Set(headers.map(({ key }) => key));
  const mapping = inferColumnMapping(headers);

  for (const [field, sourceKey] of Object.entries(overrides) as [
    CommitteeOnboardingCanonicalField,
    string | undefined,
  ][]) {
    if (sourceKey && availableKeys.has(sourceKey)) {
      mapping[field] = sourceKey;
    }
  }

  return mapping;
}
