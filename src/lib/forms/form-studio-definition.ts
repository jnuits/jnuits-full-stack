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
  /**
   * Optional help text for one question. Task 3.1.
   *
   * Optional rather than an always-present string like `optionsText`, because
   * absent and empty must stay distinguishable on the way out: see `toHelpText`.
   */
  helpText?: string;
  id: string;
  label: string;
  maxFiles?: number;
  /** Keeps legacy section guidance only when it came from stored data. */
  preserveSectionHelpText?: boolean;
  optionsText: string;
  required: boolean;
  type: StudioFieldType;
};

/**
 * The authoring limit for help text, which is also the schema's limit.
 *
 * `helpTextSchema` in `definition.ts` caps at the same number. A second literal
 * can drift, and the drift is invisible until an operator has written 520
 * characters and the save fails Zod, so the conversion test asserts both ends of
 * it: this length parses and one more character does not.
 */
export const STUDIO_HELP_TEXT_MAX_LENGTH = 500;

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
 * Help text as a schema entry, or nothing at all. Task 3.1.
 *
 * Trimmed, and omitted entirely when it is empty. `helpText: ""` parses happily
 * and is a defect on the page: task 2.1 points `aria-describedby` at the help
 * paragraph, so an empty string leaves an empty paragraph under the control and
 * gives it a description that announces nothing. Omission is the only value that
 * means "this question has no help text".
 */
function toHelpText(field: StudioEditorField) {
  if (field.type === "section" && !field.preserveSectionHelpText) return {};

  const helpText = field.helpText?.trim();
  return helpText ? { helpText } : {};
}

/**
 * Builds the published schema field by field, so no editor-only property can
 * reach a stored definition.
 */
export function studioFieldsToDefinition(fields: StudioEditorField[]): FormDefinition {
  return parseFormDefinition({
    fields: fields.map((field) => {
      if (field.type === "section") return { ...toHelpText(field), id: field.id, label: field.label, type: field.type };
      if (field.type === "consent") return { ...toHelpText(field), id: field.id, label: field.label, required: true, type: field.type };
      if (field.type === "select" || field.type === "multi_select") {
        const options = field.optionsText.split("\n").map((label) => label.trim()).filter(Boolean)
          .map((label) => ({ label, value: toOptionValue(label) }));
        return { ...toHelpText(field), id: field.id, label: field.label, options, required: field.required, type: field.type };
      }
      if (field.type === "image" || field.type === "pdf") return {
        ...toHelpText(field), id: field.id, label: field.label, maxFiles: field.maxFiles ?? 1, required: field.required, type: field.type,
      };
      return { ...toHelpText(field), id: field.id, label: field.label, required: field.required, type: field.type };
    }),
    payment: { enabled: false },
  });
}

export function formDefinitionToStudioFields(definition: FormDefinition): StudioEditorField[] {
  return definition.fields.map((field) => {
    const editorKey = createStudioEditorKey();
    // Read back on every branch, not only the ones the Studio can author: a
    // stored definition that carries help text must not lose it because an
    // operator opened the form and saved a new draft.
    if (field.type === "section") return {
      editorKey,
      helpText: field.helpText,
      id: field.id,
      label: field.label,
      optionsText: "",
      preserveSectionHelpText: Boolean(field.helpText),
      required: false,
      type: field.type,
    };
    if (field.type === "consent") return { editorKey, helpText: field.helpText, id: field.id, label: field.label, optionsText: "", required: true, type: field.type };
    if (field.type === "select" || field.type === "multi_select") return {
      editorKey, helpText: field.helpText, id: field.id, label: field.label, optionsText: field.options.map((option) => option.label).join("\n"), required: field.required, type: field.type,
    };
    if (field.type === "image" || field.type === "pdf") return {
      editorKey, helpText: field.helpText, id: field.id, label: field.label, maxFiles: field.maxFiles, optionsText: "", required: field.required, type: field.type,
    };
    return { editorKey, helpText: field.helpText, id: field.id, label: field.label, optionsText: "", required: field.required, type: field.type };
  });
}
