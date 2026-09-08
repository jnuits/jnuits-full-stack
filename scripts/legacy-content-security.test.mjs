import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = fs.readFileSync(
  path.join(repoRoot, "scripts", "lib", "legacy-content.mjs"),
  "utf8",
);

describe("legacy MySQL recovery TLS", () => {
  it("keeps certificate verification enabled unless the emergency override is explicit", () => {
    assert.match(source, /LEGACY_DATABASE_CA_PATH/);
    assert.match(source, /LEGACY_DATABASE_TLS_INSECURE/);
    assert.match(source, /ssl = \{ rejectUnauthorized: true \}/);
    assert.match(source, /else if \(insecureTls\)/);
  });
});
