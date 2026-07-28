import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Adds toBeInvalid, toHaveAccessibleName, toHaveFocus and the rest. Without
// these, every accessibility assertion becomes a hand-rolled attribute check,
// which is how you end up asserting the presence of an attribute instead of the
// behaviour it is supposed to produce.
import "@testing-library/jest-dom/vitest";

/**
 * Cleanup is explicit on purpose.
 *
 * Testing Library registers its own automatic cleanup only when it can find a
 * global `afterEach`. This repository sets `globals: false`, so that detection
 * fails silently: renders would accumulate in one document and queries would
 * start matching trees left behind by earlier tests. The failure mode is a test
 * that passes for the wrong reason, which is worse than one that fails.
 */
afterEach(() => {
  cleanup();
});
