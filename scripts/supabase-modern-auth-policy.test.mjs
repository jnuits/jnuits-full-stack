import { existsSync, readdirSync, readFileSync } from "node:fs";
import { relative, resolve } from "node:path";

import { describe, expect, it } from "vitest";

const repositoryRoot = process.cwd();
const policyTestPath = resolve(repositoryRoot, "scripts/supabase-modern-auth-policy.test.mjs");
const auditedRoots = [
  resolve(repositoryRoot, ".github"),
  resolve(repositoryRoot, "docs"),
  resolve(repositoryRoot, "plan"),
  resolve(repositoryRoot, "scripts"),
  resolve(repositoryRoot, "src"),
];
const auditedFiles = [
  resolve(repositoryRoot, ".env.example"),
  resolve(repositoryRoot, "README.md"),
];
const forbiddenEnvironmentVariables = [
  ["NEXT_PUBLIC_SUPABASE_", "ANON_KEY"].join(""),
  ["SUPABASE_", "ANON_KEY"].join(""),
  ["SUPABASE_", "SERVICE_ROLE_KEY"].join(""),
  ["SUPABASE_", "SERVICE_KEY"].join(""),
  ["SUPABASE_", "JWT_", "SECRET"].join(""),
  ["service", " role key"].join(""),
  ["service-role", " key"].join(""),
  ["JWT_", "SECRET"].join(""),
];
const supportedEnvironmentVariables = [
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SECRET_KEY",
];

function listFiles(directory) {
  if (!existsSync(directory)) {
    return [];
  }

  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = resolve(directory, entry.name);

    if (entry.isDirectory()) {
      return listFiles(entryPath);
    }

    return entry.isFile() ? [entryPath] : [];
  });
}

function findLegacyReferences(filePath) {
  if (filePath === policyTestPath) {
    return [];
  }

  return readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .flatMap((line, index) =>
      forbiddenEnvironmentVariables
        .filter((variable) => line.toLowerCase().includes(variable.toLowerCase()))
        .map(
          (variable) =>
            `${relative(repositoryRoot, filePath).replaceAll("\\", "/")}:${index + 1} (${variable})`
        )
    );
}

describe("Supabase authentication configuration policy", () => {
  it("does not reference legacy API-key or JWT-secret environment variables", () => {
    const files = [...auditedRoots.flatMap(listFiles), ...auditedFiles].filter(existsSync);
    const violations = files.flatMap(findLegacyReferences);

    expect(violations).toEqual([]);
  });

  it("documents the supported publishable and secret key variables", () => {
    const example = readFileSync(resolve(repositoryRoot, ".env.example"), "utf8");

    for (const variable of supportedEnvironmentVariables) {
      expect(example).toContain(`${variable}=`);
    }
  });
});
