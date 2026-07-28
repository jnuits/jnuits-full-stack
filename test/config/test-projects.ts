import { configDefaults } from "vitest/config";

/**
 * The project split, built here rather than inline in `vitest.config.ts` so it
 * can be tested without importing the config.
 *
 * Importing the config from a test looks like the obvious approach and is not:
 * the config uses `__dirname`, which Vitest's own loader provides by bundling
 * the file, but which does not exist in the ESM transform applied to test
 * files. Keeping Node globals in the config and the decisions in here means the
 * decisions are reachable from a test.
 *
 * Deliberately free of Node APIs and of `import.meta`, for the same reason.
 */

/**
 * The glob owned by the jsdom project.
 *
 * One constant, used as both the node project's exclusion and the dom
 * project's only inclusion. Two literals could drift, and the drift is
 * invisible: a file matched by neither project simply never runs and reports
 * nothing.
 */
export const DOM_TEST_GLOB = "**/*.dom.test.{ts,tsx}";

/** Not ours to run. `.agents` is tooling; `e2e` belongs to Playwright. */
export const EXTRA_EXCLUDE = [".agents/**", "e2e/**"];

export const SHARED_EXCLUDE = [...configDefaults.exclude, ...EXTRA_EXCLUDE];

export type TestAlias = Record<string, string>;

/**
 * @param alias resolve aliases, passed in because building them needs a
 * filesystem path and this module deliberately has no access to one. Applied to
 * every project: per-project `resolve` does not inherit from the root config,
 * so a project without the alias fails every `@/…` import.
 */
export function buildTestProjects(alias: TestAlias) {
  return [
    {
      resolve: { alias },
      test: {
        environment: "node" as const,
        exclude: [...SHARED_EXCLUDE, DOM_TEST_GLOB],
        globals: false,
        name: "node",
      },
    },
    {
      resolve: { alias },
      test: {
        environment: "jsdom" as const,
        exclude: SHARED_EXCLUDE,
        globals: false,
        include: [DOM_TEST_GLOB],
        name: "dom",
        setupFiles: ["./test/setup/dom.ts"],
      },
    },
  ];
}
