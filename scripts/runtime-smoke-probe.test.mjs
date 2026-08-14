import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { resolve } from "node:path";

import { expect, it } from "vitest";

const repositoryRoot = resolve(import.meta.dirname, "..");
const probePath = resolve(import.meta.dirname, "runtime-smoke-probe.mjs");

function listen(server) {
  return new Promise((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolveListen(server.address()));
  });
}

function close(server) {
  return new Promise((resolveClose, reject) => {
    server.close((error) => (error ? reject(error) : resolveClose()));
  });
}

function runProbe(baseUrl, bypassSecret) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(process.execPath, [probePath], {
      cwd: repositoryRoot,
      env: {
        ...process.env,
        RUNTIME_PROBE_BASE_URL: baseUrl,
        VERCEL_AUTOMATION_BYPASS_SECRET: bypassSecret,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("error", reject);
    child.once("close", (code) => resolveRun({ code, stderr, stdout }));
  });
}

it("sends the configured Vercel automation bypass secret with every probe request", async () => {
  const expectedSecret = "test-vercel-automation-bypass";
  const observedSecrets = [];
  const server = createServer((request, response) => {
    observedSecrets.push(request.headers["x-vercel-protection-bypass"]);
    response.statusCode = request.headers["x-vercel-protection-bypass"] === expectedSecret ? 200 : 429;
    response.end();
  });

  const address = await listen(server);
  try {
    const result = await runProbe(`http://127.0.0.1:${address.port}`, expectedSecret);

    expect(result, result.stderr || result.stdout).toMatchObject({ code: 0 });
    expect(observedSecrets).toEqual(Array(5).fill(expectedSecret));
  } finally {
    await close(server);
  }
});
