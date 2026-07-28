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
 * This is not hygiene. The heading-count guard failed on its own subject: the
 * JSDoc that explains why there is exactly one top-level heading said so twice,
 * and both sentences contained the literal, so the count came back as three. A
 * guard that prose can break measures the wrong thing.
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

  it("leaves no legacy CSS variable behind on either surface", () => {
    // Decision 7 in #86 says semantic tokens throughout. The legacy
    // `var(--brand-*)` / `var(--line)` / `var(--bg)` set is what made dark mode
    // wrong: #89 repaired four surfaces individually while every control kept
    // its own. Asserting the absence makes it a property of the file rather
    // than something to remember.
    const offenders = [...readScreen().matchAll(/var\(--[a-z-]+\)/g)].concat([
      ...readControls().matchAll(/var\(--[a-z-]+\)/g),
    ]);

    expect(
      offenders.map((match) => match[0]),
      "Use a semantic Tailwind token (border-border, bg-muted, text-foreground, text-muted-foreground, bg-primary) per decision 7."
    ).toEqual([]);
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

  it("renders the form title as the page's only top-level heading", () => {
    const screen = readScreen();
    const headingOnes = screen.match(/<h1\b/g);

    // The title used to live inside the card, which meant one per card and the
    // section headings as its siblings rather than its children.
    expect(headingOnes?.length).toBe(1);
    expect(screen).toContain("PublicFormHeader");
    // The success card sits under that heading, so its own is a level down.
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

describe("contact card idiom", () => {
  it("uses the contact card shell rather than glass-card", () => {
    const screen = readScreen();

    // Decision 7 in #86. Two card idioms for the two public forms on the site
    // was the finding; this is the one that won.
    expect(screen).toContain("rounded-2xl border border-border bg-card shadow-sm");
    expect(screen).not.toMatch(/glass-card/);
  });

  it("gives both card states the primary accent bar", () => {
    const screen = readScreen();
    const accents = screen.match(/className=\{FORM_CARD_ACCENT_CLASS\}/g);

    expect(screen).toContain("h-[3px] bg-primary");
    expect(accents?.length).toBe(2);
  });

  it("shares one focus ring across every control", () => {
    const controls = readControls();

    // Three controls carried subtly different variants of this before. One base
    // string means a change reaches all of them or none.
    expect(controls).toContain("FIELD_BASE_CLASS");
    expect(controls).toContain("focus:border-primary focus:ring-2 focus:ring-primary/20");
    expect(controls).toContain("rounded-xl border border-border bg-background");
  });

  it("keeps the multi-select and file control off the fixed row height", () => {
    const controls = readControls();

    // `multi_select` sets `size`, so a fixed height would crop the option list
    // to one row. The file control needs room for the browser's own button.
    expect(controls).toContain("MULTI_SELECT_CLASS");
    expect(controls).toContain("multiple ? MULTI_SELECT_CLASS : SELECT_CLASS");
    expect(controls).toContain("min-h-12");
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

    expect(controls).toContain("SECTION_CLASS");
    expect(controls).toContain('"rounded-xl border border-border bg-muted/30 p-5"');
  });
});

describe("field control treatment", () => {
  it("themes the file input's native button", () => {
    const controls = readControls();

    // The base class cannot reach ::file-selector-button, so the file control
    // rendered as the browser's grey default beside fully themed neighbours.
    expect(controls).toContain("FILE_INPUT_CLASS");
    expect(controls).toContain("file:rounded-lg");
    expect(controls).toContain("file:bg-primary");
    expect(controls).toContain("className={FILE_INPUT_CLASS}");
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

    // The native date control follows the browser locale and takes no display
    // format, so mm/dd/yyyy can appear on a Bangladeshi site. The stored value
    // is ISO regardless; the risk is misreading which box is the month.
    expect(controls).toContain("DateFormatNote");
    expect(controls).toContain("Shown in your browser");
    expect(controls).toContain('{field.type === "date" ? <DateFormatNote /> : null}');
  });
});

describe("verification chip", () => {
  it("collapses the challenge without unmounting the field", () => {
    const screen = readScreen();

    // The field owns the hidden captchaToken input. Unmounting it on success
    // would discard the very token the chip is celebrating, turning a visual
    // change into a silently broken submit.
    expect(screen).toContain("VerifiedTurnstileField");
    expect(screen).toContain("onTokenChange");
    expect(screen).toContain('verified ? "hidden" : undefined');
  });

  it("does not copy contact's focusable-while-invisible collapse", () => {
    const screen = readScreen();

    // `h-0 opacity-0 overflow-hidden` keeps the challenge iframe in the tab
    // order, so a keyboard user can land on a widget nobody can see.
    // `display: none` removes it from the tab order and the a11y tree, and a
    // hidden input still submits under it.
    expect(screen).not.toContain("h-0 opacity-0");
  });

  it("routes every challenge through the wrapper", () => {
    const screen = readScreen();
    const rawFields = screen.match(/<TurnstileField\b/g);
    const wrapped = screen.match(/<VerifiedTurnstileField\b/g);

    // One raw usage, inside the wrapper. Both the submit form and the resend
    // form go through the wrapper, so neither can drift back to the bare
    // widget.
    expect(rawFields?.length).toBe(1);
    expect(wrapped?.length).toBe(2);
  });
});

describe("submission feedback", () => {
  it("spins while submitting instead of only swapping the label", () => {
    const screen = readScreen();
    const spinners = screen.match(/className="animate-spin"/g);

    // Submit and resend. aria-busy stays: a spinner is not an announcement.
    expect(screen).toContain("Loader2");
    expect(spinners?.length).toBe(2);
    expect(screen).toContain('aria-busy={state.status === "submitting"}');
  });

  it("confirms success visually, not with a bare heading", () => {
    const screen = readScreen();

    // The success state replaced the whole card with a heading and a paragraph,
    // so nothing signalled success except the words.
    expect(screen).toContain("CheckCircle2");
    expect(screen).toContain("NOTICE_SUCCESS_CLASS");
    expect(screen).toMatch(/rounded-full border border-border bg-primary\/10 text-primary/);
  });

  it("never nests one live region inside another", () => {
    const screen = readScreen();
    const statusRegions = screen.match(/role="status"/g);

    // The success card used to carry `aria-live` on the whole `<section>`, so
    // the two chips added in this slice became live regions inside a live
    // region, which either double-announces or is dropped entirely depending on
    // the screen reader.
    //
    // Three, each around exactly one thing that changes: the success block, the
    // verification chip, and the resend confirmation.
    expect(statusRegions?.length).toBe(3);
    expect(screen).not.toMatch(/className=\{FORM_CARD_CLASS\}[^>]*aria-live/);
    expect(screen).toContain('<div aria-live="polite" className="text-center" role="status">');
  });

  it("keeps failures assertive and separate from status", () => {
    const screen = readScreen();
    const alerts = screen.match(/role="alert"/g);

    // Unavailable target, unavailable captcha, submit failure, resend failure.
    // `aria-live="polite"` was removed from the submit error: `role="alert"`
    // already implies assertive, and pairing it with polite contradicts itself.
    expect(alerts?.length).toBe(4);
    expect(screen).not.toMatch(/role="alert" aria-live="polite"/);
  });
});

describe("required field marker", () => {
  it("keeps the marker inline with the label text", () => {
    const controls = readControls();

    // The label stacks its children, so a bare sibling span landed on its own
    // line and every required field showed a lone asterisk beneath it.
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
