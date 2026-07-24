import {
  parseFormDefinition,
  type FormDefinition,
  type FormFieldType,
} from "@/lib/forms/definition";

export type StudioFieldType = FormFieldType;
export type StudioEditorField = {
  automaticId?: boolean;
  id: string;
  label: string;
  maxFiles?: number;
  optionsText: string;
  required: boolean;
  type: StudioFieldType;
};

const RESERVED_FIELD_IDS = new Set(["__proto__", "constructor", "prototype"]);
const MAX_FIELD_ID_LENGTH = 64;

function stableLabelHash(value: string) {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function normalizedFieldIdBase(label: string) {
  const normalized = label.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").replace(/^[^a-z]+/, "").slice(0, MAX_FIELD_ID_LENGTH);
  if (normalized && !RESERVED_FIELD_IDS.has(normalized)) return normalized;
  const meaningfulLabel = label.trim();
  return meaningfulLabel ? `field_${stableLabelHash(meaningfulLabel)}` : "field";
}

export function createUniqueStudioFieldId(label: string, existingIds: Iterable<string>) {
  const used = new Set(existingIds);
  const base = normalizedFieldIdBase(label);
  if (!used.has(base) && !RESERVED_FIELD_IDS.has(base)) return base;
  for (let suffix = 2; suffix < 10_000; suffix += 1) {
    const suffixText = `_${suffix}`;
    const candidate = `${base.slice(0, MAX_FIELD_ID_LENGTH - suffixText.length)}${suffixText}`;
    if (!used.has(candidate) && !RESERVED_FIELD_IDS.has(candidate)) return candidate;
  }
  throw new Error("A unique field identifier could not be generated.");
}

export function updateAutomaticStudioFieldLabel(fields: readonly StudioEditorField[], index: number, label: string) {
  return fields.map((field, position) => {
    if (position !== index) return field;
    if (!field.automaticId) return { ...field, label };
    return {
      ...field,
      id: createUniqueStudioFieldId(label, fields.filter((_, otherPosition) => otherPosition !== index).map((candidate) => candidate.id)),
      label,
    };
  });
}

export function markStudioFieldIdsPersisted(fields: readonly StudioEditorField[]) {
  return fields.map((field) => {
    const persisted = { ...field };
    delete persisted.automaticId;
    return persisted;
  });
}

export function duplicateStudioField(field: StudioEditorField, existingIds: Iterable<string>): StudioEditorField {
  return { ...field, automaticId: true, id: createUniqueStudioFieldId(field.label, existingIds) };
}

function toOptionValue(label: string) {
  return label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 120);
}

export function studioFieldsToDefinition(fields: StudioEditorField[]): FormDefinition {
  return parseFormDefinition({
    fields: fields.map((field) => {
      if (field.type === "section") return { id: field.id, label: field.label, type: field.type };
      if (field.type === "consent") return { id: field.id, label: field.label, required: true, type: field.type };
      if (field.type === "select" || field.type === "multi_select") {
        const options = field.optionsText.split("\n").map((label) => label.trim()).filter(Boolean)
          .map((label) => ({ label, value: toOptionValue(label) }));
        return { id: field.id, label: field.label, options, required: field.required, type: field.type };
      }
      if (field.type === "image" || field.type === "pdf") return {
        id: field.id, label: field.label, maxFiles: field.maxFiles ?? 1, required: field.required, type: field.type,
      };
      return { id: field.id, label: field.label, required: field.required, type: field.type };
    }),
    payment: { enabled: false },
  });
}

export function formDefinitionToStudioFields(definition: FormDefinition): StudioEditorField[] {
  return definition.fields.map((field) => {
    if (field.type === "section") return { id: field.id, label: field.label, optionsText: "", required: false, type: field.type };
    if (field.type === "consent") return { id: field.id, label: field.label, optionsText: "", required: true, type: field.type };
    if (field.type === "select" || field.type === "multi_select") return {
      id: field.id, label: field.label, optionsText: field.options.map((option) => option.label).join("\n"), required: field.required, type: field.type,
    };
    if (field.type === "image" || field.type === "pdf") return {
      id: field.id, label: field.label, maxFiles: field.maxFiles, optionsText: "", required: field.required, type: field.type,
    };
    return { id: field.id, label: field.label, optionsText: "", required: field.required, type: field.type };
  });
}
