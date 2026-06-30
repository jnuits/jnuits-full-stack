const { spawnSync } = require("child_process");

const command = process.platform === "win32" ? "npx.cmd" : "npx";
const result = spawnSync(command, ["playwright", "test", ...process.argv.slice(2)], {
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
