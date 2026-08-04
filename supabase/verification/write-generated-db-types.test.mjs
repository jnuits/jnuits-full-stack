import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
const scratchRoot = join(repoRoot, ".replay-scratch");
const writerPath = "supabase/verification/write-generated-db-types.sh";
const replayPath = "supabase/verification/run-bootstrap-replay.sh";
const temporaryDirectories = [];
const SUBPROCESS_TEST_TIMEOUT_MS = 15_000;

const sentinelTables = [
  "form_definitions",
  "form_versions",
  "form_submissions",
  "form_submission_assets",
  "form_export_jobs",
  "form_archive_jobs",
  "alumni_onboarding_cases",
];

function createTemporaryPaths() {
  mkdirSync(scratchRoot, { recursive: true });
  const directory = mkdtempSync(join(scratchRoot, "types-test."));
  temporaryDirectories.push(directory);
  const inputPath = join(directory, "generated.types.ts");
  const outputPath = join(directory, "database.types.ts");
  return {
    inputArgument: relative(repoRoot, inputPath).replaceAll("\\", "/"),
    inputPath,
    outputArgument: relative(repoRoot, outputPath).replaceAll("\\", "/"),
    outputPath,
  };
}

function validGeneratedTypes(eol = "\n") {
  return [
    "export type Database = {",
    "  public: {",
    "    Tables: {",
    ...sentinelTables.map((table) => `      ${table}: { Row: never }`),
    "    }",
    "    Views: {}",
    "    Functions: { publish_form_version: { Args: never; Returns: never } }",
    "  }",
    "}",
  ].join(eol);
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
  try {
    rmdirSync(scratchRoot);
  } catch {
    // Another replay may own the shared ignored scratch root.
  }
});

describe("generated database type writer", () => {
  it("writes one canonical LF artifact from CRLF generator output", () => {
    const { inputArgument, inputPath, outputArgument, outputPath } =
      createTemporaryPaths();
    writeFileSync(inputPath, validGeneratedTypes("\r\n"), "utf8");

    const result = spawnSync("bash", [writerPath, inputArgument, outputArgument], {
      cwd: repoRoot,
      encoding: "utf8",
    });

    expect(result.status, result.stderr).toBe(0);
    expect(readFileSync(outputPath, "utf8")).toBe(`${validGeneratedTypes()}\n`);
  }, SUBPROCESS_TEST_TIMEOUT_MS);

  it("leaves the previous artifact intact when required schema sentinels are missing", () => {
    const { inputArgument, inputPath, outputArgument, outputPath } =
      createTemporaryPaths();
    writeFileSync(inputPath, "export type Database = {}\n", "utf8");
    writeFileSync(outputPath, "existing artifact\n", "utf8");

    const result = spawnSync("bash", [writerPath, inputArgument, outputArgument], {
      cwd: repoRoot,
      encoding: "utf8",
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("missing required schema sentinels");
    expect(readFileSync(outputPath, "utf8")).toBe("existing artifact\n");
  }, SUBPROCESS_TEST_TIMEOUT_MS);

  it.each(["--linked", "--db-url", "--project-id"])(
    "rejects remote-capable replay argument %s before any runtime work",
    (argument) => {
      const result = spawnSync("bash", [replayPath, argument], {
        cwd: repoRoot,
        encoding: "utf8",
        env: { ...process.env, SCRATCH_ACK: "NOT_A_SCRATCH_ACK" },
      });

      expect(result.status).toBe(1);
      expect(result.stderr).toContain(
        "Only --generate-types is accepted; remote database arguments are forbidden."
      );
      expect(result.stderr).not.toContain("SCRATCH_ACK");
    },
    SUBPROCESS_TEST_TIMEOUT_MS
  );
});
