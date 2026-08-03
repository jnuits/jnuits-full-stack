import { describe, expect, it } from "vitest";

import {
  checkAnswerRule,
  describeAnswerConstraint,
  isRealIsoDate,
  tooLongMessage,
  type FormQuestionField,
} from "@/lib/forms/answer-rules";
import { parseFormDefinition } from "@/lib/forms/definition";

/**
 * Tasks 2.3, 2.5 and 2.7.
 *
 * Fixtures go through `parseFormDefinition` rather than being written as object
 * literals, so no rule is ever tested against a field shape the schema would
 * have rejected. Zod also applies its defaults here — `text` gets its 160
 * character cap — which is exactly the value the rule has to agree with.
 */
function fieldOf(input: Record<string, unknown>): FormQuestionField {
  const [field] = parseFormDefinition({
    fields: [input],
    payment: { enabled: false },
  }).fields;

  if (field.type === "section") {
    throw new Error("This fixture is meant to be a question.");
  }

  return field;
}

const emailField = fieldOf({ id: "email", label: "Email", required: true, type: "email" });
const textField = fieldOf({ id: "about", label: "About", required: false, type: "text" });
const dateField = fieldOf({ id: "born_on", label: "Born on", required: false, type: "date" });
const consentField = fieldOf({ id: "terms", label: "Terms", required: true, type: "consent" });
const uploadField = fieldOf({ id: "cv", label: "CV", maxFiles: 1, required: false, type: "pdf" });

const numberField = (bounds: Record<string, number>) =>
  fieldOf({ id: "guests", label: "Guests", required: false, type: "number", ...bounds });

const choiceField = (type: "multi_select" | "radio" | "select") =>
  fieldOf({
    id: "track",
    label: "Track",
    options: [
      { label: "Web", value: "web" },
      { label: "Mobile", value: "mobile" },
    ],
    required: false,
    type,
  });

describe("an empty answer is never a rule failure", () => {
  it.each([
    ["an absent string", emailField, ""],
    ["whitespace only", emailField, "   "],
    ["an empty group", choiceField("multi_select"), [] as string[]],
    ["an unticked checkbox", consentField, false],
  ])("%s passes, because requiredness is not a rule", (_name, field, value) => {
    // Requiredness is the browser's job on the client and `requiredValue`'s job
    // on the server. A rule that also reported it would produce two messages
    // for one problem, or the wrong one.
    expect(checkAnswerRule(field, value)).toBeUndefined();
  });
});

/**
 * Task 2.5, and the reason the client needs a rule pass at all.
 */
describe("email shape, which the browser and the server disagree about", () => {
  it("accepts an ordinary address", () => {
    expect(checkAnswerRule(emailField, "member@example.test")).toBeUndefined();
  });

  it.each(["someone@localhost", "a@b"])(
    "rejects %s, which `<input type=\"email\">` accepts",
    (address) => {
      // The HTML spec's email syntax permits a bare domain label, so the browser
      // is satisfied and the server is not. Before task 2.3 that combination
      // produced a clean submit followed by a top-level rejection naming no
      // field, which is the worst possible place to learn about it.
      expect(checkAnswerRule(emailField, address)).toBe(
        "Enter an email address in the form name@example.com."
      );
    }
  );

  it.each(["not-an-email", "missing@", "@example.test"])("rejects %s", (address) => {
    expect(checkAnswerRule(emailField, address)).toBeTruthy();
  });

  it("ignores surrounding whitespace, as the server does before storing", () => {
    expect(checkAnswerRule(emailField, "  member@example.test  ")).toBeUndefined();
  });
});

describe("number range", () => {
  it("rejects a value that is not a number", () => {
    expect(checkAnswerRule(numberField({}), "seven")).toBe("Enter a number.");
  });

  it("names the bound it failed rather than saying a bound exists", () => {
    // The server used to say "is below the minimum", which told a respondent
    // there was a limit and not what it was.
    expect(checkAnswerRule(numberField({ min: 1 }), "0")).toBe("Enter 1 or more.");
    expect(checkAnswerRule(numberField({ max: 5 }), "6")).toBe("Enter 5 or less.");
  });

  it("accepts the bounds themselves, which are inclusive", () => {
    const field = numberField({ max: 5, min: 1 });

    expect(checkAnswerRule(field, "1")).toBeUndefined();
    expect(checkAnswerRule(field, "5")).toBeUndefined();
  });

  it("leaves an unbounded number alone", () => {
    expect(checkAnswerRule(numberField({}), "-4000")).toBeUndefined();
  });
});

/**
 * Task 2.7. The affordance half — enforcement was already working, silently.
 */
describe("describing a number's range up front", () => {
  it.each([
    [{ max: 10, min: 1 }, "Enter a number between 1 and 10."],
    [{ min: 1 }, "Enter 1 or more."],
    [{ max: 10 }, "Enter 10 or less."],
  ])("%o reads as %s", (bounds, expected) => {
    expect(describeAnswerConstraint(numberField(bounds))).toBe(expected);
  });

  it("says nothing about an unbounded number", () => {
    // Not cosmetic: the renderer keys the note's id off this, so a non-empty
    // string here would point aria-describedby at an empty paragraph.
    expect(describeAnswerConstraint(numberField({}))).toBeUndefined();
  });

  it("says nothing about a field that has no range", () => {
    expect(describeAnswerConstraint(textField)).toBeUndefined();
    expect(describeAnswerConstraint(dateField)).toBeUndefined();
  });
});

describe("dates that look real and are not", () => {
  it("accepts a real date", () => {
    expect(checkAnswerRule(dateField, "2026-08-01")).toBeUndefined();
  });

  it.each(["2026-02-30", "2026-13-01", "2027-02-29"])("rejects %s", (date) => {
    // The shape test alone accepts all three. February 29th in a non-leap year
    // is the one a regex will never catch.
    expect(isRealIsoDate(date)).toBe(false);
    expect(checkAnswerRule(dateField, date)).toBeTruthy();
  });

  it("accepts a leap day in a leap year", () => {
    expect(isRealIsoDate("2028-02-29")).toBe(true);
  });

  it("rejects a date that is not ISO at all", () => {
    expect(checkAnswerRule(dateField, "01/08/2026")).toBeTruthy();
  });
});

describe("choices", () => {
  it.each(["radio", "select"] as const)("accepts a listed option on a %s", (type) => {
    expect(checkAnswerRule(choiceField(type), "web")).toBeUndefined();
  });

  it.each(["radio", "select"] as const)("rejects an unlisted option on a %s", (type) => {
    // Neither control can produce this by hand, but a replayed or crafted
    // request can, and the server has always rejected it.
    expect(checkAnswerRule(choiceField(type), "desktop")).toBe("Choose one of the listed options.");
  });

  it("accepts several listed options on a checkbox group", () => {
    expect(checkAnswerRule(choiceField("multi_select"), ["web", "mobile"])).toBeUndefined();
  });

  it("rejects a repeated option", () => {
    expect(checkAnswerRule(choiceField("multi_select"), ["web", "web"])).toBe(
      "Each option can only be chosen once."
    );
  });

  it("rejects an unlisted option among listed ones", () => {
    expect(checkAnswerRule(choiceField("multi_select"), ["web", "desktop"])).toBeTruthy();
  });
});

describe("length", () => {
  it("accepts an answer at the schema's default cap", () => {
    expect(checkAnswerRule(textField, "a".repeat(160))).toBeUndefined();
  });

  it("names the cap when it is exceeded", () => {
    expect(checkAnswerRule(textField, "a".repeat(161))).toBe(tooLongMessage(160));
    expect(tooLongMessage(160)).toBe("Shorten this to 160 characters or fewer.");
  });
});

describe("answers this module deliberately does not judge", () => {
  it("passes an upload, whose asset ids it cannot verify", () => {
    // The server checks these against the upload proof, not against a rule, and
    // the client has no asset id until the upload finishes.
    expect(checkAnswerRule(uploadField, "C:\\fakepath\\cv.pdf")).toBeUndefined();
  });

  it("passes a ticked consent", () => {
    expect(checkAnswerRule(consentField, true)).toBeUndefined();
  });
});
