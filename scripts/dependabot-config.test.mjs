import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  findMutableActionReferences,
  parseActionReferences,
} from "./lib/workflow-action-policy.mjs";

/**
 * Issue #136. Guards `.github/dependabot.yml`.
 *
 * ## Why this is its own file
 *
 * Finding 14.9: a guard sitting in the wrong file is evidence of a placement
 * problem. `github-actions-workflows.test.mjs` is named for what it guards and
 * this does not guard a workflow, so it lives here and imports the #129
 * scanner rather than moving in beside it.
 *
 * ## What a test of a config file is actually for
 *
 * A configuration file is the easiest thing in a repository to believe without
 * checking. Nothing local executes it, it is inert until an external service
 * reads it, and a typo in a directory glob produces silence rather than a
 * failure -- the same shape as the bug #59 was reopened for.
 *
 * So the assertion that earns its place here is not "the file says
 * github-actions". It is the coverage cross-check below: every file the #129
 * scanner finds an external action in must sit under a path this config
 * watches, with the paths computed from the config's own globs rather than
 * restated. That is the one property whose failure would otherwise be silent.
 *
 * ## Line-based, not a YAML parse
 *
 * Same constraint and same trade as `workflow-action-policy.mjs`: a parser is
 * a dependency and dependencies need approval. The cost is that a commented-out
 * entry would still be read, and that cost is stated rather than hidden.
 */

const CONFIG_PATH = resolve(process.cwd(), ".github", "dependabot.yml");
const WORKFLOW_DIR = resolve(process.cwd(), ".github", "workflows");
const ACTIONS_DIR = resolve(process.cwd(), ".github", "actions");

const config = existsSync(CONFIG_PATH)
  ? readFileSync(CONFIG_PATH, "utf8").replace(/\r\n?/g, "\n")
  : null;

/** Config lines with comments and blanks removed, so a comment cannot satisfy an assertion. */
const configDirectives = (config ?? "")
  .split("\n")
  .map((line) => line.replace(/\s+#.*$/, "").trimEnd())
  .filter((line) => line.trim() && !line.trim().startsWith("#"));

function directive(pattern) {
  return configDirectives.some((line) => pattern.test(line));
}

/**
 * @returns the `directories:` entries, read from the config rather than
 * restated here. A test carrying its own copy of the list would pass against a
 * config that watches something else entirely.
 */
function configuredDirectories() {
  const start = configDirectives.findIndex((line) => line.trim() === "directories:");

  if (start === -1) {
    return [];
  }

  const entries = [];

  for (const line of configDirectives.slice(start + 1)) {
    const match = line.match(/^\s*-\s*"?([^"\s]+)"?\s*$/);

    if (!match) {
      break;
    }

    entries.push(match[1]);
  }

  return entries;
}

/**
 * Dependabot's `github-actions` ecosystem reads `.github/workflows` from the
 * repository root entry, and a composite action only from an entry naming its
 * own directory. Encoded here so the coverage test below is a real check
 * rather than a string comparison.
 */
function isCoveredBy(entries, repositoryPath) {
  return entries.some((entry) => {
    if (entry === "/") {
      return repositoryPath.startsWith(".github/workflows/");
    }

    const normalised = entry.replace(/^\//, "");
    const expression = new RegExp(
      `^${normalised.split("*").map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("[^/]+")}/`
    );

    return expression.test(repositoryPath);
  });
}

function workflowPaths() {
  return readdirSync(WORKFLOW_DIR)
    .filter((name) => name.endsWith(".yml") || name.endsWith(".yaml"))
    .map((name) => `.github/workflows/${name}`)
    .sort();
}

function compositeActionPaths() {
  if (!existsSync(ACTIONS_DIR)) {
    return [];
  }

  return readdirSync(ACTIONS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) =>
      ["action.yml", "action.yaml"]
        .map((file) => `.github/actions/${entry.name}/${file}`)
        .filter((path) => existsSync(resolve(process.cwd(), path)))
    )
    .sort();
}

function externalReferences(repositoryPath) {
  const source = readFileSync(resolve(process.cwd(), repositoryPath), "utf8");

  return parseActionReferences(source, repositoryPath).filter(
    (reference) => reference.kind !== "local"
  );
}

describe("controlled Action updates are configured", () => {
  it("has a Dependabot configuration at all", () => {
    // First, because every assertion below reads an empty string when this is
    // missing, and several of them would then fail for the wrong reason.
    expect(config, `${CONFIG_PATH} is missing`).not.toBeNull();
    expect(directive(/^version:\s*2$/)).toBe(true);
  });

  it("watches the github-actions ecosystem", () => {
    expect(directive(/^\s*-\s*package-ecosystem:\s*["']?github-actions["']?$/)).toBe(true);
  });

  it("does not watch npm, which belongs to Codex", () => {
    // Lockfiles and dependencies are explicitly Codex's. An npm entry here
    // would start opening pull requests against package-lock.json without
    // approval, which is a scope violation wearing the costume of a config line.
    expect(directive(/package-ecosystem:\s*["']?npm["']?/)).toBe(false);
  });

  it("states a cadence rather than defaulting to one", () => {
    expect(directive(/^\s*interval:\s*weekly$/)).toBe(true);
  });

  it("groups version updates and leaves security updates alone", () => {
    // `applies-to: version-updates` is the load-bearing half. Without it the
    // group would also swallow security updates, so an advisory would queue
    // behind a routine version bump and could not be merged on its own.
    expect(directive(/^\s*applies-to:\s*version-updates$/)).toBe(true);
  });
});

describe("the configuration covers what the pinning policy scans", () => {
  const entries = configuredDirectories();
  const workflows = workflowPaths();
  const composites = compositeActionPaths();

  it("reads its directory list from the configuration", () => {
    // Finding 14.5, applied to a config file. Every coverage assertion below
    // passes trivially against an empty entry list, because `every` over an
    // empty set of *findings* is vacuously true and so is a loop over nothing.
    // Establishing that both sides are non-empty is what separates "covered"
    // from "looked at nothing".
    expect(entries.length).toBeGreaterThanOrEqual(2);
    expect(entries).toContain("/");
    expect(workflows.length).toBeGreaterThanOrEqual(6);
    expect(composites.length).toBeGreaterThanOrEqual(3);
  });

  it("watches every workflow file that holds an external action", () => {
    // The real assertion. A workflow outside the watched paths keeps its pins
    // forever and nothing reports it -- the pin stays valid, so #129 stays
    // green, and the file simply ages out of sight.
    const uncovered = workflows
      .filter((path) => externalReferences(path).length > 0)
      .filter((path) => !isCoveredBy(entries, path));

    expect(uncovered).toEqual([]);
  });

  it("watches every composite action directory", () => {
    // None of the three uses an external action today, so this is checked by
    // path rather than by finding references: the entry has to be in place
    // before the first external `uses:` lands, not after somebody notices.
    const uncovered = composites.filter((path) => !isCoveredBy(entries, path));

    expect(uncovered).toEqual([]);
  });

  it("finds real references to justify the coverage claim", () => {
    const total = workflows.flatMap((path) => externalReferences(path));

    expect(total.length).toBeGreaterThanOrEqual(10);
  });

  it("would not cover a workflow directory nobody configured", () => {
    // Proves `isCoveredBy` can say no. A matcher that returned true for
    // everything would pass all three coverage tests above and mean nothing.
    expect(isCoveredBy(["/"], ".github/actions/setup-gitleaks/action.yml")).toBe(false);
    expect(isCoveredBy(["/.github/actions/*"], ".github/workflows/quality-gate.yml")).toBe(false);
    expect(isCoveredBy([], ".github/workflows/quality-gate.yml")).toBe(false);
  });
});

describe("a proposal from this configuration satisfies the #129 policy", () => {
  /**
   * The compatibility criterion in #136, asserted rather than assumed.
   *
   * Run through `findMutableActionReferences` -- the same function the corpus
   * scan calls -- so this proves the checker accepts the shape, not that a
   * regex written beside it does.
   */
  function fixture(reference) {
    return `jobs:\n  b:\n    steps:\n      - uses: ${reference}\n`;
  }

  it("accepts the SHA-plus-comment form Dependabot writes", () => {
    // The exact shape of a Dependabot action bump: full lowercase SHA, with the
    // human-readable version as a trailing comment.
    expect(
      findMutableActionReferences(
        fixture("actions/checkout@d23441a48e516b6c34aea4fa41551a30e30af803 # v6"),
        "proposal.yml"
      )
    ).toEqual([]);
  });

  it("still rejects the tag form, so the config cannot loosen the policy", () => {
    // If Dependabot were ever configured to write tags instead of SHAs, #129
    // must fail rather than quietly accept the downgrade. This is the assertion
    // that keeps the two halves of the control from cancelling out.
    expect(
      findMutableActionReferences(fixture("actions/checkout@v6"), "proposal.yml")
    ).toHaveLength(1);
  });

  it("keeps the version comment out of the compared reference", () => {
    const [reference] = parseActionReferences(
      fixture("actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a # v7"),
      "proposal.yml"
    );

    expect(reference.ref).toBe("043fb46d1a93c77aae656e7c1c64a875d1fc6a0a");
    expect(reference.immutable).toBe(true);
  });
});
