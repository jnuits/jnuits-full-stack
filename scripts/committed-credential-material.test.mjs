import { existsSync, readdirSync, readFileSync } from "node:fs";
import { relative, resolve } from "node:path";

import { describe, expect, it } from "vitest";

const REPOSITORY_ROOT = process.cwd();
const MANUAL_SQL_DIRECTORY = resolve(REPOSITORY_ROOT, "supabase/manual");

const FORBIDDEN_MATERIAL = [
  {
    label: "TOTP provisioning URI",
    pattern: /otpauth:\/\//i,
  },
  {
    label: "literal password material",
    pattern:
      /\b(?:password|encrypted_password|password_hash)\b\s*(?::=|=>|=)[^\r\n]*['"][^'"]+['"]/i,
  },
  {
    label: "literal MFA secret material",
    pattern:
      /\b(?:totp|mfa)[a-z0-9_]*(?:secret|seed)\b\s*(?::=|=>|=)[^\r\n]*['"][^'"]+['"]/i,
  },
];

function listSqlFiles(directory) {
  if (!existsSync(directory)) {
    return [];
  }

  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = resolve(directory, entry.name);

    if (entry.isDirectory()) {
      return listSqlFiles(entryPath);
    }

    return entry.isFile() && entry.name.endsWith(".sql") ? [entryPath] : [];
  });
}

function findCredentialMaterial(filePath) {
  return readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .flatMap((line, index) =>
      FORBIDDEN_MATERIAL.filter(({ pattern }) => pattern.test(line)).map(({ label }) =>
        `${relative(REPOSITORY_ROOT, filePath).replaceAll("\\", "/")}:${index + 1} (${label})`
      )
    );
}

describe("committed manual Supabase scripts", () => {
  it("contain no reusable credential or MFA material", () => {
    const violations = listSqlFiles(MANUAL_SQL_DIRECTORY).flatMap(findCredentialMaterial);

    expect(violations).toEqual([]);
  });
});
