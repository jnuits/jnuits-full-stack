import { readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { describe, expect, it } from "vitest";

import viteConfig from "../../vitest.config";

/**
 * Contract for the two-project test split.
 *
 * The config decides which environment every test runs in, and it fails
 * silently: a project whose glob matches nothing reports success, so a green
 * `Unit and integration` does not prove the node project still picks up the
 * existing suite. It only proves that whatever ran passed. This file turns the
 * split into something enforced rather than something assumed.
 *
 * Vitest's project type is a union of strings, globs and inline configs. This
 * repository only uses inline configs, so the cast narrows to what is actually
 * there instead of threading a wider type through every assertion.
 */

type ProjectConfig = {
  resolve?: { alias?: Record<string, string> };
  test?: {
    environment?: string;
    exclude?: string[];
    include?: string[];
    name?: string;
    setupFiles?: string[];
  };
};

const config = viteConfig as unknown as {
  test?: { projects?: ProjectConfig[] };
};

const projects = config.test?.projects ?? [];

function projectNamed(name: string) {
  const project = projects.find((candidate) => candidate.test?.name === name);

  if (!project) {
    throw new Error(
      `No Vitest project named "${name}". Found: ${projects
        .map((candidate) => candidate.test?.name ?? "<unnamed>")
        .join(", ")}`
    );
  }

  return project;
}

/**
 * The glob the dom project owns.
 *
 * Written out rather than read from the config, because the point of this file
 * is to notice when the config changes. Reading it from the config would make
 * every assertion below tautological.
 */
const DOM_TEST_GLOB = "**/*.dom.test.{ts,tsx}";

/** The same rule as DOM_TEST_GLOB, expressed for a filesystem walk. */
const DOM_TEST_SUFFIX = /\.dom\.test\.(ts|tsx)$/;
const ANY_TEST_FILE = /\.test\.(ts|tsx|mjs)$/;

/** Roots that hold tests. `e2e` is Playwright's and excluded from both projects. */
const TEST_ROOTS = ["src", "test", "scripts"];

function listTestFiles(root: string): string[] {
  const absoluteRoot = join(process.cwd(), root);
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

  walk(absoluteRoot);

  return found;
}

const testFiles = TEST_ROOTS.flatMap(listTestFiles);

describe("the two projects partition the test suite", () => {
  it("excludes from node exactly what dom includes", () => {
    const node = projectNamed("node");
    const dom = projectNamed("dom");

    // The failure this prevents: changing one side and not the other. A file
    // then runs in both projects, or in neither, and "neither" produces no
    // output at all.
    expect(node.test?.exclude).toContain(DOM_TEST_GLOB);
    expect(dom.test?.include).toEqual([DOM_TEST_GLOB]);
  });

  it("claims every test file on disk for exactly one project", () => {
    const domFiles = testFiles.filter((file) => DOM_TEST_SUFFIX.test(file));
    const nodeFiles = testFiles.filter((file) => !DOM_TEST_SUFFIX.test(file));

    expect(domFiles.length + nodeFiles.length).toBe(testFiles.length);
    expect(domFiles.some((file) => nodeFiles.includes(file))).toBe(false);
  });

  it("keeps the bulk of the suite in the node project", () => {
    const nodeFiles = testFiles.filter((file) => !DOM_TEST_SUFFIX.test(file));

    // A floor, not an exact count. An exact count has to be edited on every
    // commit that adds a test, and a test like that gets deleted rather than
    // maintained. This is here to catch wholesale loss, which is the real
    // hazard of restructuring the config.
    expect(
      nodeFiles.length,
      `Only ${nodeFiles.length} node test files found. The node project may have stopped matching the existing suite.`
    ).toBeGreaterThan(50);
  });

  it("has at least one file in the dom project", () => {
    const domFiles = testFiles.filter((file) => DOM_TEST_SUFFIX.test(file));

    // An empty dom project passes every run. If the component tests are ever
    // renamed out of the glob, this is what notices.
    expect(domFiles.length).toBeGreaterThan(0);
  });

  it("routes known files to the project their contents require", () => {
    // Concrete cases, because a glob is easy to change in a way that still
    // looks plausible. The first two touch the DOM; the rest must not.
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
});

describe("each project can resolve the repository's imports", () => {
  // Per-project `resolve` does not inherit from the root config. Dropping an
  // alias breaks every `@/…` import in that project with a module-not-found,
  // which points at the import rather than at the config that caused it.
  for (const name of ["node", "dom"]) {
    it(`keeps the @ and server-only aliases on the ${name} project`, () => {
      const alias = projectNamed(name).resolve?.alias ?? {};

      expect(Object.keys(alias)).toContain("@");
      expect(Object.keys(alias)).toContain("server-only");
    });
  }
});

describe("project environments", () => {
  it("runs the node project without a DOM", () => {
    expect(projectNamed("node").test?.environment).toBe("node");
  });

  it("runs the dom project in jsdom with the shared setup", () => {
    const dom = projectNamed("dom");

    // Without the setup file there is no automatic cleanup and no jest-dom
    // matchers, and the absence of cleanup shows up as tests passing against
    // trees left behind by earlier tests.
    expect(dom.test?.environment).toBe("jsdom");
    expect(dom.test?.setupFiles).toEqual(["./test/setup/dom.ts"]);
  });

  it("leaves Playwright's suite to Playwright in both projects", () => {
    for (const name of ["node", "dom"]) {
      expect(projectNamed(name).test?.exclude).toContain("e2e/**");
    }
  });

  it("defines exactly the two projects it claims to", () => {
    expect(projects.map((project) => project.test?.name).sort()).toEqual([
      "dom",
      "node",
    ]);
  });
});
