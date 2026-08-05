import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Source-text guards for this surface.
 *
 * Same rule as `public-form-presentation-contract.test.ts`: a guard belongs here
 * only when jsdom cannot answer the question. jsdom resolves no stylesheet, so a
 * Tailwind class name is invisible to it and asserting it as source text is the
 * only available check.
 *
 * Everything about focus, roles and behaviour now lives in
 * `form-confirmation-screen.dom.test.tsx`, asserted against the rendered tree.
 * Do not add such a guard here.
 *
 * Known placement wart, reported in PR: this file is `.tsx` while it contains no
 * JSX and runs in the node project. `public-form-presentation-contract.test.ts`
 * is the same kind of file with the correct extension. Renaming is a delete-plus-
 * add that would bury this diff, so it is left for a follow-up (finding 14.9).
 */

const confirmationScreenPath = resolve(
  process.cwd(),
  "src/components/forms/form-confirmation-screen.tsx"
);
const publicScreenPath = resolve(
  process.cwd(),
  "src/components/forms/public-form-screen.tsx"
);
const recoveryFormPath = resolve(
  process.cwd(),
  "src/components/forms/form-confirmation-recovery-form.tsx"
);
const pagePath = resolve(process.cwd(), "src/app/(public)/forms/confirm/page.tsx");

function read(path: string) {
  return readFileSync(path, "utf8");
}

/** Comments stripped, so prose explaining a rule cannot satisfy or break it. */
function stripComments(source: string) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
}

const component = read(confirmationScreenPath);
const page = read(pagePath);

/**
 * @returns the string a named class constant is assigned, or `null`.
 *
 * Used to compare the two surfaces rather than to restate their contents, so the
 * expected value lives in neither this file nor a third copy of it.
 */
function classConstant(source: string, name: string) {
  return stripComments(source).match(new RegExp(`${name} = "([^"]+)"`))?.[1] ?? null;
}

describe("expired form confirmation recovery", () => {
  it("renders a direct recovery form only for an expired link with form context", () => {
    expect(component).toContain("FormConfirmationRecoveryForm");
    expect(component).toContain('state.status === "expired" && formSlug');
    expect(component).toContain("formSlug={formSlug}");
  });

  it("validates and passes form slug plus CAPTCHA config from the confirmation page", () => {
    expect(page).toContain('typeof resolved.form === "string"');
    expect(page).toContain("slugPattern.test(rawFormSlug)");
    expect(page).toContain("captcha={getAuthCaptchaUiConfig()}");
    expect(page).toContain("formSlug={formSlug}");
  });
});

/**
 * Issue #135. The two consecutive steps of one public journey have to render in
 * one card idiom, and a class name is not observable in jsdom.
 *
 * These compare the two files instead of restating the strings, so the pair
 * cannot drift: change one and the assertion fails until the other follows. That
 * is the property a shared constant would give, bought without moving the
 * strings out of `public-form-screen.tsx`, where
 * `public-form-presentation-contract.test.ts` reads them by path. A guard left
 * describing a file that no longer contains what it names is finding 14.9.
 */
describe("the confirmation screen shares the public form's card", () => {
  it.each([
    ["CARD_CLASS", "FORM_CARD_CLASS"],
    ["CARD_ACCENT_CLASS", "FORM_CARD_ACCENT_CLASS"],
    ["CARD_BODY_CLASS", "FORM_CARD_BODY_CLASS"],
  ])("gives %s the same value as the form screen's %s", (here, there) => {
    const confirmation = classConstant(component, here);
    const publicForm = classConstant(read(publicScreenPath), there);

    // Asserted non-null first, and this is the load-bearing line. Two regexes
    // that matched nothing would both yield null and compare equal, so the
    // comparison below would pass on a pair of renamed or deleted constants.
    // Finding 14.5.
    expect(confirmation, `${here} is missing from the confirmation screen`).not.toBeNull();
    expect(publicForm, `${there} is missing from the public form screen`).not.toBeNull();
    expect(confirmation).toBe(publicForm);
  });

  it("uses the contact card shell rather than glass-card", () => {
    // Decision 7. Scope is this flow: glass-card is still the idiom on the policy
    // pages, the admin panel and elsewhere, and replacing it there is not what
    // #135 asked for.
    expect(component).toContain("rounded-2xl border border-border bg-card shadow-sm");
    expect(component).not.toMatch(/glass-card/);
  });

  it("centres the card rather than pinning it to the left edge", () => {
    // `max-w-xl` with no `mx-auto` left this against the left edge on a wide
    // viewport, the same defect #112 fixed on the public form screen.
    expect(component).toContain("PAGE_WRAPPER_CLASS");
    expect(component).toContain("mx-auto w-full max-w-xl");
    expect(component.match(/className=\{PAGE_WRAPPER_CLASS\}/g)?.length).toBe(2);
  });

  it("gives both card states the primary accent bar", () => {
    expect(component.match(/className=\{CARD_ACCENT_CLASS\}/g)?.length).toBe(2);
  });
});

describe("theme tokens on the confirmation flow", () => {
  // The site header ships a theme toggle, and both failure messages in the
  // recovery form were `text-red-700` with no dark variant: dark red on the new
  // dark `bg-card`.
  const HARDCODED_COLOUR = /\b(?:text|bg|border)-(?:red|green|emerald|amber|yellow|orange)-\d{2,3}\b/g;

  it.each([
    ["the confirmation screen", confirmationScreenPath],
    ["the recovery form", recoveryFormPath],
  ])("uses no hardcoded colour literal in %s", (_label, path) => {
    const matches = stripComments(read(path)).match(HARDCODED_COLOUR);

    expect(matches, `Use a semantic token instead: ${matches?.join(", ")}`).toBeNull();
  });

  it("routes both recovery failures through one destructive constant", () => {
    const recovery = read(recoveryFormPath);

    expect(recovery).toContain("RECOVERY_ERROR_CLASS");
    expect(recovery).toContain("text-destructive");
    expect(recovery.match(/className=\{RECOVERY_ERROR_CLASS\}/g)?.length).toBe(2);
  });
});
