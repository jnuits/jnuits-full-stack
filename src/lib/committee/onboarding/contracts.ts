import { z } from "zod";

export const COMMITTEE_ONBOARDING_OPERATION_TYPES = [
  "committee_roster_import",
  "member_profile_import",
] as const;

export const COMMITTEE_INTAKE_SOURCE_KINDS = [
  "manual",
  "csv",
  "xlsx",
  "pasted_tsv",
  "google_sheet",
] as const;

export type CommitteeOnboardingOperationType =
  (typeof COMMITTEE_ONBOARDING_OPERATION_TYPES)[number];
export type CommitteeIntakeSourceKind =
  (typeof COMMITTEE_INTAKE_SOURCE_KINDS)[number];

export const COMMITTEE_ONBOARDING_CANONICAL_FIELDS = [
  "fullName",
  "jnuitsId",
  "email",
  "classification",
  "departmentCode",
  "batchNo",
  "joinedOn",
  "phone",
  "studentId",
  "facebookUrl",
  "linkedinUrl",
  "websiteUrl",
  "avatarMediaId",
  "committeeTerm",
  "position",
  "startsOn",
  "endsOn",
  "sortOrder",
  "isPublic",
  "assignmentStatus",
] as const;

export type CommitteeOnboardingCanonicalField =
  (typeof COMMITTEE_ONBOARDING_CANONICAL_FIELDS)[number];
export type CommitteeOnboardingColumnMapping = Partial<
  Record<CommitteeOnboardingCanonicalField, string>
>;

export const onboardingRowIssueSchema = z.object({
  acceptedFormat: z.string().min(1).max(500),
  code: z.string().min(1).max(100),
  example: z.string().min(1).max(500),
  explanation: z.string().min(1).max(1_000),
  field: z.enum(COMMITTEE_ONBOARDING_CANONICAL_FIELDS).nullable(),
  receivedValue: z.string().max(160),
  sourceRow: z.number().int().positive(),
});

export type OnboardingRowIssue = z.infer<typeof onboardingRowIssueSchema>;

const sourceDigestSchema = z
  .string()
  .regex(/^[a-f0-9]{64}$/, "Source digest must be a lowercase SHA-256 value.");

export const committeeGoogleSheetProvenanceSchema = z
  .object({
    documentId: z
      .string()
      .regex(
        /^[A-Za-z0-9_-]{10,200}$/,
        "Google Sheet document ID is not valid."
      ),
    fetchedAt: z.string().datetime({ offset: true }),
    sheetId: z
      .string()
      .regex(/^\d{1,20}$/, "Google Sheet tab ID must contain only digits."),
  })
  .strict();

export type CommitteeGoogleSheetProvenance = z.infer<
  typeof committeeGoogleSheetProvenanceSchema
>;

export const committeeDraftMetadataSchema = z
  .object({
    columnMapping: z.record(z.string(), z.string()),
    googleSheet: committeeGoogleSheetProvenanceSchema.optional(),
    operationType: z.enum(COMMITTEE_ONBOARDING_OPERATION_TYPES),
    originalFilename: z.string().trim().min(1).max(180).optional(),
    schemaVersion: z.literal(1),
    sheetName: z.string().trim().min(1).max(120).optional(),
    sourceKind: z.enum(COMMITTEE_INTAKE_SOURCE_KINDS),
    sourceSha256: sourceDigestSchema.optional(),
    targetTermId: z.string().uuid().nullable(),
    targetTermUpdatedAt: z.string().datetime({ offset: true }).nullable().default(null),
  })
  .superRefine((value, context) => {
    if (value.sourceKind !== "manual" && !value.sourceSha256) {
      context.addIssue({
        code: "custom",
        message: "File and pasted sources require a SHA-256 digest.",
        path: ["sourceSha256"],
      });
    }

    if (value.sourceKind === "google_sheet" && !value.googleSheet) {
      context.addIssue({
        code: "custom",
        message: "Google Sheet snapshots require sanitized fetch provenance.",
        path: ["googleSheet"],
      });
    }

    if (value.sourceKind !== "google_sheet" && value.googleSheet) {
      context.addIssue({
        code: "custom",
        message: "Google Sheet provenance is only valid for Google Sheet snapshots.",
        path: ["googleSheet"],
      });
    }

    if (value.operationType === "committee_roster_import" && !value.targetTermId) {
      context.addIssue({
        code: "custom",
        message: "Committee roster drafts require a target term.",
        path: ["targetTermId"],
      });
    }

    if (value.operationType === "committee_roster_import" && !value.targetTermUpdatedAt) {
      context.addIssue({
        code: "custom",
        message: "Committee roster drafts require the target term revision.",
        path: ["targetTermUpdatedAt"],
      });
    }

    if (
      value.operationType === "member_profile_import" &&
      (value.targetTermId || value.targetTermUpdatedAt)
    ) {
      context.addIssue({
        code: "custom",
        message: "Member profile drafts cannot target a committee term or revision.",
        path: ["targetTermId"],
      });
    }
  });

export type CommitteeDraftMetadata = z.infer<typeof committeeDraftMetadataSchema>;

export function parseCommitteeDraftMetadata(value: unknown): CommitteeDraftMetadata {
  return committeeDraftMetadataSchema.parse(value);
}
