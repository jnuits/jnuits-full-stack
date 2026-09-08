import { existsSync, readdirSync, readFileSync } from "node:fs";
import { relative, resolve } from "node:path";

import { describe, expect, it } from "vitest";

const REPOSITORY_ROOT = process.cwd();
const MANUAL_SQL_DIRECTORY = resolve(REPOSITORY_ROOT, "supabase/manual");
const ARTIFACTS_DIRECTORY = resolve(REPOSITORY_ROOT, "artifacts");

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

/**
 * Generated ops reports have leaked live member claim codes and the personal
 * email of a privileged account before (HYG-001). These patterns only run
 * against `artifacts/`, where such reports land, so institutional addresses
 * and fixture data elsewhere in the tree are unaffected.
 */
const ARTIFACT_ONLY_MATERIAL = [
  {
    label: "personal webmail address",
    pattern: /@(?:gmail|outlook|hotmail|yahoo)\.[a-z]{2,}/i,
  },
  {
    label: "plaintext invitation claim code",
    pattern: /\binvitation[_-]?code\b\s*(?::|=>|=)\s*["'][^"']{8,}["']/i,
  },
];

const BINARY_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  ".ico",
  ".pdf",
  ".zip",
  ".woff",
  ".woff2",
]);

function listFiles(directory) {
  if (!existsSync(directory)) {
    return [];
  }

  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = resolve(directory, entry.name);

    if (entry.isDirectory()) {
      return listFiles(entryPath);
    }

    if (!entry.isFile()) {
      return [];
    }

    const isSql = entry.name.endsWith(".sql");
    const isBinary = BINARY_EXTENSIONS.has(entry.name.slice(entry.name.lastIndexOf(".")).toLowerCase());

    return isSql || !isBinary ? [entryPath] : [];
  });
}

function findMaterial(filePath, material) {
  return readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .flatMap((line, index) =>
      material.filter(({ pattern }) => pattern.test(line)).map(({ label }) =>
        `${relative(REPOSITORY_ROOT, filePath).replaceAll("\\", "/")}:${index + 1} (${label})`
      )
    );
}

describe("committed manual Supabase scripts", () => {
  it("contain no reusable credential or MFA material", () => {
    const violations = listFiles(MANUAL_SQL_DIRECTORY).flatMap((filePath) =>
      findMaterial(filePath, FORBIDDEN_MATERIAL)
    );

    expect(violations).toEqual([]);
  });
});

describe("committed generated artifacts", () => {
  it("contain no credential material or member PII", () => {
    const violations = listFiles(ARTIFACTS_DIRECTORY).flatMap((filePath) =>
      findMaterial(filePath, [...FORBIDDEN_MATERIAL, ...ARTIFACT_ONLY_MATERIAL])
    );

    expect(violations).toEqual([]);
  });
});
