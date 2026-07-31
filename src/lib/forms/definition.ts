import { z } from "zod";

import {
  checkAnswerRule,
  tooLongMessage,
  type FormQuestionField,
} from "@/lib/forms/answer-rules";

export const FORM_KINDS = [
  "event_registration",
  "membership_application",
  "alumni_onboarding",
] as const;

export const FORM_FIELD_TYPES = [
  "section",
  "text",
  "textarea",
  "email",
  "telephone",
  "number",
  "date",
  "select",
  "radio",
  "multi_select",
  "checkbox",
  "consent",
  "image",
  "pdf",
] as const;

export type FormKind = (typeof FORM_KINDS)[number];
export type FormFieldType = (typeof FORM_FIELD_TYPES)[number];

export const FormKindSchema = z.enum(FORM_KINDS);

const fieldIdSchema = z
  .string()
  .regex(/^[a-z][a-z0-9_]{0,63}$/, "Use a lowercase field ID with underscores.")
  .refine(
    (value) => !["__proto__", "constructor", "prototype"].includes(value),
    "This field ID is reserved."
  );

const labelSchema = z.string().trim().min(1).max(160);
const helpTextSchema = z.string().trim().max(500).optional();
const assetIdSchema = z.string().uuid();

const optionSchema = z
  .object({
    label: labelSchema,
    value: z.string().trim().min(1).max(120),
  })
  .strict();

const optionsSchema = z
  .array(optionSchema)
  .min(1)
  .max(50)
  .superRefine((options, context) => {
    const seen = new Set<string>();

    options.forEach((option, index) => {
      if (seen.has(option.value)) {
        context.addIssue({
          code: "custom",
          message: "Option values must be unique.",
          path: [index, "value"],
        });
      }

      seen.add(option.value);
    });
  });

const presentationField = {
  helpText: helpTextSchema,
  id: fieldIdSchema,
  label: labelSchema,
};

const inputField = {
  ...presentationField,
  required: z.boolean().default(false),
};

const disabledPaymentSchema = z
  .object({ enabled: z.boolean() })
  .strict()
  .superRefine((payment, context) => {
    if (payment.enabled) {
      context.addIssue({
        code: "custom",
        message: "Payments are disabled for this release.",
        path: ["enabled"],
      });
    }
  });

export const FormFieldSchema = z.discriminatedUnion("type", [
  z.object({ ...presentationField, type: z.literal("section") }).strict(),
  z
    .object({
      ...inputField,
      maxLength: z.number().int().min(1).max(2_000).default(160),
      type: z.literal("text"),
    })
    .strict(),
  z
    .object({
      ...inputField,
      maxLength: z.number().int().min(1).max(10_000).default(4_000),
      type: z.literal("textarea"),
    })
    .strict(),
  z.object({ ...inputField, type: z.literal("email") }).strict(),
  z
    .object({
      ...inputField,
      maxLength: z.number().int().min(7).max(40).default(32),
      type: z.literal("telephone"),
    })
    .strict(),
  z
    .object({
      ...inputField,
      max: z.number().finite().optional(),
      min: z.number().finite().optional(),
      type: z.literal("number"),
    })
    .strict()
    .superRefine((field, context) => {
      if (field.min !== undefined && field.max !== undefined && field.min > field.max) {
        context.addIssue({
          code: "custom",
          message: "Minimum cannot be greater than maximum.",
          path: ["min"],
        });
      }
    }),
  z.object({ ...inputField, type: z.literal("date") }).strict(),
  z
    .object({ ...inputField, options: optionsSchema, type: z.literal("select") })
    .strict(),
  /**
   * Task 3.2. Structurally identical to `select`, and deliberately so.
   *
   * The two differ in presentation only: both hold one option value from the
   * same `optionsSchema`, and both are parsed by `parseChoice`. Giving `radio`
   * its own option shape or its own parser would create two ways to express one
   * stored contract, which is how a `select` and a `radio` end up disagreeing
   * about what a valid answer is.
   */
  z
    .object({ ...inputField, options: optionsSchema, type: z.literal("radio") })
    .strict(),
  z
    .object({
      ...inputField,
      options: optionsSchema,
      type: z.literal("multi_select"),
    })
    .strict(),
  z.object({ ...inputField, type: z.literal("checkbox") }).strict(),
  z
    .object({ ...inputField, required: z.literal(true), type: z.literal("consent") })
    .strict(),
  z
    .object({
      ...inputField,
      maxFiles: z.number().int().min(1).max(5).default(1),
      type: z.literal("image"),
    })
    .strict(),
  z
    .object({
      ...inputField,
      maxFiles: z.number().int().min(1).max(5).default(1),
      type: z.literal("pdf"),
    })
    .strict(),
]);

export const FormDefinitionSchema = z
  .object({
    fields: z.array(FormFieldSchema).min(1).max(50),
    payment: disabledPaymentSchema.default({ enabled: false }),
  })
  .strict()
  .superRefine((definition, context) => {
    const seen = new Set<string>();

    definition.fields.forEach((field, index) => {
      if (seen.has(field.id)) {
        context.addIssue({
          code: "custom",
          message: "Field IDs must be unique.",
          path: ["fields", index, "id"],
        });
      }

      seen.add(field.id);
    });
  });

export type FormDefinition = z.infer<typeof FormDefinitionSchema>;
export type FormField = FormDefinition["fields"][number];
export type FormAnswers = Record<string, boolean | number | string | string[]>;

/**
 * Field types that carry an author-written option list.
 *
 * One exported list rather than a repeated `type === "a" || type === "b"`.
 * There are four such places (both Studio conversions, the Studio's choices
 * input, and this module's own parsing), and a fifth type added to three of
 * them is a question that silently loses its options on save.
 */
export const CHOICE_FIELD_TYPES = ["multi_select", "radio", "select"] as const;

export type ChoiceFieldType = (typeof CHOICE_FIELD_TYPES)[number];

export function isChoiceFieldType(type: FormFieldType): type is ChoiceFieldType {
  return (CHOICE_FIELD_TYPES as readonly FormFieldType[]).includes(type);
}

export function parseFormDefinition(input: unknown): FormDefinition {
  return FormDefinitionSchema.parse(input);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * A shared rule failure, phrased for a top-level banner. Task 2.3.
 *
 * The rules in `answer-rules.ts` carry no field label, because the client
 * renders them beside a control whose label has just been announced. Here there
 * is no such context, so the label is prefixed.
 */
function assertAnswerRule(field: FormQuestionField, value: boolean | string | string[]) {
  const failure = checkAnswerRule(field, value);

  if (failure) {
    throw new Error(`${field.label}: ${failure}`);
  }
}

function requiredValue(field: FormField, value: unknown) {
  if (value === undefined || value === null || value === "") {
    if ("required" in field && field.required) {
      throw new Error(`${field.label} is required.`);
    }

    return undefined;
  }

  return value;
}

function parseString(field: FormField, value: unknown, maxLength?: number) {
  const required = requiredValue(field, value);
  if (required === undefined) {
    return undefined;
  }

  if (typeof required !== "string") {
    throw new Error(`${field.label} must be text.`);
  }

  const normalized = required.trim();
  if (!normalized) {
    if ("required" in field && field.required) {
      throw new Error(`${field.label} is required.`);
    }

    return undefined;
  }

  if (maxLength !== undefined && normalized.length > maxLength) {
    // Message shared with the client, which shows the same limit inline rather
    // than the old "is too long", which never said what the limit was.
    throw new Error(`${field.label}: ${tooLongMessage(maxLength)}`);
  }

  return normalized;
}

function parseIsoDate(field: Extract<FormField, { type: "date" }>, value: unknown) {
  const date = parseString(field, value);
  if (date === undefined) {
    return undefined;
  }

  // Shape and calendar reality in one shared check: the regex alone accepts
  // 2026-02-30.
  assertAnswerRule(field, date);

  return date;
}

function parseChoice(field: Extract<FormField, { options: unknown }>, value: unknown) {
  const choice = parseString(field, value);
  if (choice === undefined) {
    return undefined;
  }

  assertAnswerRule(field, choice);

  return choice;
}

function parseMultiChoice(
  field: Extract<FormField, { type: "multi_select" }>,
  value: unknown
) {
  const required = requiredValue(field, value);
  if (required === undefined) {
    return undefined;
  }

  if (!Array.isArray(required) || required.some((item) => typeof item !== "string")) {
    throw new Error(`${field.label} must be a list of options.`);
  }

  const choices = required.map((item) => item.trim()).filter(Boolean);
  if (!choices.length) {
    if (field.required) {
      throw new Error(`${field.label} is required.`);
    }

    return undefined;
  }

  assertAnswerRule(field, choices);

  return choices;
}

function parseAssetIds(
  field: Extract<FormField, { type: "image" | "pdf" }>,
  value: unknown
) {
  const required = requiredValue(field, value);
  if (required === undefined) {
    return undefined;
  }

  if (!Array.isArray(required) || required.length > field.maxFiles) {
    throw new Error(`${field.label} has an invalid number of files.`);
  }

  if (!required.length) {
    if (field.required) {
      throw new Error(`${field.label} is required.`);
    }

    return undefined;
  }

  return required.map((assetId) => assetIdSchema.parse(assetId));
}

export function validateFormAnswers(
  definitionInput: FormDefinition,
  answersInput: unknown
): FormAnswers {
  const definition = FormDefinitionSchema.parse(definitionInput);

  if (!isRecord(answersInput)) {
    throw new Error("Form answers must be an object.");
  }

  const fields = definition.fields.filter(
    (field): field is FormQuestionField => field.type !== "section"
  );
  const fieldIds = new Set(fields.map((field) => field.id));

  for (const key of Object.keys(answersInput)) {
    if (!fieldIds.has(key)) {
      throw new Error(`Unexpected form field: ${key}.`);
    }
  }

  const answers: FormAnswers = {};

  for (const field of fields) {
    const value = answersInput[field.id];
    let parsed: boolean | number | string | string[] | undefined;

    switch (field.type) {
      case "text":
      case "textarea":
      case "telephone":
        parsed = parseString(field, value, field.maxLength);
        break;
      case "email": {
        const email = parseString(field, value);
        if (email === undefined) {
          parsed = undefined;
          break;
        }

        // Was a bare `z.string().email().parse(...)`, whose ZodError was the one
        // message on this path not written for a human to read.
        assertAnswerRule(field, email);
        parsed = email.toLowerCase();
        break;
      }
      case "number": {
        const numberValue = requiredValue(field, value);
        if (numberValue === undefined) {
          parsed = undefined;
          break;
        }

        // Rule first, then coerce: the rule owns "is this acceptable" and this
        // switch owns "what gets stored".
        assertAnswerRule(field, String(numberValue).trim());
        parsed = Number(String(numberValue).trim());
        break;
      }
      case "date":
        parsed = parseIsoDate(field, value);
        break;
      // One arm, because one stored contract. A radio and a dropdown both hold
      // a single option value, so a rule enforced for one has to hold for the
      // other or an author changes the control and changes the validation.
      case "radio":
      case "select":
        parsed = parseChoice(field, value);
        break;
      case "multi_select":
        parsed = parseMultiChoice(field, value);
        break;
      case "checkbox": {
        if (value === undefined || value === null) {
          parsed = false;
          break;
        }
        if (typeof value !== "boolean") {
          throw new Error(`${field.label} must be true or false.`);
        }
        if (field.required && !value) {
          throw new Error(`${field.label} is required.`);
        }
        parsed = value;
        break;
      }
      case "consent":
        if (value !== true) {
          throw new Error(`${field.label} consent is required.`);
        }
        parsed = true;
        break;
      case "image":
      case "pdf":
        parsed = parseAssetIds(field, value);
        break;
    }

    if (parsed !== undefined) {
      answers[field.id] = parsed;
    }
  }

  return answers;
}
