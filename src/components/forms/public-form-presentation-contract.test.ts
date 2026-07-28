import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Static contract guards for the public form's presentation.
 *
 * This repository has no jsdom or Testing Library setup (issue #52), and the
 * project rule forbids adding dependencies without approval, so rendered
 * output cannot be asserted yet. What can be asserted is what actually broke.
 * Mirrors the existing pattern in
 * src/lib/forms/unapplied-migration-runtime.test.ts.
 *
 * Logic that can be extracted lives in src/lib/forms/public-form-presentation.ts
 * and has real unit tests. These guards cover only what is unavoidably inline.
 *
 * Replace with real component tests once #52 lands.
 */

const screenPath = resolve(
  process.cwd(),
  "src/components/forms/public-form-screen.tsx"
);
const controlsPath = resolve(
  process.cwd(),
  "src/components/forms/form-field-controls.tsx"
);

/**
 * Every guard below is a statement about rendered output, so comments are not
 * part of the subject.
 *
 * This is not hygiene. The h1 guard failed on its own subject: the JSDoc that
 * explains why there is exactly one `<h1>` says so twice, and both sentences
 * contain the literal, so the count came back as three. A guard that prose can
 * break measures the wrong thing.
 *
 * It also means documenting a colour literal in a comment no longer trips the
 * dark-mode guards, which is right, because a comment renders nothing.
 */
function stripComments(source: string) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
}

function readScreen() {
  return stripComments(readFileSync(screenPath, "utf8"));
}

function readControls() {
  return stripComments(readFileSync(controlsPath, "utf8"));
}

describe("public form dark mode", () => {
  // The site header ships a theme toggle. Every status surface here used
  // `border-red-500/30 bg-red-500/10 text-red-700` with no dark variant, so
  // the error states rendered dark red on a dark background.
  const HARDCODED_COLOUR = /\b(?:text|bg|border)-(?:red|green|emerald|amber|yellow|orange)-\d{2,3}\b/;

  it("uses no hardcoded colour literal in the public form screen", () => {
    const matches = readScreen().match(new RegExp(HARDCODED_COLOUR, "g"));

    expect(matches, `Use a semantic token instead: ${matches?.join(", ")}`).toBeNull();
  });

  it("uses no hardcoded colour literal in the shared field renderer", () => {
    const matches = readControls().match(new RegExp(HARDCODED_COLOUR, "g"));

    expect(matches, `Use a semantic token instead: ${matches?.join(", ")}`).toBeNull();
  });

  it("routes every error surface through one destructive token constant", () => {
    const screen = readScreen();

    expect(screen).toContain("NOTICE_ERROR_CLASS");
    expect(screen).toContain("border-destructive/30");
    expect(screen).toContain("bg-destructive/10");
    expect(screen).toContain("text-destructive");
  });
});

describe("public form layout", () => {
  it("centres the form rather than pinning it to the left edge", () => {
    const screen = readScreen();

    // Centring moved from the card to the wrapper when the header block landed
    // above the card: both have to share one measure. `max-w-2xl` on the card
    // alone left everything against the left edge on a wide viewport.
    expect(screen).toContain("PAGE_WRAPPER_CLASS");
    expect(screen).toContain("mx-auto w-full max-w-2xl");
    expect(screen).toContain("FORM_CARD_CLASS");
  });

  it("wraps both the form and the success state in the centred shell", () => {
    const screen = readScreen();
    const wrappers = screen.match(/className=\{PAGE_WRAPPER_CLASS\}/g);
    const cards = screen.match(/className=\{FORM_CARD_CLASS\}/g);

    // Success and form. They drifted apart before because each carried its own
    // copy of the class string.
    expect(wrappers?.length).toBe(2);
    expect(cards?.length).toBe(2);
    expect(screen).not.toContain('className="glass-card max-w-2xl');
  });

  it("renders the form title as the page's only h1", () => {
    const screen = readScreen();
    const headingOnes = screen.match(/<h1\b/g);

    // The title used to live inside the card, which meant an h1 per card and
    // h2 section headings as its siblings rather than its children.
    expect(headingOnes?.length).toBe(1);
    expect(screen).toContain("PublicFormHeader");
    // The success card sits under that h1, so its heading is a level down.
    expect(screen).toMatch(/<h2[^>]*>\s*\{eventSuccessContent \? eventSuccessContent\.heading/);
  });

  it("shows the eyebrow and length affordance only when resolved", () => {
    const screen = readScreen();

    // Both helpers return null deliberately; rendering an empty pill or a bare
    // "0 questions" line would be worse than omitting them.
    expect(screen).toContain("resolveFormEyebrow");
    expect(screen).toContain("resolveFormLengthSummary");
    expect(screen).toContain("{eyebrow ? (");
    expect(screen).toContain("{lengthSummary ? (");
  });
});

describe("section grouping", () => {
  it("renders each section as a region owning its questions", () => {
    const controls = readControls();

    // The section heading used to sit in a `<section>` that wrapped nothing but
    // itself, so aria-labelledby pointed at a region with no controls in it.
    expect(controls).toContain("groupFormFields");
    expect(controls).toContain("aria-labelledby={headingId}");
    expect(controls).toContain('<div className="mt-5 grid gap-5">{questions}</div>');
  });

  it("gives a section a visible container rather than only a top border", () => {
    const controls = readControls();

    expect(controls).toContain(
      'className="rounded-xl border border-[var(--line)] bg-[var(--bg)] p-5"'
    );
  });
});

describe("field control treatment", () => {
  it("themes the file input's native button", () => {
    const controls = readControls();

    // `input-field` cannot reach ::file-selector-button, so the file control
    // rendered as the browser's grey default beside fully themed neighbours.
    expect(controls).toContain("FILE_INPUT_CLASS");
    expect(controls).toContain("file:rounded-lg");
    expect(controls).toContain("file:bg-[var(--brand-blue)]");
    expect(controls).toContain('className={FILE_INPUT_CLASS}');
  });

  it("keeps the native file input rather than a custom widget", () => {
    const controls = readControls();

    // A replacement widget reimplements focus, drag-and-drop, and the AT
    // mapping the native control already provides. Task 2.8 adds progress
    // around it, not instead of it.
    expect(controls).toContain('type="file"');
  });

  it("says where a date field's displayed format comes from", () => {
    const controls = readControls();

    // <input type="date"> follows the browser locale and takes no display
    // format, so mm/dd/yyyy can appear on a Bangladeshi site. The stored value
    // is ISO regardless; the risk is misreading which box is the month.
    expect(controls).toContain("DateFormatNote");
    expect(controls).toContain("Shown in your browser");
    expect(controls).toContain('{field.type === "date" ? <DateFormatNote /> : null}');
  });
});

describe("required field marker", () => {
  it("keeps the marker inline with the label text", () => {
    const controls = readControls();

    // `.input-label` stacks its children, so a bare sibling span landed on its
    // own line and every required field showed a lone asterisk beneath it.
    expect(controls).toContain("inline-flex flex-wrap items-baseline");
    expect(controls).not.toContain('<span aria-hidden="true"> *</span>');
  });

  it("gives the marker an accessible name instead of hiding it entirely", () => {
    const controls = readControls();

    // The asterisk stays decorative; the sr-only text is what is announced.
    // Previously the marker was aria-hidden with no replacement, leaving the
    // `required` attribute as the only signal.
    expect(controls).toContain("RequiredMarker");
    expect(controls).toContain('<span className="sr-only">(required)</span>');
  });

  it("marks consent and required checkboxes, not only consent", () => {
    const controls = readControls();

    // The checkbox branch previously marked `consent` alone, so a required
    // checkbox rendered with no marker at all.
    expect(controls).toContain('field.type === "consent" || field.required ? (');
  });
});
