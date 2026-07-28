import { z } from "zod";

import type { FormAnswers, FormDefinition, FormField, FormKind } from "@/lib/forms/definition";

const fieldIdSchema = z.string().regex(/^[a-z][a-z0-9_]{0,63}$/);

const fieldMappingSchema = z
  .object({
    batchLabel: fieldIdSchema.optional(),
    departmentCode: fieldIdSchema.optional(),
    email: fieldIdSchema,
    facebookUrl: fieldIdSchema.optional(),
    fullName: fieldIdSchema,
    jnuitsId: fieldIdSchema.optional(),
    linkedinUrl: fieldIdSchema.optional(),
    phone: fieldIdSchema.optional(),
    studentId: fieldIdSchema.optional(),
  })
  .strict();

const applicationBehaviorSchema = z
  .object({ fieldMapping: fieldMappingSchema })
  .strict();

type FieldMapping = z.infer<typeof fieldMappingSchema>;

/**
 * Field types whose validated answer is a string.
 *
 * `extractApplicationIdentity` reads every mapped answer through
 * `readMappedString`, which requires `typeof value === "string"`. That is the
 * whole constraint. A mapping target is compatible exactly when the field
 * produces a string, and the detail it feeds does not narrow it further.
 *
 * Excluded, per `validateFormAnswers`: `number` yields a number,
 * `multi_select`, `image`, and `pdf` yield arrays, and `checkbox` and
 * `consent` yield booleans. None of those can back an identity detail, so
 * allowing them here would only move the failure from publish time to
 * submission time, where it would surface as a confusing "missing from the
 * submitted form answers" error against a question the respondent did answer.
 *
 * This replaces a set of hand-maintained per-key allowlists that had drifted
 * out of sync: `departmentCode` accepted `select` while `batchLabel` did not,
 * with no runtime reason for the difference.
 */
const STRING_ANSWER_FIELD_TYPES: FormField["type"][] = [
  "date",
  "email",
  "select",
  "telephone",
  "text",
  "textarea",
];

/**
 * Operator-facing names for the mapping keys.
 *
 * The camelCase key is an internal contract that never appears in the Form
 * Studio UI, so an error naming `batchLabel` gave the operator nothing to act
 * on. These match the labels rendered in the Application details panel.
 */
const MAPPING_KEY_LABELS: Record<keyof FieldMapping, string> = {
  batchLabel: "Batch",
  departmentCode: "Department",
  email: "Email address",
  facebookUrl: "Facebook URL",
  fullName: "Full name",
  jnuitsId: "Previous JnUITS ID",
  linkedinUrl: "LinkedIn URL",
  phone: "Phone number",
  studentId: "Student ID",
};

const COMPATIBLE_TYPE_GUIDANCE =
  "Choose a short answer, paragraph, email, telephone, date, or dropdown question.";

export type FormApplicationBehavior = {
  fieldMapping: FieldMapping;
};

export type FormApplicationIdentity = {
  batchLabel?: string;
  departmentCode?: string;
  email: string;
  facebookUrl?: string;
  fullName: string;
  jnuitsId?: string;
  linkedinUrl?: string;
  phone?: string;
  studentId?: string;
};

function mappingKeyLabel(mappingKey: keyof FieldMapping) {
  return MAPPING_KEY_LABELS[mappingKey] || mappingKey;
}

function findField(
  definition: FormDefinition,
  id: string,
  mappingKey: keyof FieldMapping
): FormField {
  const field = definition.fields.find((candidate) => candidate.id === id);

  if (!field) {
    throw new Error(
      `${mappingKeyLabel(mappingKey)} is mapped to a question that no longer exists. Choose another question or set it to "Not collected".`
    );
  }

  if (field.type === "section") {
    throw new Error(
      `${mappingKeyLabel(mappingKey)} is mapped to a section heading, which collects no answer. ${COMPATIBLE_TYPE_GUIDANCE}`
    );
  }

  return field;
}

function assertStringField(
  definition: FormDefinition,
  id: string,
  mappingKey: keyof FieldMapping,
  types: FormField["type"][]
) {
  const field = findField(definition, id, mappingKey);

  if (types.includes(field.type)) {
    return;
  }

  const label = mappingKeyLabel(mappingKey);
  const questionType = field.type.replaceAll("_", " ");

  throw new Error(
    mappingKey === "email"
      ? `${label} must map to an email question, so the address is validated before it becomes the applicant's identity. "${field.label}" is a ${questionType} question.`
      : `${label} must map to a question that produces a text answer. "${field.label}" is a ${questionType} question. ${COMPATIBLE_TYPE_GUIDANCE}`
  );
}

function assertFieldMapping(definition: FormDefinition, mapping: FieldMapping) {
  // The email address backs confirmation tokens, deduplication, and every
  // notice sent about the application. Only the `email` field type is run
  // through z.string().email() and lowercased by validateFormAnswers, so this
  // one stays strict while the rest are free.
  assertStringField(definition, mapping.email, "email", ["email"]);
  assertStringField(definition, mapping.fullName, "fullName", STRING_ANSWER_FIELD_TYPES);

  const optionalKeys: Array<keyof FieldMapping> = [
    "batchLabel",
    "departmentCode",
    "facebookUrl",
    "jnuitsId",
    "linkedinUrl",
    "phone",
    "studentId",
  ];

  for (const key of optionalKeys) {
    const fieldId = mapping[key];
    if (fieldId) {
      assertStringField(definition, fieldId, key, STRING_ANSWER_FIELD_TYPES);
    }
  }
}

export function parseFormApplicationBehavior(
  kind: FormKind,
  input: unknown,
  definition: FormDefinition
): FormApplicationBehavior {
  void kind;
  const behavior = applicationBehaviorSchema.parse(input);
  assertFieldMapping(definition, behavior.fieldMapping);

  return { fieldMapping: behavior.fieldMapping };
}

function readMappedString(
  answers: FormAnswers,
  fieldId: string | undefined,
  mappingKey: string,
  required = false
) {
  if (!fieldId) {
    return undefined;
  }

  const value = answers[fieldId];
  if (value === undefined && !required) {
    return undefined;
  }

  if (typeof value !== "string" || !value) {
    throw new Error(`${mappingKey} is missing from the submitted form answers.`);
  }

  return value;
}

export function extractApplicationIdentity(
  behavior: FormApplicationBehavior,
  answers: FormAnswers
): FormApplicationIdentity {
  const { fieldMapping } = behavior;
  const fullName = readMappedString(answers, fieldMapping.fullName, "fullName", true);
  const email = readMappedString(answers, fieldMapping.email, "email", true);

  if (!fullName || !email) {
    throw new Error("Canonical form identity is missing.");
  }

  return {
    batchLabel: readMappedString(answers, fieldMapping.batchLabel, "batchLabel"),
    departmentCode: readMappedString(answers, fieldMapping.departmentCode, "departmentCode"),
    email: email.toLowerCase(),
    facebookUrl: readMappedString(answers, fieldMapping.facebookUrl, "facebookUrl"),
    fullName,
    jnuitsId: readMappedString(answers, fieldMapping.jnuitsId, "jnuitsId"),
    linkedinUrl: readMappedString(answers, fieldMapping.linkedinUrl, "linkedinUrl"),
    phone: readMappedString(answers, fieldMapping.phone, "phone"),
    studentId: readMappedString(answers, fieldMapping.studentId, "studentId"),
  };
}
