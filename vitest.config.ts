import path from "node:path";
import { defineConfig } from "vitest/config";

import { buildTestProjects } from "./test/config/test-projects";

/**
 * Two projects, not one environment.
 *
 * The Node suite is several hundred fast tests over pure modules. jsdom costs
 * real startup time per file, so running everything in it taxes every test to
 * benefit the handful that render. Vitest 4 also removed
 * `environmentMatchGlobs`, so `projects` is the supported mechanism here rather
 * than a stylistic choice.
 *
 * Component tests are named `*.dom.test.tsx`. The suffix, not a config lookup,
 * is what tells a reader which environment a test runs in.
 *
 * The split itself lives in `test/config/test-projects.ts`, which owns no Node
 * globals and is therefore testable. This file owns `__dirname` and nothing
 * else.
 */

const alias = {
  "@": path.resolve(__dirname, "src"),
  "server-only": path.resolve(__dirname, "test/mocks/server-only.ts"),
};

export default defineConfig({
  resolve: { alias },
  test: { projects: buildTestProjects(alias) },
});
