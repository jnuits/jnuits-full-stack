# Next ESLint root-glob adapter

This private local package replaces only `@next/eslint-plugin-next@16.3.8`'s
`fast-glob` dependency. The plugin uses one API:
`globSync(string, { onlyDirectories: true })` in `get-root-dirs`.
It is not a general-purpose implementation of fast-glob.

The original dependency brings in `micromatch` and the unpatched `braces`
advisory [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm).
This replacement removes that code, rather than suppressing its audit result.
It uses pinned `tinyglobby@0.2.17`, already used by the repository's tooling.
Following its [migration guide](https://superchupu.dev/tinyglobby/migration),
directory expansion is disabled and absolute patterns retain absolute results.

The root dev dependency supplies a portable `file:` target; the version-scoped
npm override references it with `$fast-glob`. Keep the local target files in
Git so a clean `npm ci` can install the same package on Windows and Linux.
Do not broaden the override to unrelated consumers. When upgrading the Next
plugin, recheck its consumed API and remove this adapter once upstream no
longer brings in the vulnerable chain.

`scripts/next-eslint-root-glob.test.mjs` exercises the actual installed Next
plugin: literal/wildcard/relative/absolute roots, arrays, braces, Windows paths,
and real navigation/image lint diagnostics. It fails if the plugin loads
`braces` or `micromatch`. The normal dependency audit and required CI gates
remain unchanged and mandatory.
