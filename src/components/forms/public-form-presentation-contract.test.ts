import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Source-text guards for what cannot be observed at runtime.
 *
 * **The rule for this file, now that #52 has landed component tests:** a guard
 * belongs here only when jsdom cannot answer the question. jsdom resolves no
 * stylesheet and performs no layout, so a Tailwind class name is invisible to
 * it: `bg-primary` produces no computed colour and `h-12` produces no height.
 * Asserting the class as source text is the only available check.
 *
 * Anything about structure, roles, accessible names, or behaviour has moved to
 * `form-field-controls.dom.test.tsx` and
 * `public-form-screen.dom.test.tsx`, where it is asserted against the rendered
 * tree instead of implied by a string match. Do not add such a guard back here.
 *
 * Comments are stripped before matching. That is not hygiene: the heading-count
 * guard once failed on its own JSDoc, which explained why there is exactly one
 * top-level heading and contained the literal twice. A guard that prose can
 * break measures the wrong thing.
 */

const screenPath = resolve(
  process.cwd(),
  "src/components/forms/public-form-screen.tsx"
);
const controlsPath = resolve(
  process.cwd(),
  "src/components/forms/form-field-controls.tsx"
);

function stripComments(source: string) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
}

function readScreen() {
  return stripComments(readFileSync(screenPath, "utf8"));
}

function readControls() {
  return stripComments(readFileSync(controlsPath, "utf8"));
}

describe("theme tokens", () => {
  // The site header ships a theme toggle. Every status surface here once used
  // `border-red-500/30 bg-red-500/10 text-red-700` with no dark variant, so the
  // error states rendered dark red on a dark background.
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
    // Decision 7 in #93 says semantic tokens throughout. The legacy
    // `var(--brand-*)` / `var(--line)` / `var(--bg)` set is what made dark mode
    // wrong: #89 repaired four surfaces individually while every control kept
    // its own. Asserting the absence makes it a property of the file.
    //
    // Known limitation, tracked as 13.3d: this cannot see through a class name,
    // so `section-title` and `section-copy` may still resolve legacy variables
    // inside globals.css.
    const offenders = [...readScreen().matchAll(/var\(--[a-z-]+\)/g)].concat([
      ...readControls().matchAll(/var\(--[a-z-]+\)/g),
    ]);

    expect(
      offenders.map((match) => match[0]),
      "Use a semantic Tailwind token (border-border, bg-muted, text-foreground, text-muted-foreground, bg-primary) per decision 7."
    ).toEqual([]);
  });
});

describe("layout classes", () => {
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

    expect(wrappers?.length).toBe(2);
    expect(cards?.length).toBe(2);
  });

  it("uses the contact card shell rather than glass-card", () => {
    const screen = readScreen();

    // Decision 7. Two card idioms for the two public forms on the site was the
    // finding; this is the one that won.
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

  it("keeps the file control off the fixed row height", () => {
    const controls = readControls();

    // The file control needs room for the browser's own button, and no height
    // is observable in jsdom.
    expect(controls).toContain("min-h-12");
  });

  it("builds a choice row from the single checkbox row rather than beside it", () => {
    const controls = readControls();

    // Task 3.3 replaced the `select multiple` listbox, and with it the
    // MULTI_SELECT_CLASS guard that used to sit here. The checkbox group's
    // structure *is* observable in jsdom, so it is asserted in
    // form-field-controls.dom.test.tsx; only the shared surface, which is not,
    // stays a source guard.
    expect(controls).toContain("CHOICE_ROW_CLASS = `${CHECKBOX_ROW_CLASS}");
    expect(controls).not.toContain("MULTI_SELECT_CLASS");
  });

  it("themes the file input's native button", () => {
    const controls = readControls();

    // ::file-selector-button is unreachable from a class on the input and
    // unstyled in jsdom, so this stays a source guard permanently.
    expect(controls).toContain("FILE_INPUT_CLASS");
    expect(controls).toContain("file:rounded-lg");
    expect(controls).toContain("file:bg-primary");
  });
});

describe("page structure that is not yet rendered in a test", () => {
  // What is left here is what a rendering test cannot reach. The screen is now
  // rendered in public-form-screen.dom.test.tsx, so anything observable there
  // belongs there.

  it("renders the form title as the page's only top-level heading", () => {
    const screen = readScreen();
    const headingOnes = screen.match(/<h1\b/g);

    expect(headingOnes?.length).toBe(1);
    expect(screen).toContain("PublicFormHeader");
    expect(screen).toMatch(/<h2[^>]*>\s*\{eventSuccessContent \? eventSuccessContent\.heading/);
  });

  it("shows the eyebrow and length affordance only when resolved", () => {
    const screen = readScreen();

    expect(screen).toContain("resolveFormEyebrow");
    expect(screen).toContain("resolveFormLengthSummary");
    expect(screen).toContain("{eyebrow ? (");
    expect(screen).toContain("{lengthSummary ? (");
  });

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
    expect(screen).not.toContain("h-0 opacity-0");
  });

  it("routes every challenge through the wrapper", () => {
    const screen = readScreen();

    expect(screen.match(/<TurnstileField\b/g)?.length).toBe(1);
    expect(screen.match(/<VerifiedTurnstileField\b/g)?.length).toBe(2);
  });

  it("spins while submitting instead of only swapping the label", () => {
    const screen = readScreen();

    expect(screen).toContain("Loader2");
    expect(screen.match(/className="animate-spin"/g)?.length).toBe(2);
    expect(screen).toContain('aria-busy={state.status === "submitting"}');
  });

  it("confirms success visually, not with a bare heading", () => {
    const screen = readScreen();

    expect(screen).toContain("CheckCircle2");
    expect(screen).toContain("NOTICE_SUCCESS_CLASS");
  });

  it("keeps a live region only where something changes in place", () => {
    const screen = readScreen();

    // Two, not three. Task 2.2 removed the one around the success block: it
    // mounted with its content already inside it and so announced nothing, and
    // now that focus moves to the heading a region around it would produce a
    // duplicate announcement. The two that remain each wrap one thing that
    // changes within a view that stays put -- the verification chip and the
    // resend confirmation.
    //
    // Whether the heading actually receives focus, and whether it sits inside a
    // region, is asserted in public-form-screen.dom.test.tsx against the
    // rendered tree. This guard only keeps the removed region from drifting back
    // in unnoticed.
    expect(screen.match(/role="status"/g)?.length).toBe(2);
    expect(screen).not.toContain('<div aria-live="polite" className="text-center" role="status">');
  });

  it("makes the success heading a focus target without adding a tab stop", () => {
    const screen = readScreen();

    // A heading is not focusable on its own, so the ref alone would be a no-op.
    // -1 rather than 0: nobody should tab onto a heading.
    expect(screen).toContain("successHeadingRef");
    expect(screen).toMatch(/ref=\{successHeadingRef\}\s*\n\s*tabIndex=\{-1\}/);
  });

  it("keeps failures assertive and separate from status", () => {
    const screen = readScreen();

    // `role="alert"` already implies assertive; pairing it with polite
    // contradicts itself.
    expect(screen.match(/role="alert"/g)?.length).toBe(4);
    expect(screen).not.toMatch(/role="alert" aria-live="polite"/);
  });
});
