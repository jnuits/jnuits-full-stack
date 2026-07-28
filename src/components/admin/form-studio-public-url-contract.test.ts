import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * A static contract guard, not a component test.
 *
 * This repository has no jsdom or Testing Library setup (issue #52), and the
 * project rule forbids adding dependencies without approval, so the rendered
 * behaviour of this component cannot be asserted yet. What can be asserted, and
 * what actually caused the defect, is where the URL comes from. This mirrors
 * the existing static-contract pattern used by
 * src/lib/forms/unapplied-migration-runtime.test.ts.
 *
 * Replace this with real component tests once #52 lands the component test
 * infrastructure.
 */

const studioPath = resolve(
  process.cwd(),
  "src/components/admin/modern-form-studio-screen.tsx"
);
const pagePath = resolve(process.cwd(), "src/app/admin/content/forms/page.tsx");
const contextPath = resolve(
  process.cwd(),
  "src/components/admin/form-inventory-context.tsx"
);

describe("Form Studio public URL contract", () => {
  it("never derives a share link from the browser origin", () => {
    const studio = readFileSync(studioPath, "utf8");

    // The original defect. A link copied from a preview deployment, localhost,
    // or an alternate host was handed to members unopenable.
    expect(studio).not.toContain("window.location.origin");
    expect(studio).not.toContain("window.location.host");
  });

  it("builds share links through the canonical helper", () => {
    const studio = readFileSync(studioPath, "utf8");

    expect(studio).toContain("buildPublicFormUrl");
    expect(studio).toContain("publicBaseUrl");
  });

  it("resolves the canonical base on the server", () => {
    const page = readFileSync(pagePath, "utf8");

    // APP_BASE_URL is not inlined into client bundles, so this must happen in
    // the server component or it silently degrades.
    expect(page).toContain("getAppBaseUrl");
    expect(page).toContain("publicBaseUrl={getAppBaseUrl()}");
  });

  it("carries the canonical base through the shared inventory", () => {
    const context = readFileSync(contextPath, "utf8");

    expect(context).toContain("publicBaseUrl: string");
  });

  it("handles an unavailable Clipboard API instead of only failing", () => {
    const studio = readFileSync(studioPath, "utf8");

    // navigator.clipboard is undefined in an insecure context, so this path is
    // reachable in practice.
    expect(studio).toContain("navigator.clipboard?.writeText");
  });

  it("presents lifecycle with the design system status pill", () => {
    const studio = readFileSync(studioPath, "utf8");

    expect(studio).toContain("LIFECYCLE_LABELS");
    expect(studio).toContain("status-pill--danger");
  });
});
