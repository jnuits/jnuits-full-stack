#!/usr/bin/env node

const {
  formatMigrationParityReport,
  getLocalMigrationFiles,
  loadDotEnvLocal,
  runMigrationParityCheck,
} = require("./lib/migration-parity.cjs");

async function main() {
  loadDotEnvLocal();

  const localFiles = getLocalMigrationFiles();
  const result = runMigrationParityCheck({
    cwd: process.cwd(),
    env: process.env,
    localFiles,
  });

  console.log(formatMigrationParityReport(result));
  return result.exitCode;
}

if (require.main === module) {
  main()
    .then((exitCode) => {
      process.exitCode = exitCode;
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
}
