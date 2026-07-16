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

function findField(definition: FormDefinition, id: string, mappingKey: string): FormField {
  const field = definition.fields.find((candidate) => candidate.id === id);

  if (!field || field.type === "section") {
    throw new Error(`${mappingKey} must map to a form field.`);
  }

  return field;
}

function assertStringField(
  definition: FormDefinition,
  id: string,
  mappingKey: string,
  types: FormField["type"][]
) {
  const field = findField(definition, id, mappingKey);

  if (!types.includes(field.type)) {
    throw new Error(
      mappingKey === "email"
        ? "email must map to an email field."
        : `${mappingKey} must map to a compatible form field.`
    );
  }
}

function assertFieldMapping(definition: FormDefinition, mapping: FieldMapping) {
  assertStringField(definition, mapping.fullName, "fullName", ["text", "textarea"]);
  assertStringField(definition, mapping.email, "email", ["email"]);

  const optionalTextFields: Array<[keyof FieldMapping, FormField["type"][]]> = [
    ["batchLabel", ["text", "textarea"]],
    ["departmentCode", ["text", "textarea", "select"]],
    ["facebookUrl", ["text", "textarea"]],
    ["jnuitsId", ["text", "textarea"]],
    ["linkedinUrl", ["text", "textarea"]],
    ["phone", ["telephone", "text"]],
    ["studentId", ["text", "textarea"]],
  ];

  for (const [key, types] of optionalTextFields) {
    const fieldId = mapping[key];
    if (fieldId) {
      assertStringField(definition, fieldId, key, types);
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
