const { spawnSync } = require("child_process");

const passthroughArgs = process.argv.slice(2);
const hasWorkersArg = passthroughArgs.some((arg) => arg === "--workers" || arg.startsWith("--workers="));
const hasRetriesArg = passthroughArgs.some((arg) => arg === "--retries" || arg.startsWith("--retries="));
const matrixWorkers = process.env.PLAYWRIGHT_MATRIX_WORKERS || "3";
const matrixRetries = process.env.PLAYWRIGHT_MATRIX_RETRIES || "1";
const playwrightArgs = [
  "playwright",
  "test",
  ...(hasWorkersArg ? [] : [`--workers=${matrixWorkers}`]),
  ...(hasRetriesArg ? [] : [`--retries=${matrixRetries}`]),
  ...passthroughArgs,
];

const result = process.platform === "win32"
  ? spawnSync("cmd.exe", ["/d", "/s", "/c", "npx", ...playwrightArgs], {
      env: {
        ...process.env,
        PLAYWRIGHT_FULL_MATRIX: "1",
      },
      stdio: "inherit",
    })
  : spawnSync("npx", playwrightArgs, {
      env: {
        ...process.env,
        PLAYWRIGHT_FULL_MATRIX: "1",
      },
      stdio: "inherit",
    });

if (result.error) {
  console.error(result.error.message);
  process.exitCode = 1;
} else {
  process.exitCode = result.status ?? 1;
}
