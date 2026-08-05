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
const DEPENDABOT_CONFIG = resolve(process.cwd(), ".github", "dependabot.yml");

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

/**
 * Issue #136, the other half of #59.
 *
 * #129 stops a reference from being mutable. Nothing stops one from being old,
 * and an immutable pin on a year-old action with a published advisory passes
 * every test in this file. Dependabot is what closes that, and these assertions
 * are about the configuration only.
 *
 * ## The tension worth naming
 *
 * `dependabot.yml` carries a hand-maintained directory list -- exactly the
 * construct #129 deleted for rotting, and that PR #86 deleted from the
 * application mapping before it. It cannot simply be removed, because
 * Dependabot requires it. So the list is checked against the directories that
 * actually contain external action references, derived by the same scanner the
 * policy above uses. The list can still be wrong. It can no longer be wrong
 * silently, which is the property that matters.
 */
function readDependabotConfig() {
  return readFileSync(DEPENDABOT_CONFIG, "utf8").replace(/\r\n?/g, "\n");
}

/**
 * @returns the Dependabot directories that must be watched, derived from where
 * external action references actually live rather than from a second list.
 */
function directoriesRequiringUpdates() {
  const required = new Set();

  const workflowReferences = workflowFiles.flatMap((name) =>
    externalReferences(readWorkflow(name), name)
  );

  if (workflowReferences.length > 0) {
    // Dependabot reads `.github/workflows` when the directory is the repository
    // root; there is no more specific spelling for it.
    required.add("/");
  }

  for (const relative of compositeActionFiles) {
    if (externalReferences(readAction(relative), relative).length > 0) {
      required.add(`/.github/actions/${relative.split("/")[0]}`);
    }
  }

  return [...required].sort();
}

/** The declared list, read without a YAML parser for the reasons in #129. */
function declaredDependabotDirectories(config) {
  const block = config.match(/\n\s*directories:\n((?:[ \t]*-[ \t]*\S.*\n)+)/);

  if (!block) {
    return [];
  }

  return block[1]
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2).trim().replace(/^["']|["']$/g, ""))
    .sort();
}

describe("Dependabot proposes controlled Action updates", () => {
  it("configures the github-actions ecosystem at schema version 2", () => {
    const config = readDependabotConfig();

    expect(config).toMatch(/^version: 2$/m);
    expect(config).toContain("package-ecosystem: github-actions");
  });

  it("watches every directory that actually holds an external action", () => {
    // The anti-rot guard. Adding an external `uses:` to a composite action --
    // which all three are currently free of -- fails here until its directory
    // is added to the config, rather than leaving that action pinned forever
    // with nothing proposing its updates.
    const required = directoriesRequiringUpdates();
    const declared = declaredDependabotDirectories(readDependabotConfig());

    for (const directory of required) {
      expect(
        declared,
        `dependabot.yml must watch ${directory}, which contains external action references`
      ).toContain(directory);
    }
  });

  it("has real references to watch in the first place", () => {
    // Finding 14.5, again. The assertion above is a loop over a derived list,
    // and a loop over an empty list passes. This is what makes it mean
    // something.
    const required = directoriesRequiringUpdates();

    expect(required.length).toBeGreaterThanOrEqual(1);
    expect(required).toContain("/");
    expect(
      workflowFiles.flatMap((name) => externalReferences(readWorkflow(name), name)).length
    ).toBeGreaterThanOrEqual(10);
  });

  it("states its cadence rather than inheriting a default", () => {
    // Weekly is a runner-budget decision, not a preference: every pull request
    // fires nine self-hosted jobs across three runners. An edit to daily should
    // be a visible diff that fails this, not a quiet capacity change.
    const config = readDependabotConfig();

    expect(config).toMatch(/interval: weekly/);
    expect(config).not.toMatch(/interval: daily/);
  });

  it("keeps major updates out of the batch so they are reviewed alone", () => {
    // A major action bump is a behaviour change. Grouped with four routine
    // patches it gets either an inattentive review or blocks the other four.
    const config = readDependabotConfig();
    const group = config.slice(config.indexOf("groups:"));

    expect(group).toContain("update-types:");
    expect(group).toContain("- minor");
    expect(group).toContain("- patch");
    expect(group).not.toContain("- major");
  });

  // Deliberately not tested: that Dependabot writes a 40-character lowercase
  // SHA with a trailing version comment. It does, and that form is what the
  // policy above accepts -- but this suite reads this repository, and no file
  // here contains a proposal Dependabot has produced. A test named for a SHA it
  // never saw would assert the author's expectation and report it as evidence,
  // which is finding 14.5 in yet another costume. Validating a real proposal
  // against the policy is an owner and Codex task, recorded in the PR body.
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
    // and eight shards per branch commit would saturate three shared runners.
    expect(trigger).toMatch(/push:\s*\n\s+branches: \[main\]/);
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

  it("uses a verified local Gitleaks installer on self-hosted runners", () => {
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

  it("serialises the two Docker jobs so their concurrent reaps cannot collide", () => {
    // Precautionary, not a fix for a diagnosed failure.
    //
    // The hazard: both jobs reap every supabase_* container on their host,
    // before and after, with `if: always()`, and both bind fixed local ports.
    // With three shared runners they do land concurrently -- run 30375799852
    // started both at 15:56:10Z on a branch without this ordering. Both passed,
    // so the collision is reachable but has never been observed to fire.
    //
    // The 17-19 second Docker failures on PR #74 and PR #86 were NOT this, and
    // an earlier version of this comment wrongly said they were. The real cause
    // was one host whose runner service started before its user joined the
    // docker group, giving permission denied on /var/run/docker.sock. Fixed on
    // all three hosts 2026-07-28 and corrected on issue #78. Stated here so the
    // false cause cannot be reintroduced from the git history.
    const workflow = readWorkflow("quality-gate.yml");
    const replayStart = workflow.indexOf("  migration_bootstrap_replay:");
    const replayEnd = workflow.indexOf("\n  build_and_browser:", replayStart);

    expect(replayStart).toBeGreaterThan(-1);
    expect(replayEnd).toBeGreaterThan(replayStart);

    const replay = workflow.slice(replayStart, replayEnd);

    expect(replay).toContain("needs: migration_runtime");

    // The ordering exists because of the reaping. Removing the reap steps and
    // keeping the dependency, or the reverse, both reintroduce the hazard.
    const reaps = replay.match(/uses: \.\/\.github\/actions\/docker-preflight/g);
    expect(reaps?.length).toBe(2);

    const runtimeStart = workflow.indexOf("  migration_runtime:");
    const runtimeEnd = workflow.indexOf("\n  # Issue #18. Offline ordering", runtimeStart);
    const runtime = workflow.slice(runtimeStart, runtimeEnd);

    expect(runtime.match(/uses: \.\/\.github\/actions\/docker-preflight/g)?.length).toBe(2);

    // migration_runtime must stay first. A cycle would deadlock the workflow.
    expect(runtime).not.toContain("needs: migration_bootstrap_replay");
  });

  it("validates Google Drive and retention settings in production readiness", () => {
    const workflow = readWorkflow("production-readiness.yml");

    expect(workflow).toContain("GOOGLE_DRIVE_EXPORTS_FOLDER_ID");
    expect(workflow).toContain("GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL");
    expect(workflow).toContain("GOOGLE_DRIVE_SERVICE_ACCOUNT_PRIVATE_KEY");
    expect(workflow).toContain("GOOGLE_DRIVE_SHARED_DRIVE_ID");
    expect(workflow).toContain("RETENTION_MANIFEST_SIGNING_SECRET");
  });
});
