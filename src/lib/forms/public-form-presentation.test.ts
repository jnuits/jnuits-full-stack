import { describe, expect, it } from "vitest";

import { parseFormDefinition } from "@/lib/forms/definition";
import { groupFormFields } from "@/lib/forms/public-form-presentation";

function definitionOf(fields: unknown[]) {
  return parseFormDefinition({ fields, payment: { enabled: false } });
}

const question = (id: string) => ({ id, label: id, required: false, type: "text" });
const section = (id: string) => ({ id, label: id, type: "section" });

describe("grouping fields under their section heading", () => {
  it("returns a single unsectioned group when the form has no headings", () => {
    const groups = groupFormFields(definitionOf([question("a"), question("b")]));

    expect(groups).toHaveLength(1);
    expect(groups[0].section).toBeNull();
    expect(groups[0].fields.map((field) => field.id)).toEqual(["a", "b"]);
  });

  it("keeps questions that appear before the first heading in their own group", () => {
    const groups = groupFormFields(
      definitionOf([question("a"), section("s1"), question("b")])
    );

    expect(groups).toHaveLength(2);
    expect(groups[0].section).toBeNull();
    expect(groups[0].fields.map((field) => field.id)).toEqual(["a"]);
    expect(groups[1].section?.id).toBe("s1");
    expect(groups[1].fields.map((field) => field.id)).toEqual(["b"]);
  });

  it("emits no empty leading group when the form opens with a heading", () => {
    const groups = groupFormFields(definitionOf([section("s1"), question("a")]));

    // A stray empty container above the first heading would add spacing that
    // looks like a rendering bug.
    expect(groups).toHaveLength(1);
    expect(groups[0].section?.id).toBe("s1");
    expect(groups[0].fields.map((field) => field.id)).toEqual(["a"]);
  });

  it("keeps a heading that owns no questions, rather than dropping it", () => {
    // Two headings in a row is valid schema. The author wrote both and expects
    // to see both.
    const groups = groupFormFields(
      definitionOf([section("s1"), section("s2"), question("a")])
    );

    expect(groups.map((group) => group.section?.id)).toEqual(["s1", "s2"]);
    expect(groups[0].fields).toEqual([]);
    expect(groups[1].fields.map((field) => field.id)).toEqual(["a"]);
  });

  it("keeps a trailing heading with nothing after it", () => {
    const groups = groupFormFields(definitionOf([question("a"), section("s1")]));

    expect(groups).toHaveLength(2);
    expect(groups[1].section?.id).toBe("s1");
    expect(groups[1].fields).toEqual([]);
  });

  it("preserves author order across several groups", () => {
    const groups = groupFormFields(
      definitionOf([
        question("a"),
        section("s1"),
        question("b"),
        question("c"),
        section("s2"),
        question("d"),
      ])
    );

    expect(
      groups.map((group) => [group.section?.id ?? null, group.fields.map((f) => f.id)])
    ).toEqual([
      [null, ["a"]],
      ["s1", ["b", "c"]],
      ["s2", ["d"]],
    ]);
  });

  it("never loses or duplicates a question", () => {
    const definition = definitionOf([
      question("a"),
      section("s1"),
      question("b"),
      section("s2"),
      question("c"),
      question("d"),
    ]);
    const grouped = groupFormFields(definition).flatMap((group) =>
      group.fields.map((field) => field.id)
    );
    const expected = definition.fields
      .filter((field) => field.type !== "section")
      .map((field) => field.id);

    expect(grouped).toEqual(expected);
  });
});
