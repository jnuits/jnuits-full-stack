import {
  parseFormDefinition,
  type FormDefinition,
  type FormFieldType,
} from "@/lib/forms/definition";

export type StudioFieldType = FormFieldType;

export type StudioEditorField = {
  id: string;
  label: string;
  maxFiles?: number;
  optionsText: string;
  required: boolean;
  type: StudioFieldType;
};

function toOptionValue(label: string) {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120);
}

export function studioFieldsToDefinition(fields: StudioEditorField[]): FormDefinition {
  return parseFormDefinition({
    fields: fields.map((field) => {
      if (field.type === "section") {
        return { id: field.id, label: field.label, type: field.type };
      }

      if (field.type === "consent") {
        return { id: field.id, label: field.label, required: true, type: field.type };
      }

      if (field.type === "select" || field.type === "multi_select") {
        const options = field.optionsText
          .split("\n")
          .map((label) => label.trim())
          .filter(Boolean)
          .map((label) => ({ label, value: toOptionValue(label) }));

        return { id: field.id, label: field.label, options, required: field.required, type: field.type };
      }

      if (field.type === "image" || field.type === "pdf") {
        return {
          id: field.id,
          label: field.label,
          maxFiles: field.maxFiles ?? 1,
          required: field.required,
          type: field.type,
        };
      }

      return { id: field.id, label: field.label, required: field.required, type: field.type };
    }),
    payment: { enabled: false },
  });
}

export function formDefinitionToStudioFields(
  definition: FormDefinition,
): StudioEditorField[] {
  return definition.fields.map((field) => {
    if (field.type === "section") {
      return { id: field.id, label: field.label, optionsText: "", required: false, type: field.type };
    }

    if (field.type === "consent") {
      return { id: field.id, label: field.label, optionsText: "", required: true, type: field.type };
    }

    if (field.type === "select" || field.type === "multi_select") {
      return {
        id: field.id,
        label: field.label,
        optionsText: field.options.map((option) => option.label).join("\n"),
        required: field.required,
        type: field.type,
      };
    }

    if (field.type === "image" || field.type === "pdf") {
      return {
        id: field.id,
        label: field.label,
        maxFiles: field.maxFiles,
        optionsText: "",
        required: field.required,
        type: field.type,
      };
    }

    return {
      id: field.id,
      label: field.label,
      optionsText: "",
      required: field.required,
      type: field.type,
    };
  });
}