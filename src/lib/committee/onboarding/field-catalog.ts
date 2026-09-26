import type { IntakeHeader } from "./intake-contracts";
import type {
  CommitteeOnboardingCanonicalField,
  CommitteeOnboardingColumnMapping,
} from "./contracts";

export type OnboardingFieldDefinition = {
  aliases: readonly string[];
  field: CommitteeOnboardingCanonicalField;
  label: string;
};

export const ONBOARDING_FIELD_CATALOG: readonly OnboardingFieldDefinition[] = [
  {
    aliases: ["full name", "name", "member name", "পূর্ণ নাম", "নাম", "সদস্যের নাম"],
    field: "fullName",
    label: "Full name",
  },
  {
    aliases: [
      "jnuits id",
      "jnuits_id",
      "membership id",
      "member id",
      "সদস্য আইডি",
      "জেএনইউআইটিএস আইডি",
    ],
    field: "jnuitsId",
    label: "JnUITS ID",
  },
  {
    aliases: ["email", "email address", "e-mail", "ইমেইল", "ইমেইল ঠিকানা"],
    field: "email",
    label: "Email",
  },
  {
    aliases: [
      "classification",
      "member type",
      "lifecycle status",
      "member classification",
      "শ্রেণি",
      "সদস্যের ধরন",
      "সদস্য ধরন",
    ],
    field: "classification",
    label: "Classification",
  },
  {
    aliases: ["department", "department code", "বিভাগ", "বিভাগ কোড"],
    field: "departmentCode",
    label: "Department",
  },
  { aliases: ["batch", "batch no", "batch number", "ব্যাচ"], field: "batchNo", label: "Batch" },
  { aliases: ["phone", "mobile", "phone number", "ফোন", "মোবাইল"], field: "phone", label: "Phone" },
  {
    aliases: ["student id", "student_id", "university id", "শিক্ষার্থী আইডি", "স্টুডেন্ট আইডি"],
    field: "studentId",
    label: "Student ID",
  },
  { aliases: ["facebook", "facebook url", "ফেসবুক"], field: "facebookUrl", label: "Facebook URL" },
  { aliases: ["linkedin", "linkedin url", "লিংকডইন"], field: "linkedinUrl", label: "LinkedIn URL" },
  { aliases: ["website", "website url", "ওয়েবসাইট"], field: "websiteUrl", label: "Website URL" },
  {
    aliases: ["avatar media id", "photo media id", "approved photo id", "ছবির মিডিয়া আইডি"],
    field: "avatarMediaId",
    label: "Approved photo",
  },
  {
    aliases: ["committee", "committee term", "committee number", "কমিটি", "কমিটি নম্বর"],
    field: "committeeTerm",
    label: "Committee",
  },
  { aliases: ["position", "role", "designation", "পদ", "পদবি"], field: "position", label: "Position" },
  { aliases: ["starts on", "start date", "শুরুর তারিখ"], field: "startsOn", label: "Starts on" },
  { aliases: ["ends on", "end date", "শেষ তারিখ"], field: "endsOn", label: "Ends on" },
  { aliases: ["sort order", "order", "priority", "ক্রম"], field: "sortOrder", label: "Order" },
  { aliases: ["is public", "public", "visible", "প্রকাশ্য"], field: "isPublic", label: "Public" },
  {
    aliases: ["assignment status", "appointment status", "appointment state", "দায়িত্বের অবস্থা"],
    field: "assignmentStatus",
    label: "Appointment status",
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
    new Set(definition.aliases.map(comparableHeader)),
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
