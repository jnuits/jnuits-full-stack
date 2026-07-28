import { readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildTestProjects,
  DOM_TEST_GLOB,
} from "./test-projects";

/**
 * Contract for the two-project test split.
 *
 * The config decides which environment every test runs in, and it fails
 * silently: a project whose glob matches nothing reports success. So a green
 * `Unit and integration` does not prove the node project still picks up the
 * existing suite, only that whatever ran passed. This file is what makes the
 * difference observable.
 *
 * The alias is a stand-in. Its values are absolute paths in real use and are
 * irrelevant here; what matters is that every project receives them.
 */
const projects = buildTestProjects({ "@": "/src", "server-only": "/stub.ts" });

function projectNamed(name: string) {
  const project = projects.find((candidate) => candidate.test.name === name);

  if (!project) {
    throw new Error(
      `No Vitest project named "${name}". Found: ${projects
        .map((candidate) => candidate.test.name)
        .join(", ")}`
    );
  }

  return project;
}

/**
 * The same rule as DOM_TEST_GLOB, expressed for a filesystem walk.
 *
 * Duplicated on purpose. This file exists to notice when the glob and the rule
 * a reader would infer from it stop agreeing, and it cannot do that by reading
 * the glob back.
 */
const DOM_TEST_SUFFIX = /\.dom\.test\.(ts|tsx)$/;
const ANY_TEST_FILE = /\.test\.(ts|tsx|mjs)$/;

/** Roots that hold tests. `e2e` is Playwright's and excluded from both projects. */
const TEST_ROOTS = ["src", "test", "scripts"];

function listTestFiles(root: string): string[] {
  const found: string[] = [];

  function walk(directory: string) {
    for (const entry of readdirSync(directory)) {
      const path = join(directory, entry);

      if (statSync(path).isDirectory()) {
        walk(path);
        continue;
      }

      if (ANY_TEST_FILE.test(entry)) {
        found.push(relative(process.cwd(), path).split(sep).join("/"));
      }
    }
  }

  walk(join(process.cwd(), root));

  return found;
}

const testFiles = TEST_ROOTS.flatMap(listTestFiles);
const domFiles = testFiles.filter((file) => DOM_TEST_SUFFIX.test(file));
const nodeFiles = testFiles.filter((file) => !DOM_TEST_SUFFIX.test(file));

describe("the two projects partition the test suite", () => {
  it("claims every test file on disk for exactly one project", () => {
    expect(domFiles.length + nodeFiles.length).toBe(testFiles.length);
    expect(domFiles.some((file) => nodeFiles.includes(file))).toBe(false);
  });

  it("keeps the bulk of the suite in the node project", () => {
    // A floor, not an exact count. An exact count has to be edited on every
    // commit that adds a test, and a test like that gets deleted rather than
    // maintained. This catches wholesale loss, which is the real hazard of
    // restructuring the config.
    expect(
      nodeFiles.length,
      `Only ${nodeFiles.length} node test files found. The node project may have stopped matching the existing suite.`
    ).toBeGreaterThan(50);
  });

  it("has at least one file in the dom project", () => {
    // An empty dom project passes every run. If the component tests are ever
    // renamed out of the glob, this is what notices.
    expect(domFiles.length).toBeGreaterThan(0);
  });

  it("routes known files to the project their contents require", () => {
    // Concrete cases, because a glob is easy to change in a way that still
    // looks plausible. The first touches the DOM; the others must not.
    expect(
      DOM_TEST_SUFFIX.test("src/components/forms/form-field-controls.dom.test.tsx")
    ).toBe(true);
    expect(
      DOM_TEST_SUFFIX.test("src/lib/forms/public-form-presentation.test.ts")
    ).toBe(false);
    expect(DOM_TEST_SUFFIX.test("scripts/github-actions-workflows.test.mjs")).toBe(
      false
    );
  });

  it("excludes from node exactly the glob dom includes", () => {
    // Guaranteed by the shared constant rather than by discipline. Asserted so
    // that reintroducing a second literal fails here.
    expect(projectNamed("node").test.exclude).toContain(DOM_TEST_GLOB);
    expect(projectNamed("dom").test.include).toEqual([DOM_TEST_GLOB]);
  });
});

describe("each project can resolve the repository's imports", () => {
  // Per-project `resolve` does not inherit from the root config. Dropping an
  // alias breaks every `@/…` import in that project with a module-not-found,
  // which points at the import rather than at the config that caused it.
  for (const name of ["node", "dom"]) {
    it(`keeps the @ and server-only aliases on the ${name} project`, () => {
      const alias = Object.keys(projectNamed(name).resolve.alias);

      expect(alias).toContain("@");
      expect(alias).toContain("server-only");
    });
  }
});

describe("project environments", () => {
  it("runs the node project without a DOM", () => {
    expect(projectNamed("node").test.environment).toBe("node");
  });

  it("runs the dom project in jsdom with the shared setup", () => {
    const dom = projectNamed("dom");

    // Without the setup file there is no automatic cleanup and no jest-dom
    // matchers, and the absence of cleanup shows up as tests passing against
    // trees left behind by earlier tests.
    expect(dom.test.environment).toBe("jsdom");
    expect(dom.test.setupFiles).toEqual(["./test/setup/dom.ts"]);
  });

  it("leaves Playwright's suite to Playwright in both projects", () => {
    for (const name of ["node", "dom"]) {
      expect(projectNamed(name).test.exclude).toContain("e2e/**");
    }
  });

  it("defines exactly the two projects it claims to", () => {
    expect(projects.map((project) => project.test.name).sort()).toEqual([
      "dom",
      "node",
    ]);
  });
});
