/**
 * The immutable-Action policy for `.github`, as one scanner. Issue #59.
 *
 * ## Why this is a module and not a regex inside the test
 *
 * The test needs a negative fixture proving a mutable tag is rejected. A
 * fixture is only evidence if it travels the same code path as the real scan;
 * a regex copied into the test beside the one doing the scanning proves that
 * the copy works and says nothing about the checker. That is finding 14.5
 * wearing a different hat: a green result that never exercised the thing it
 * claims to cover.
 *
 * ## Why a line scan and not a YAML parse
 *
 * A real parse would need `js-yaml` or equivalent, and a new dependency needs
 * approval. The cost of not having one is stated rather than hidden: this is
 * line-based, so a `uses:`-shaped line inside a `run:` block would be picked
 * up and reported.
 *
 * That direction is the safe one. A false positive fails loudly and a human
 * removes it in a reviewed diff. The opposite bias -- quietly skipping
 * anything the scanner does not recognise -- is precisely the failure mode
 * #59 exists to prevent, and is how `diff-check.yml` and
 * `preproduction-alumni.yml` went unchecked for as long as they did.
 */

/**
 * Exactly forty lowercase hexadecimal characters.
 *
 * No `i` flag, deliberately. Git resolves an uppercase SHA perfectly well, so
 * accepting one would not break a workflow; it would break the *review*, by
 * letting two spellings of the same pin exist and making "has this moved?" a
 * case-insensitive comparison somebody eventually gets wrong. One spelling.
 */
export const IMMUTABLE_SHA_PATTERN = /^[0-9a-f]{40}$/;

/**
 * A `uses:` line, in either the block form the repository writes today
 * (`- name:` then an indented `uses:`) or the list-item form `- uses:`.
 *
 * Both are accepted because the point of #59 is that a *new* workflow is
 * covered automatically, and nothing obliges its author to write the style
 * this repository happens to use. A pattern that only matched the current
 * style would reintroduce the hardcoded-list problem one level down.
 *
 * `[^\n#]+` stops at the trailing `# v6` version comment, which is the
 * human-readable half of the pin and not part of the reference. It also means
 * a fully commented-out line never matches, because the `#` precedes `uses:`.
 */
const USES_PATTERN = /^[ \t]*(?:-[ \t]+)?uses:[ \t]*(?<value>[^\n#]+)/gm;

/**
 * @returns what a single `uses:` value is, and whether it is immutable.
 *
 * Three outcomes:
 *
 *   - `local`: a `./` path into this repository. Immutable by definition, since
 *     it is delivered by the same commit as the workflow that calls it. This is
 *     the only allowance.
 *   - `external`: `owner/repo[/path]@ref`. Immutable only when `ref` is a full
 *     commit SHA.
 *   - `unpinned`: anything else, including a bare `owner/repo` with no ref and
 *     a `docker://` image. **Reported, not skipped.** An unrecognised form is
 *     the one case where being generous costs the most, because it is exactly
 *     what a novel supply-chain reference looks like to a scanner written
 *     before it existed.
 */
export function classifyActionReference(raw) {
  if (raw.startsWith("./")) {
    return { immutable: true, kind: "local", ref: null, target: raw };
  }

  // `lastIndexOf`, because a container reference can carry an `@` inside its
  // registry path and the ref is always the final segment.
  const separator = raw.lastIndexOf("@");

  if (separator <= 0) {
    return { immutable: false, kind: "unpinned", ref: null, target: raw };
  }

  const ref = raw.slice(separator + 1);

  return {
    immutable: IMMUTABLE_SHA_PATTERN.test(ref),
    kind: "external",
    ref,
    target: raw.slice(0, separator),
  };
}

/**
 * @returns every action reference in one workflow or composite action, each
 * carrying the file and line it came from so a failure names the place to fix
 * rather than only the string that is wrong.
 */
export function parseActionReferences(source, origin = "unknown") {
  const normalised = source.replace(/\r\n?/g, "\n");
  const references = [];

  for (const match of normalised.matchAll(USES_PATTERN)) {
    const raw = match.groups.value
      .trim()
      .replace(/^['"]|['"]$/g, "")
      .trim();

    if (!raw) {
      continue;
    }

    references.push({
      ...classifyActionReference(raw),
      line: normalised.slice(0, match.index).split("\n").length,
      origin,
      raw,
    });
  }

  return references;
}

/** @returns only the references that violate the policy. */
export function findMutableActionReferences(source, origin) {
  return parseActionReferences(source, origin).filter(
    (reference) => !reference.immutable
  );
}

/** One offender, phrased so a CI log says where to go. */
export function describeActionReference(reference) {
  return `${reference.origin}:${reference.line} uses: ${reference.raw} (${reference.kind})`;
}
