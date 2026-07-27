import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

const helperPath = fileURLToPath(
  new URL("./configure-bootstrap-replay-port.mjs", import.meta.url)
);
const temporaryDirectories = [];

function createConfig(contents) {
  const directory = mkdtempSync(join(tmpdir(), "jnuits-replay-port-"));
  const configPath = join(directory, "config.toml");
  temporaryDirectories.push(directory);
  writeFileSync(configPath, contents, "utf8");
  return configPath;
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("bootstrap replay database port configuration", () => {
  it("changes only the disposable database port", () => {
    const configPath = createConfig(`[api]
port = 54321

[db]
port = 54322
major_version = 15

[studio]
port = 54323
`);

    const result = spawnSync(process.execPath, [helperPath, configPath, "55122"], {
      encoding: "utf8",
    });

    expect(result.status, result.stderr).toBe(0);
    expect(readFileSync(configPath, "utf8")).toBe(`[api]
port = 54321

[db]
port = 55122
major_version = 15

[studio]
port = 54323
`);
  });

  it.each(["", "abc", "1.5", "1023", "65536"])(
    "rejects unsafe port value %j without changing the config",
    (port) => {
      const original = `[db]
port = 54322
`;
      const configPath = createConfig(original);

      const result = spawnSync(process.execPath, [helperPath, configPath, port], {
        encoding: "utf8",
      });

      expect(result.status).toBe(1);
      expect(result.stderr).toContain("integer from 1024 through 65535");
      expect(readFileSync(configPath, "utf8")).toBe(original);
    }
  );
});
