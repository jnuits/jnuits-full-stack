import { normalizeJnuitsIdForCreation } from "@/lib/members/jnuits-id";
import type {
  CommitteeOnboardingCanonicalField,
  CommitteeOnboardingColumnMapping,
  CommitteeOnboardingOperationType,
} from "./contracts";
import type { IntakeRow } from "./intake-contracts";

export type ExistingMemberSnapshot = {
  batchNo?: number | string | null;
  departmentCode?: string | null;
  email: string | null;
  facebookUrl?: string | null;
  fullName: string;
  id: string;
  jnuitsId: string;
  lifecycleStatus: string;
  linkedinUrl?: string | null;
  memberType: string;
  phone?: string | null;
  studentId?: string | null;
  updatedAt: string;
  websiteUrl?: string | null;
};

export type ExistingAssignmentSnapshot = {
  endsOn: string | null;
  id: string;
  isPublic: boolean;
  memberId: string;
  roleId: string;
  sortOrder: number;
  startsOn: string | null;
  status: "active" | "completed" | "planned";
  termId: string;
  updatedAt: string;
};

export type PositionSnapshot = {
  code: string;
  isVisible: boolean;
  priority?: number;
  roleId: string;
  termId: string;
  title: string;
  titleBn: string | null;
  updatedAt: string;
};

export type ApprovedMediaSnapshot = {
  bytes?: number | null;
  deletedAt: string | null;
  format?: string | null;
  height?: number | null;
  id: string;
  isPublic: boolean;
  mediaKind: string;
  publicId?: string | null;
  secureUrl?: string | null;
  width?: number | null;
};

export type OnboardingRowIssue = {
  code: string;
  field: CommitteeOnboardingCanonicalField | null;
  message: string;
};

export type OnboardingIdentityDecision =
  | { kind: "create"; memberId: null }
  | { kind: "update"; memberId: string }
  | { kind: "conflict"; memberId: null }
  | { kind: "unresolved"; memberId: null };

export type NormalizeOnboardingRowOptions = {
  approvedMedia: readonly ApprovedMediaSnapshot[];
  existingAssignments: readonly ExistingAssignmentSnapshot[];
  existingMembers: readonly ExistingMemberSnapshot[];
  mapping: CommitteeOnboardingColumnMapping;
  operationType: CommitteeOnboardingOperationType;
  positions: readonly PositionSnapshot[];
  row: IntakeRow;
  targetTermId: string | null;
};

type MemberPatch = Record<string, boolean | number | string | null>;
type AssignmentPatch = {
  ends_on: string | null;
  is_public: boolean;
  sort_order: number;
  starts_on: string | null;
  status: "active" | "completed" | "planned";
};

export type NormalizedOnboardingRow = {
  assignment:
    | {
        action: "create" | "noop" | "update";
        assignmentId: string | null;
        roleId: string;
        termId: string;
      }
    | null;
  assignmentPatch: AssignmentPatch | null;
  errors: OnboardingRowIssue[];
  identity: OnboardingIdentityDecision;
  memberPatch: MemberPatch;
  normalized: Record<string, unknown>;
  sourceRowNumber: number;
  status: "invalid" | "noop" | "valid";
  targetVersions: {
    assignmentUpdatedAt: string | null;
    memberUpdatedAt: string | null;
    positionUpdatedAt: string | null;
  };
  warnings: OnboardingRowIssue[];
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function readField(
  row: IntakeRow,
  mapping: CommitteeOnboardingColumnMapping,
  field: CommitteeOnboardingCanonicalField
) {
  const sourceKey = mapping[field];
  return sourceKey ? (row.values[sourceKey] ?? "").trim() : "";
}

function normalizeEmail(value: string) {
  const normalized = value.trim().toLocaleLowerCase("en-US");
  return EMAIL_PATTERN.test(normalized) ? normalized : "";
}

function comparable(value: string) {
  return value.normalize("NFKC").trim().toLocaleLowerCase("en-US");
}

function normalizeClassification(value: string) {
  const normalized = comparable(value).replace(/[\s_-]+/g, " ");
  if (["current", "বর্তমান", "সক্রিয়"].includes(normalized)) return "current" as const;
  if (["former", "সাবেক"].includes(normalized)) return "former" as const;
  if (["alumni", "alumnus", "alumna", "অ্যালামনাই", "প্রাক্তন শিক্ষার্থী"].includes(normalized)) {
    return "alumni" as const;
  }
  return null;
}

function classificationPatch(classification: "alumni" | "current" | "former") {
  return classification === "alumni"
    ? { lifecycle_status: "alumni", member_type: "alumni" }
    : classification === "former"
      ? { lifecycle_status: "former", member_type: "current" }
      : { lifecycle_status: "current", member_type: "current" };
}

function isValidDate(value: string) {
  if (!DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function parseBoolean(value: string) {
  const normalized = comparable(value);
  if (["1", "true", "yes", "y", "হ্যাঁ"].includes(normalized)) return true;
  if (["0", "false", "no", "n", "না"].includes(normalized)) return false;
  return null;
}

function validHttpUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

function sameValue(left: unknown, right: unknown) {
  return (left ?? null) === (right ?? null);
}

export function normalizeOnboardingRow(
  options: NormalizeOnboardingRowOptions
): NormalizedOnboardingRow {
  const errors: OnboardingRowIssue[] = [];
  const warnings: OnboardingRowIssue[] = [];
  const normalized: Record<string, unknown> = {};
  const memberPatch: MemberPatch = {};
  const issue = (
    code: string,
    field: CommitteeOnboardingCanonicalField | null,
    message: string
  ) => errors.push({ code, field, message });

  const fullName = readField(options.row, options.mapping, "fullName").replace(/\s+/g, " ");
  const rawJnuitsId = readField(options.row, options.mapping, "jnuitsId");
  const rawEmail = readField(options.row, options.mapping, "email");
  const rawClassification = readField(options.row, options.mapping, "classification");
  const jnuitsId = normalizeJnuitsIdForCreation(rawJnuitsId);
  const email = normalizeEmail(rawEmail);
  const classification = normalizeClassification(rawClassification);

  if (!fullName) issue("full_name_required", "fullName", "Full name is required.");
  if (!jnuitsId) issue("jnuits_id_invalid", "jnuitsId", "A valid JnUITS ID is required.");
  if (!email) issue("email_invalid", "email", "A valid email is required.");
  if (!classification) {
    issue(
      rawClassification ? "classification_invalid" : "classification_required",
      "classification",
      "Classification must be current, former, or alumni."
    );
  }

  if (fullName) normalized.fullName = fullName;
  if (jnuitsId) normalized.jnuitsId = jnuitsId;
  if (email) normalized.email = email;
  if (classification) normalized.classification = classification;

  let identity: OnboardingIdentityDecision = { kind: "unresolved", memberId: null };
  let member: ExistingMemberSnapshot | null = null;

  if (jnuitsId && email) {
    const byId = options.existingMembers.find(
      (candidate) => normalizeJnuitsIdForCreation(candidate.jnuitsId) === jnuitsId
    );
    const byEmail = options.existingMembers.find(
      (candidate) => candidate.email?.trim().toLocaleLowerCase("en-US") === email
    );

    if (byId && byEmail && byId.id !== byEmail.id) {
      identity = { kind: "conflict", memberId: null };
      issue(
        "split_identity",
        null,
        "The JnUITS ID and email resolve to different member profiles."
      );
    } else if (byId || byEmail) {
      const candidate = byId ?? byEmail ?? null;
      const candidateId = candidate ? normalizeJnuitsIdForCreation(candidate.jnuitsId) : "";
      const candidateEmail = candidate?.email?.trim().toLocaleLowerCase("en-US") ?? "";

      if (!candidate || candidateId !== jnuitsId || candidateEmail !== email) {
        identity = { kind: "conflict", memberId: null };
        issue(
          "identity_mismatch",
          null,
          "One identifier matches a member but the other identifier disagrees."
        );
      } else if (candidate.lifecycleStatus === "deleted") {
        identity = { kind: "conflict", memberId: null };
        issue("identity_deleted", null, "The matching member identity is deleted.");
      } else {
        member = candidate;
        identity = { kind: "update", memberId: candidate.id };
      }
    } else {
      identity = { kind: "create", memberId: null };
    }
  }

  if (identity.kind === "create" && fullName && jnuitsId && email && classification) {
    Object.assign(memberPatch, {
      email,
      full_name: fullName,
      jnuits_id: jnuitsId,
      ...classificationPatch(classification),
    });
  } else if (identity.kind === "update" && member && classification) {
    if (member.fullName !== fullName) memberPatch.full_name = fullName;
    const classificationValues = classificationPatch(classification);
    if (member.lifecycleStatus !== classificationValues.lifecycle_status) {
      memberPatch.lifecycle_status = classificationValues.lifecycle_status;
    }
    if (member.memberType !== classificationValues.member_type) {
      memberPatch.member_type = classificationValues.member_type;
    }
  }

  const optionalTextFields = [
    ["departmentCode", "department_code", "departmentCode"],
    ["phone", "phone", "phone"],
    ["studentId", "student_id", "studentId"],
  ] as const;
  for (const [field, patchKey, existingKey] of optionalTextFields) {
    let value = readField(options.row, options.mapping, field);
    if (!value) continue;
    if (field === "departmentCode") value = value.toLocaleUpperCase("en-US");
    normalized[field] = value;
    if (identity.kind === "create" || !sameValue(member?.[existingKey], value)) {
      memberPatch[patchKey] = value;
    }
  }

  const batch = readField(options.row, options.mapping, "batchNo");
  if (batch) {
    const batchNo = Number.parseInt(batch, 10);
    if (!/^\d+$/.test(batch) || batchNo <= 0) {
      issue("batch_invalid", "batchNo", "Batch must be a positive whole number.");
    } else {
      normalized.batchNo = batchNo;
      if (identity.kind === "create" || Number(member?.batchNo) !== batchNo) {
        memberPatch.batch_no = batchNo;
      }
    }
  }

  const urlFields = [
    ["facebookUrl", "facebook_url", "facebookUrl"],
    ["linkedinUrl", "linkedin_url", "linkedinUrl"],
    ["websiteUrl", "website_url", "websiteUrl"],
  ] as const;
  for (const [field, patchKey, existingKey] of urlFields) {
    const value = readField(options.row, options.mapping, field);
    if (!value) continue;
    if (!validHttpUrl(value)) {
      issue("url_invalid", field, `${field} must use an http or https URL.`);
      continue;
    }
    normalized[field] = value;
    if (identity.kind === "create" || !sameValue(member?.[existingKey], value)) {
      memberPatch[patchKey] = value;
    }
  }

  const avatarMediaId = readField(options.row, options.mapping, "avatarMediaId");
  if (avatarMediaId) {
    normalized.avatarMediaId = avatarMediaId;
    const media = options.approvedMedia.find(({ id }) => id === avatarMediaId);
    if (
      !media ||
      media.deletedAt !== null ||
      !media.isPublic ||
      media.mediaKind !== "image" ||
      !media.publicId ||
      !media.secureUrl
    ) {
      issue(
        "media_not_approved",
        "avatarMediaId",
        "The photo must reference an approved public image in the media library."
      );
    } else {
      Object.assign(memberPatch, {
        avatar_bytes: media.bytes ?? null,
        avatar_format: media.format ?? null,
        avatar_height: media.height ?? null,
        avatar_public_id: media.publicId,
        avatar_secure_url: media.secureUrl,
        avatar_width: media.width ?? null,
      });
    }
  }

  let assignment: NormalizedOnboardingRow["assignment"] = null;
  let assignmentPatch: AssignmentPatch | null = null;
  let assignmentUpdatedAt: string | null = null;
  let positionUpdatedAt: string | null = null;

  if (options.operationType === "committee_roster_import") {
    if (!options.targetTermId) {
      issue("committee_term_required", "committeeTerm", "A committee term must be selected.");
    }

    const positionValue = readField(options.row, options.mapping, "position");
    if (!positionValue) {
      issue("position_required", "position", "Position is required.");
    }

    const positionNeedle = comparable(positionValue);
    const position = options.positions.find(
      (candidate) =>
        candidate.termId === options.targetTermId &&
        [candidate.roleId, candidate.code, candidate.title, candidate.titleBn ?? ""]
          .map(comparable)
          .includes(positionNeedle)
    );

    if (positionValue && !position) {
      issue("position_unknown", "position", "The position is not configured for this committee.");
    }

    if (position && options.targetTermId) {
      normalized.positionRoleId = position.roleId;
      normalized.targetTermId = options.targetTermId;
      positionUpdatedAt = position.updatedAt;
      const existing =
        identity.kind === "update"
          ? options.existingAssignments.find(
              (candidate) =>
                candidate.termId === options.targetTermId &&
                candidate.roleId === position.roleId &&
                candidate.memberId === identity.memberId
            ) ?? null
          : null;

      const startsInput = readField(options.row, options.mapping, "startsOn");
      const endsInput = readField(options.row, options.mapping, "endsOn");
      const orderInput = readField(options.row, options.mapping, "sortOrder");
      const publicInput = readField(options.row, options.mapping, "isPublic");
      const statusInput = comparable(
        readField(options.row, options.mapping, "assignmentStatus")
      );

      const startsOn = startsInput || existing?.startsOn || null;
      const endsOn = endsInput || existing?.endsOn || null;
      if (startsInput && !isValidDate(startsInput)) {
        issue("start_date_invalid", "startsOn", "Start date must be YYYY-MM-DD.");
      }
      if (endsInput && !isValidDate(endsInput)) {
        issue("end_date_invalid", "endsOn", "End date must be YYYY-MM-DD.");
      }
      if (startsOn && endsOn && endsOn < startsOn) {
        issue("date_range_invalid", "endsOn", "End date cannot be before start date.");
      }

      let sortOrder = existing?.sortOrder ?? position.priority ?? 100;
      if (orderInput) {
        const parsedOrder = Number.parseInt(orderInput, 10);
        if (!/^\d+$/.test(orderInput) || parsedOrder < 0) {
          issue("sort_order_invalid", "sortOrder", "Order must be a non-negative whole number.");
        } else {
          sortOrder = parsedOrder;
        }
      }

      let isPublic = existing?.isPublic ?? position.isVisible;
      if (publicInput) {
        const parsedPublic = parseBoolean(publicInput);
        if (parsedPublic === null) {
          issue("public_invalid", "isPublic", "Public must be yes or no.");
        } else {
          isPublic = parsedPublic;
        }
      }

      let status: AssignmentPatch["status"] = existing?.status ?? "active";
      if (statusInput) {
        if (["active", "completed", "planned"].includes(statusInput)) {
          status = statusInput as AssignmentPatch["status"];
        } else {
          issue(
            "assignment_status_invalid",
            "assignmentStatus",
            "Appointment status must be planned, active, or completed."
          );
        }
      }

      assignmentPatch = {
        ends_on: endsOn,
        is_public: isPublic,
        sort_order: sortOrder,
        starts_on: startsOn,
        status,
      };
      normalized.assignment = assignmentPatch;

      const isNoop =
        existing &&
        existing.endsOn === assignmentPatch.ends_on &&
        existing.isPublic === assignmentPatch.is_public &&
        existing.sortOrder === assignmentPatch.sort_order &&
        existing.startsOn === assignmentPatch.starts_on &&
        existing.status === assignmentPatch.status;

      assignment = {
        action: isNoop ? "noop" : existing ? "update" : "create",
        assignmentId: existing?.id ?? null,
        roleId: position.roleId,
        termId: options.targetTermId,
      };
      assignmentUpdatedAt = existing?.updatedAt ?? null;
    }
  }

  const hasMemberChanges = Object.keys(memberPatch).length > 0;
  const status: NormalizedOnboardingRow["status"] =
    errors.length > 0
      ? "invalid"
      : identity.kind === "update" &&
          !hasMemberChanges &&
          (options.operationType === "member_profile_import" || assignment?.action === "noop")
        ? "noop"
        : "valid";

  return {
    assignment,
    assignmentPatch,
    errors,
    identity,
    memberPatch,
    normalized,
    sourceRowNumber: options.row.sourceRowNumber,
    status,
    targetVersions: {
      assignmentUpdatedAt,
      memberUpdatedAt: member?.updatedAt ?? null,
      positionUpdatedAt,
    },
    warnings,
  };
}
