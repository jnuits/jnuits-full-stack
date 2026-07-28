import { describe, expect, it } from "vitest";

import { parseFormDefinition } from "@/lib/forms/definition";
import {
  groupFormFields,
  resolveFormEyebrow,
  resolveFormLengthSummary,
} from "@/lib/forms/public-form-presentation";

function definitionOf(fields: unknown[]) {
  return parseFormDefinition({ fields, payment: { enabled: false } });
}

const question = (id: string) => ({ id, label: id, required: false, type: "text" });
const section = (id: string) => ({ id, label: id, type: "section" });

function questions(count: number) {
  return Array.from({ length: count }, (_, index) => question(`q${index + 1}`));
}

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

describe("form eyebrow", () => {
  it("labels the form kind above an unrelated title", () => {
    expect(resolveFormEyebrow("membership_application", "Join JnUITS for 2026")).toBe(
      "Membership application"
    );
    expect(resolveFormEyebrow("event_registration", "Hackathon 2026")).toBe(
      "Event registration"
    );
  });

  it("suppresses itself when it would repeat the title", () => {
    // Both published forms are titled exactly after their kind today, so this
    // is the common case rather than an edge case.
    expect(resolveFormEyebrow("membership_application", "Membership application")).toBeNull();
    expect(resolveFormEyebrow("alumni_onboarding", "Alumni onboarding")).toBeNull();
  });

  it("ignores case and surrounding whitespace when comparing", () => {
    expect(resolveFormEyebrow("alumni_onboarding", "  ALUMNI ONBOARDING ")).toBeNull();
  });
});

describe("form length summary", () => {
  it("says nothing about a short flat form", () => {
    // "3 questions" above a three-question form is noise.
    expect(resolveFormLengthSummary(definitionOf(questions(3)))).toBeNull();
    expect(resolveFormLengthSummary(definitionOf(questions(6)))).toBeNull();
  });

  it("counts questions once the form is long enough to warrant it", () => {
    expect(resolveFormLengthSummary(definitionOf(questions(7)))).toBe("7 questions");
  });

  it("reports structure whenever there are several sections, however short", () => {
    const definition = definitionOf([
      section("s1"),
      question("a"),
      section("s2"),
      question("b"),
    ]);

    expect(resolveFormLengthSummary(definition)).toBe("2 questions in 2 sections");
  });

  it("does not count a single section as structure worth previewing", () => {
    const definition = definitionOf([section("s1"), question("a"), question("b")]);

    expect(resolveFormLengthSummary(definition)).toBeNull();
  });

  it("excludes section headings from the question count", () => {
    const definition = definitionOf([
      section("s1"),
      ...questions(4),
      section("s2"),
      question("extra"),
    ]);

    // Five questions, not seven fields.
    expect(resolveFormLengthSummary(definition)).toBe("5 questions in 2 sections");
  });

  it("pluralises a single question correctly", () => {
    const definition = definitionOf([section("s1"), question("a"), section("s2")]);

    expect(resolveFormLengthSummary(definition)).toBe("1 question in 2 sections");
  });
});
