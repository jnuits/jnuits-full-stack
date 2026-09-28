import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

describe("About page optional committee timeline", () => {
  it("rethrows Next.js control-flow errors before using the optional fallback", () => {
    const source = readFileSync(
      fileURLToPath(new URL("./page.tsx", import.meta.url)),
      "utf8"
    );
    const fallback = source.slice(
      source.indexOf("async function getAboutCommitteeTerms"),
      source.indexOf("export default async function AboutPage")
    );

    expect(source).toContain(
      'import { unstable_rethrow } from "next/navigation";'
    );
    expect(fallback).toContain("unstable_rethrow(error);");
    expect(fallback.indexOf("unstable_rethrow(error);")).toBeLessThan(
      fallback.indexOf("console.error")
    );
  });
});
