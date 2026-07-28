import path from "node:path";
import { configDefaults, defineConfig } from "vitest/config";

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
 * is what tells a reader which environment a test runs in. The node project
 * excludes it and the dom project includes only it, so a file cannot end up in
 * the wrong environment by accident.
 */

const alias = {
  "@": path.resolve(__dirname, "src"),
  "server-only": path.resolve(__dirname, "test/mocks/server-only.ts"),
};

const DOM_TEST_GLOB = "**/*.dom.test.{ts,tsx}";

const sharedExclude = [...configDefaults.exclude, ".agents/**", "e2e/**"];

export default defineConfig({
  resolve: { alias },
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          environment: "node",
          exclude: [...sharedExclude, DOM_TEST_GLOB],
          globals: false,
          name: "node",
        },
      },
      {
        resolve: { alias },
        test: {
          environment: "jsdom",
          exclude: sharedExclude,
          globals: false,
          include: [DOM_TEST_GLOB],
          name: "dom",
          setupFiles: ["./test/setup/dom.ts"],
        },
      },
    ],
  },
});
