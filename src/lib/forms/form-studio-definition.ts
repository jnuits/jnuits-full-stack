import {
  parseFormDefinition,
  type FormDefinition,
  type FormFieldType,
} from "@/lib/forms/definition";

export type StudioFieldType = FormFieldType;
export type StudioEditorField = {
  automaticId?: boolean;
  /**
   * Stable identity for the editor row, distinct from the schema `id`.
   *
   * While a question is unsaved its `id` is regenerated from the label on
   * every keystroke, so keying React on `id` unmounts and remounts the row as
   * the operator types and the label input loses focus after one character.
   *
   * This value is assigned once when the row appears and never changes. It is
   * client-only: `studioFieldsToDefinition` builds its output field by field,
   * so it never reaches a published schema.
   */
  editorKey: string;
  id: string;
  label: string;
  maxFiles?: number;
  optionsText: string;
  required: boolean;
  type: StudioFieldType;
};

const RESERVED_FIELD_IDS = new Set(["__proto__", "constructor", "prototype"]);
const MAX_FIELD_ID_LENGTH = 64;

/**
 * A counter rather than a random value: it needs to be unique within one
 * editing session, not globally, and a deterministic sequence keeps tests
 * readable. It is never persisted, so uniqueness across reloads is irrelevant.
 */
let editorKeySequence = 0;

export function createStudioEditorKey() {
  editorKeySequence += 1;
  return `studio-field-${editorKeySequence}`;
}

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

/**
 * Note that `editorKey` is carried through untouched. The whole point is that
 * relabelling moves `id` and nothing else.
 */
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
  return {
    ...field,
    automaticId: true,
    // A fresh key is not optional. Inheriting the source's key would give two
    // rows the same key, and React would reconcile them as a single row.
    editorKey: createStudioEditorKey(),
    id: createUniqueStudioFieldId(field.label, existingIds),
  };
}

function toOptionValue(label: string) {
  return label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 120);
}

/**
 * Builds the published schema field by field, so no editor-only property can
 * reach a stored definition.
 */
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
    const editorKey = createStudioEditorKey();
    if (field.type === "section") return { editorKey, id: field.id, label: field.label, optionsText: "", required: false, type: field.type };
    if (field.type === "consent") return { editorKey, id: field.id, label: field.label, optionsText: "", required: true, type: field.type };
    if (field.type === "select" || field.type === "multi_select") return {
      editorKey, id: field.id, label: field.label, optionsText: field.options.map((option) => option.label).join("\n"), required: field.required, type: field.type,
    };
    if (field.type === "image" || field.type === "pdf") return {
      editorKey, id: field.id, label: field.label, maxFiles: field.maxFiles, optionsText: "", required: field.required, type: field.type,
    };
    return { editorKey, id: field.id, label: field.label, optionsText: "", required: field.required, type: field.type };
  });
}
