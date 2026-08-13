import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  describeActionReference,
  findMutableActionReferences,
  IMMUTABLE_SHA_PATTERN,
  parseActionReferences,
} from "./lib/workflow-action-policy.mjs";

const WORKFLOW_DIR = resolve(process.cwd(), ".github", "workflows");
const ACTIONS_DIR = resolve(process.cwd(), ".github", "actions");

/**
 * Issue #59.
 *
 * This file used to carry a four-entry `workflowNames` array. Six workflow
 * files exist, so `diff-check.yml` and `preproduction-alumni.yml` were never
 * read -- and both use external actions, one of them inside a job holding the
 * preproduction environment's secrets.
 *
 * A policy a new file must be manually enrolled in is not a policy, it is a
 * list, and it rots the same way the `pull_request.branches` allowlist did
 * (decision 9) and the application-mapping allowlist did before PR #86 deleted
 * it. The directory is the source of truth now.
 */
function discoverWorkflowFiles() {
  return readdirSync(WORKFLOW_DIR)
    .filter((name) => name.endsWith(".yml") || name.endsWith(".yaml"))
    .sort();
}

/**
 * Composite actions are in scope because a local action is trusted by every
 * workflow that calls it. `./.github/actions/x` is immutable in the sense that
 * matters -- it ships with the commit -- but only until it reaches out to
 * something that does not. None of the three do today; this is what keeps that
 * true without anybody remembering to check.
 */
function discoverCompositeActionFiles() {
  if (!existsSync(ACTIONS_DIR)) {
    return [];
  }

  return readdirSync(ACTIONS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) =>
      ["action.yml", "action.yaml"]
        .map((file) => `${entry.name}/${file}`)
        .filter((relative) => existsSync(resolve(ACTIONS_DIR, relative)))
    )
    .sort();
}

const workflowFiles = discoverWorkflowFiles();
const compositeActionFiles = discoverCompositeActionFiles();

function readWorkflow(name) {
  return readFileSync(resolve(WORKFLOW_DIR, name), "utf8").replace(/\r\n?/g, "\n");
}

function readAction(relative) {
  const path = relative.includes("/")
    ? resolve(ACTIONS_DIR, relative)
    : resolve(ACTIONS_DIR, relative, "action.yml");

  return readFileSync(path, "utf8").replace(/\r\n?/g, "\n");
}

function externalReferences(source, origin) {
  return parseActionReferences(source, origin).filter(
    (reference) => reference.kind !== "local"
  );
}

describe("immutable Action policy coverage", () => {
  it("takes its file list from the directory, not from this file", () => {
    // The assertion that makes the rest non-vacuous. Every per-file case below
    // is generated from `workflowFiles`, so an empty or short list would make
    // them all pass by having nothing to check -- which is exactly the bug
    // being fixed, just relocated.
    expect(workflowFiles.length).toBeGreaterThanOrEqual(6);

    // Named explicitly: these two are the reason #59 was reopened, and a
    // regression that dropped them would otherwise only shrink a number.
    expect(workflowFiles).toContain("diff-check.yml");
    expect(workflowFiles).toContain("preproduction-alumni.yml");

    expect(compositeActionFiles.length).toBeGreaterThanOrEqual(3);
  });

  it("finds real action references across the corpus", () => {
    // Finding 14.5. Every file-level test below passes when the scanner returns
    // an empty array, and a regex that matched nothing at all would return an
    // empty array for every file. Counting what was actually inspected is the
    // only thing separating "clean" from "blind".
    const total = workflowFiles.flatMap((name) =>
      externalReferences(readWorkflow(name), name)
    );

    expect(total.length).toBeGreaterThanOrEqual(10);
    expect(total.every((reference) => reference.kind === "external")).toBe(true);
  });

  it("gives the two previously unchecked workflows non-empty coverage", () => {
    // Coverage of a file with nothing in it is not coverage. Both of these do
    // use external actions today; if one legitimately stops, delete its line
    // here deliberately rather than letting the guard go quiet on its own.
    for (const name of ["diff-check.yml", "preproduction-alumni.yml"]) {
      const references = externalReferences(readWorkflow(name), name);

      expect(references.length, `${name} should contain external actions`).toBeGreaterThan(0);
    }
  });
});

describe("every workflow pins its external actions", () => {
  // One case per file rather than a loop inside one case, so the CI log lists
  // the files by name. "Demonstrably inspected" should be readable in the
  // output, not inferred from the absence of a failure.
  it.each(workflowFiles)("pins every external action in %s", (name) => {
    const offenders = findMutableActionReferences(readWorkflow(name), name);

    expect(offenders.map(describeActionReference)).toEqual([]);
  });

  it.each(compositeActionFiles)("pins every external action in %s", (relative) => {
    const offenders = findMutableActionReferences(readAction(relative), relative);

    expect(offenders.map(describeActionReference)).toEqual([]);
  });
});

describe("the policy rejects a mutable reference", () => {
  /**
   * Fixtures, not a second copy of the rule.
   *
   * Each one is scanned by `findMutableActionReferences`, the same function the
   * corpus tests above call. A fixture checked against a regex written beside
   * it would prove the regex works and nothing about the checker.
   */
  function fixtureWorkflow(reference) {
    return [
      "jobs:",
      "  build:",
      "    steps:",
      "      - name: Checkout",
      `        uses: ${reference}`,
      "",
    ].join("\n");
  }

  it.each([
    ["a moving major tag", "actions/checkout@v6"],
    ["a branch name", "actions/checkout@main"],
    ["a short tag", "actions/setup-node@v6.1"],
    ["an uppercase SHA", "actions/checkout@D23441A48E516B6C34AEA4FA41551A30E30AF803"],
    ["39 characters", "actions/checkout@d23441a48e516b6c34aea4fa41551a30e30af80"],
    ["41 characters", "actions/checkout@d23441a48e516b6c34aea4fa41551a30e30af8033"],
    ["no ref at all", "actions/checkout"],
    ["a bare container image", "docker://alpine:3.18"],
    ["a reusable workflow on a tag", "owner/repo/.github/workflows/ci.yml@v1"],
  ])("rejects %s", (_label, reference) => {
    const offenders = findMutableActionReferences(fixtureWorkflow(reference), "fixture.yml");

    expect(offenders).toHaveLength(1);
    expect(offenders[0].raw).toBe(reference);
    // The message has to name the file and line, or a failure in a six-file
    // corpus sends the reader looking through all of them.
    expect(describeActionReference(offenders[0])).toContain("fixture.yml:5");
  });

  it.each([
    ["a full commit SHA", "actions/checkout@d23441a48e516b6c34aea4fa41551a30e30af803"],
    ["a pinned reusable workflow", "o/r/.github/workflows/ci.yml@d23441a48e516b6c34aea4fa41551a30e30af803"],
    ["a repository-local action", "./.github/actions/setup-gitleaks"],
  ])("accepts %s", (_label, reference) => {
    expect(findMutableActionReferences(fixtureWorkflow(reference), "fixture.yml")).toEqual([]);
  });

  it("reads the list-item form this repository does not currently write", () => {
    // `- uses:` is valid and the repository happens not to use it. A scanner
    // that only understood the house style would let a new workflow written the
    // other way through, which is the same class of gap as the hardcoded list.
    const mutable = "jobs:\n  b:\n    steps:\n      - uses: actions/checkout@v6\n";
    const pinned =
      "jobs:\n  b:\n    steps:\n      - uses: actions/checkout@d23441a48e516b6c34aea4fa41551a30e30af803 # v6\n";

    expect(findMutableActionReferences(mutable, "list.yml")).toHaveLength(1);
    expect(findMutableActionReferences(pinned, "list.yml")).toEqual([]);
  });

  it("keeps the trailing version comment out of the reference", () => {
    const [reference] = parseActionReferences(
      "    steps:\n      - uses: actions/cache@caa296126883cff596d87d8935842f9db880ef25 # v5\n",
      "comment.yml"
    );

    // The `# v5` is the readable half of the pin. Folding it into the ref would
    // fail every correctly pinned action in the repository.
    expect(reference.ref).toBe("caa296126883cff596d87d8935842f9db880ef25");
    expect(reference.immutable).toBe(true);
  });

  it("ignores a fully commented-out reference", () => {
    expect(
      parseActionReferences("    steps:\n      # uses: actions/checkout@v6\n", "c.yml")
    ).toEqual([]);
  });

  it("requires exactly forty lowercase hex characters", () => {
    const sha = "d23441a48e516b6c34aea4fa41551a30e30af803";

    expect(IMMUTABLE_SHA_PATTERN.test(sha)).toBe(true);
    // Git resolves an uppercase SHA, so this is about review rather than
    // correctness: two spellings of one pin make "has this moved?" a
    // case-insensitive comparison somebody eventually gets wrong.
    expect(IMMUTABLE_SHA_PATTERN.test(sha.toUpperCase())).toBe(false);
    expect(IMMUTABLE_SHA_PATTERN.test(`${sha}\n`)).toBe(false);
  });
});

describe("GitHub Actions workflows", () => {
  it("gates every pull request, not only those targeting main", () => {
    // Issue #93 finding 14.1, decision 9.
    //
    // `pull_request.branches` filters on the BASE branch, so `[main]` meant a
    // stacked slice targeting another feature branch ran none of the eight
    // shards and `Required CI` never reported. Check runs attach to a commit,
    // so a duplicate pull request then displayed another's green checks (#92).
    //
    // Asserted here because of finding 14.5: a workflow that never fires is
    // indistinguishable from one that passes, so the selection is checked and
    // not only the result. No other test in this file reads the `on:` block.
    //
    // The filter is absent rather than widened to a prefix allowlist. An
    // allowlist is hand-maintained and rots; PR #86 deleted one of those from
    // the application mapping for exactly that reason.
    const workflow = readWorkflow("quality-gate.yml");
    const triggerStart = workflow.indexOf("\non:\n");
    const triggerEnd = workflow.indexOf("\npermissions:", triggerStart);

    expect(triggerStart).toBeGreaterThan(-1);
    expect(triggerEnd).toBeGreaterThan(triggerStart);

    const trigger = workflow.slice(triggerStart, triggerEnd);

    // Pull requests are gated unconditionally, whatever their base branch.
    expect(trigger).toContain("pull_request:");
    expect(trigger).not.toMatch(/pull_request:\s*\n\s+branches:/);

    // Push stays scoped to main: the pull request already covers branch work,
    // and eight shards per branch commit would consume redundant hosted minutes.
    expect(trigger).toMatch(/push:\s*\n\s+branches: \[main\]/);
  });

  it("runs required pull-request gates on GitHub-hosted runners with a Playwright cache", () => {
    const quality = readWorkflow("quality-gate.yml");
    const diff = readWorkflow("diff-check.yml");
    const qualityRunners = quality.match(/^    runs-on: .+$/gm) ?? [];
    const diffRunners = diff.match(/^    runs-on: .+$/gm) ?? [];

    expect(qualityRunners).toHaveLength(9);
    expect(qualityRunners.every((line) => line === "    runs-on: ubuntu-latest")).toBe(true);
    expect(diffRunners).toEqual(["    runs-on: ubuntu-latest"]);
    expect(quality).toContain("name: Cache Playwright browsers");
    expect(quality).toContain(
      "uses: actions/cache@caa296126883cff596d87d8935842f9db880ef25 # v5"
    );
    expect(quality).toContain("path: ~/.cache/ms-playwright");
  });
  it("makes migration and secret scanning part of the required quality result", () => {
    const workflow = readWorkflow("quality-gate.yml");

    expect(workflow).toContain("migration_integrity:");
    expect(workflow).toContain("secret_scan:");
    expect(workflow).toContain("name: Required CI");
    expect(workflow).toContain("pull-requests: read");
    expect(workflow).toContain("node scripts/check-dependency-audit.mjs");
    expect(workflow).toContain("MIGRATION_INTEGRITY_RESULT");
    expect(workflow).toContain("SECRET_SCAN_RESULT");
    expect(workflow).toContain("RESEND_WEBHOOK_SECRET: whsec_ci_placeholder");
    expect(workflow).toContain(
      "RETENTION_MANIFEST_SIGNING_SECRET: ci-placeholder-retention-manifest-signing-secret"
    );
  });

  it("uses the verified local Gitleaks installer on hosted runners", () => {
    const workflow = readWorkflow("quality-gate.yml");
    const action = readAction("setup-gitleaks");

    expect(workflow).toContain("uses: ./.github/actions/setup-gitleaks");
    expect(workflow).toContain(
      'run: gitleaks git --redact=100 --verbose --log-opts="--all" .'
    );
    expect(workflow).not.toContain("gitleaks/gitleaks-action@");

    expect(action).toContain(
      "9991e0b2903da4c8f6122b5c3186448b927a5da4deef1fe45271c3793f4ee29c"
    );
    expect(action).toContain('archive_dir="$HOME/.cache/jnuits-gitleaks"');
    expect(action).toContain('downloaded_digest="$(archive_digest "$archive.part")"');
    expect(action).toContain('rm -rf -- "$install_dir"');
    expect(action).not.toContain("/tmp/gitleaks");
  });

  it("runs the repository-wide migration dependency scan in strict mode", () => {
    // Promoted on 2026-07-27, after a Linux run reported zero findings across
    // all 95 migrations. Report-only mode exits zero on a finding, so leaving
    // it in place would make the job decorative.
    const workflow = readWorkflow("quality-gate.yml");

    expect(workflow).toContain("migration_dependencies:");
    expect(workflow).toContain("run: npm run migration:check-order:strict");
    expect(workflow).not.toMatch(/run: npm run migration:check-order$/m);
  });

  it("requires the migration dependency scan in the aggregate gate", () => {
    const workflow = readWorkflow("quality-gate.yml");
    const aggregateStart = workflow.indexOf("application_quality:");
    const aggregateEnd = workflow.indexOf("\n  secret_scan:", aggregateStart);

    expect(aggregateStart).toBeGreaterThan(-1);
    expect(aggregateEnd).toBeGreaterThan(aggregateStart);

    const aggregate = workflow.slice(aggregateStart, aggregateEnd);

    // In the needs list.
    expect(aggregate).toContain("migration_dependencies,");
    // Result exposed to the step.
    expect(aggregate).toContain(
      "MIGRATION_DEPENDENCIES_RESULT: ${{ needs.migration_dependencies.result }}"
    );
    // Printed alongside the other shards, so a no-log failure stays diagnosable.
    expect(aggregate).toContain('echo "migration_dependencies=$MIGRATION_DEPENDENCIES_RESULT"');
    // And actually asserted, not merely echoed.
    expect(aggregate).toContain('test "$MIGRATION_DEPENDENCIES_RESULT" = "success"');
  });

  it("keeps each Docker migration job self-cleaning on isolated hosted VMs", () => {
    const workflow = readWorkflow("quality-gate.yml");
    const replayStart = workflow.indexOf("  migration_bootstrap_replay:");
    const replayEnd = workflow.indexOf("\n  build_and_browser:", replayStart);

    expect(replayStart).toBeGreaterThan(-1);
    expect(replayEnd).toBeGreaterThan(replayStart);

    const replay = workflow.slice(replayStart, replayEnd);

    expect(replay).not.toContain("needs: migration_runtime");
    expect(replay.split("uses: ./.github/actions/docker-preflight").length - 1).toBe(2);

    const runtimeStart = workflow.indexOf("  migration_runtime:");
    const runtimeEnd = workflow.indexOf("\n  # Issue #18. Offline ordering", runtimeStart);
    const runtime = workflow.slice(runtimeStart, runtimeEnd);

    expect(runtime.split("uses: ./.github/actions/docker-preflight").length - 1).toBe(2);
  });

  it("validates Google Drive and retention settings in production readiness", () => {
    const workflow = readWorkflow("production-readiness.yml");

    expect(workflow).toContain("GOOGLE_DRIVE_EXPORTS_FOLDER_ID");
    expect(workflow).toContain("GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL");
    expect(workflow).toContain("GOOGLE_DRIVE_SERVICE_ACCOUNT_PRIVATE_KEY");
    expect(workflow).toContain("GOOGLE_DRIVE_SHARED_DRIVE_ID");
    expect(workflow).toContain("RETENTION_MANIFEST_SIGNING_SECRET");
  });

  it("binds production readiness jobs to the configured Production environment", () => {
    const workflow = readWorkflow("production-readiness.yml");

    expect(workflow.match(/environment: Production/g)).toHaveLength(2);
    expect(workflow).not.toContain("environment: production");
  });
});
