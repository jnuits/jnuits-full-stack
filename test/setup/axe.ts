import axe, { type AxeResults, type RunOptions } from "axe-core";

/**
 * A thin wrapper over axe-core, used directly rather than through jest-axe or
 * vitest-axe. Those are small wrappers with slower release cadences and their
 * own peer-dependency constraints; this is the whole of what they provide.
 */

/**
 * Rules that cannot produce a meaningful result in jsdom.
 *
 * jsdom performs no layout and resolves no stylesheet, so anything depending on
 * computed geometry or colour is unanswerable here. Leaving these enabled does
 * not make the suite stricter, it makes it dishonest: the rule either reports a
 * false pass because it found nothing to measure, or returns an `incomplete`
 * that has to be ignored anyway.
 *
 * Contrast and target size stay visual checks, and Tailwind classes are asserted
 * as source text where that is all that can be done.
 */
const UNRESOLVABLE_IN_JSDOM = [
  "color-contrast",
  "target-size",
] as const;

export type AxeViolation = {
  help: string;
  id: string;
  impact: null | string;
  targets: string[];
};

function summarise(results: AxeResults): AxeViolation[] {
  return results.violations.map((violation) => ({
    help: violation.help,
    id: violation.id,
    impact: violation.impact ?? null,
    targets: violation.nodes.flatMap((node) => node.target.map(String)),
  }));
}

/**
 * @returns the violations found in `container`, summarised to the fields worth
 * reading in a failure message. Returning an array rather than throwing means
 * the caller writes a normal assertion and gets the usual diff.
 */
export async function findAccessibilityViolations(
  container: Element,
  options: RunOptions = {}
): Promise<AxeViolation[]> {
  const results = await axe.run(container, {
    ...options,
    rules: {
      ...Object.fromEntries(
        UNRESOLVABLE_IN_JSDOM.map((rule) => [rule, { enabled: false }])
      ),
      ...options.rules,
    },
  });

  return summarise(results);
}
