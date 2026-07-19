import { describe, expect, it } from "vitest";

import { parseFormDefinition } from "@/lib/forms/definition";
import {
  formDefinitionToStudioFields,
  studioFieldsToDefinition,
} from "@/lib/forms/form-studio-definition";

describe("Form Studio definition conversion", () => {
  it("emits valid private image and PDF field schema with a one-file default", () => {
    const definition = studioFieldsToDefinition([
      { id: "full_name", label: "Full name", optionsText: "", required: true, type: "text" },
      { id: "student_id", label: "Student ID card", optionsText: "", required: true, type: "image" },
      { id: "cv", label: "CV", optionsText: "", required: false, type: "pdf" },
    ]);

    const parsed = parseFormDefinition(definition);
    expect(parsed.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "student_id", maxFiles: 1, type: "image" }),
        expect.objectContaining({ id: "cv", maxFiles: 1, type: "pdf" }),
      ]),
    );
    expect(parsed.payment).toEqual({ enabled: false });
  });

  it("loads a published definition into editable field controls", () => {
    const fields = formDefinitionToStudioFields(
      parseFormDefinition({
        fields: [
          { id: "full_name", label: "Full name", required: true, type: "text" },
          {
            id: "track",
            label: "Track",
            options: [
              { label: "Web", value: "web" },
              { label: "Mobile", value: "mobile" },
            ],
            required: true,
            type: "select",
          },
          { id: "portfolio", label: "Portfolio", maxFiles: 1, required: false, type: "pdf" },
        ],
        payment: { enabled: false },
      })
    );

    expect(fields).toEqual([
      { id: "full_name", label: "Full name", optionsText: "", required: true, type: "text" },
      { id: "track", label: "Track", optionsText: "Web\nMobile", required: true, type: "select" },
      { id: "portfolio", label: "Portfolio", maxFiles: 1, optionsText: "", required: false, type: "pdf" },
    ]);
  });
});