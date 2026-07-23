import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("Next image security posture", () => {
  it("keeps the optional Sharp optimizer disabled while stable Next pins vulnerable Sharp", () => {
    const config = readFileSync(resolve(process.cwd(), "next.config.ts"), "utf8");

    expect(config).toMatch(/images:\s*\{[\s\S]*?unoptimized:\s*true/);
    expect(config).toContain('hostname: "res.cloudinary.com"');
  });
});