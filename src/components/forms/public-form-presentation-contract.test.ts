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

function readScreen() {
  return readFileSync(screenPath, "utf8");
}

function readControls() {
  return readFileSync(controlsPath, "utf8");
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
  it("centres the card rather than pinning it to the left edge", () => {
    const screen = readScreen();

    // `max-w-2xl` alone leaves the card against the left edge on any viewport
    // wider than the cap.
    expect(screen).toContain("FORM_CARD_CLASS");
    expect(screen).toContain("glass-card mx-auto w-full max-w-2xl");
  });

  it("applies one card class to both the form and the success state", () => {
    const screen = readScreen();
    const usages = screen.match(/className=\{FORM_CARD_CLASS\}/g);

    // Success and form. They drifted apart before because each carried its own
    // copy of the class string.
    expect(usages?.length).toBe(2);
    expect(screen).not.toContain('className="glass-card max-w-2xl');
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
