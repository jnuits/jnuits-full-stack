import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

describe("Notices public page (F10 & F12)", () => {
  it("removes fabricated zero chips for Drafts and Archived notices (F10)", () => {
    const source = readFileSync(
      fileURLToPath(new URL("./page.tsx", import.meta.url)),
      "utf8"
    );

    // Drafts and Archived zero chips must NOT be present
    expect(source).not.toContain('"Drafts"');
    expect(source).not.toContain('"Archived"');
    expect(source).toContain("Published notice");
  });

  it("exposes div instead of a nested main landmark in notices page (F12)", () => {
    const source = readFileSync(
      fileURLToPath(new URL("./page.tsx", import.meta.url)),
      "utf8"
    );

    expect(source).not.toContain("<main");
    expect(source).toContain('<div className="notices-page">');
  });
});
