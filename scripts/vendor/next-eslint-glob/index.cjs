const { isAbsolute } = require("node:path");
const { globSync } = require("tinyglobby");

// Next 16.3.8 uses only globSync(string, { onlyDirectories: true }). This
// adapter is scoped to that exact plugin version, not a general fast-glob
// replacement. Keep literal directory roots non-recursive and preserve
// absolute patterns' absolute results, matching the consumed fast-glob API.
exports.globSync = (pattern, options = {}) => globSync(pattern, {
  ...options,
  absolute: options.absolute ?? isAbsolute(pattern),
  expandDirectories: false,
});
