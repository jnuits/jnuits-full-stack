#!/usr/bin/env node
/**
 * Applied migration integrity gate (issue #19).
 *
 *   npm run migration:manifest         verify the committed manifest
 *   npm run migration:manifest:write   regenerate it after adding a migration
 *
 * Exit codes: 0 verified, 2 integrity failure, 3 manifest absent.
 *
 * This check is offline. It never contacts Supabase, never reads .env, and
 * never prints a credential. It is complementary to `npm run migration:check`,
 * which compares local filenames against linked remote history; neither one
 * replaces the other.
 */

const {
  formatVerificationReport,
  verifyManifest,
  writeManifest,
} = require("./lib/migration-manifest.cjs");

function main() {
  const cwd = process.cwd();
  const shouldWrite = process.argv.includes("--write");

  if (shouldWrite) {
    const manifest = writeManifest(cwd);
    console.log(
      `Wrote supabase/migration-manifest.json for ${manifest.migrations.length} migrations.`
    );
    console.log(
      "Review the diff before committing. A digest change on an already-applied migration means the SQL was edited."
    );
    return 0;
  }

  const result = verifyManifest(cwd);
  const report = formatVerificationReport(result);

  if (result.exitCode === 0) {
    console.log(report);
  } else {
    console.error(report);
  }

  return result.exitCode;
}

try {
  process.exit(main());
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
