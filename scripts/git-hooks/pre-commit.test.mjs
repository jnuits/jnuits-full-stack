import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const hook = readFileSync(resolve(root, "scripts/git-hooks/pre-commit"), "utf8");
const guide = readFileSync(
  resolve(root, "docs/operations/pre-commit-secret-scan.md"),
  "utf8",
);

describe("pre-commit secret scan", () => {
  it("uses the current Gitleaks staged-diff command", () => {
    for (const source of [hook, guide]) {
      expect(source).toContain("gitleaks git --staged --redact=100 --verbose");
      expect(source).not.toContain("gitleaks protect");
    }
  });
});
