#!/usr/bin/env node

const { main } = require("./lib/admin-invite-search-verification.cjs");

main()
  .then((exitCode) => {
    process.exitCode = exitCode;
  })
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });