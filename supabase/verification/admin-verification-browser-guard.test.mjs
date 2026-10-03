import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const runner = fileURLToPath(new URL("./run-admin-verification-browser-qa.mjs", import.meta.url));
const preload = fileURLToPath(new URL("./admin-verification-qa-preload.cjs", import.meta.url));
describe("disposable browser runner target boundary", () => {
  it("supplements only the disposable Auth connect origin without replacing native response bodies or other CSP directives", () => {
    const source = `const {ServerResponse}=require('node:http'); const response=new ServerResponse({method:'GET'}); const original="default-src 'self'; connect-src 'self' https://*.supabase.co; object-src 'none'"; response.setHeader('Content-Security-Policy',original); const policy=response.getHeader('Content-Security-Policy'); if(policy!==original.replace("connect-src 'self' https://*.supabase.co","connect-src 'self' https://*.supabase.co http://127.0.0.1:55761")) process.exit(4);`;
    const result = spawnSync(process.execPath, ["--require", preload, "-e", source], { encoding: "utf8", env: { ...process.env, ADMIN_VERIFICATION_QA: "DISPOSABLE_SCRATCH", NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:55761", APP_BASE_URL: "http://127.0.0.1:3127", ADMIN_VERIFICATION_QA_BRIDGE: "http://127.0.0.1:3210", ADMIN_VERIFICATION_QA_TOKEN: "synthetic-fixture-token" } });
    expect(result.status).toBe(0);
  });
  it("refuses remote/linked arguments before any fixture creation", () => {
    for (const args of [["--linked"], ["--db-url", "https://not-a-local-fixture.invalid"], ["--workdir", "some-existing-project"]]) {
      const result = spawnSync(process.execPath, [runner, ...args], { encoding: "utf8" });
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain("Remote database/workdir arguments are forbidden.");
      expect(result.stdout).not.toContain("Starting disposable");
    }
  });
  it("refuses an externally supplied project even without command arguments", () => {
    const result = spawnSync(process.execPath, [runner], { encoding: "utf8", env: { ...process.env, ADMIN_VERIFICATION_QA_WORKDIR: "some-existing-project" } });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("External projects are forbidden.");
  });
  it("test mail interception cannot run against a hosted Supabase URL", () => {
    const result = spawnSync(process.execPath, ["--require", preload, "-e", "process.exit(0)"], { encoding: "utf8", env: { ...process.env, ADMIN_VERIFICATION_QA: "DISPOSABLE_SCRATCH", NEXT_PUBLIC_SUPABASE_URL: "https://not-a-local-fixture.supabase.co" } });
    expect(result.status).not.toBe(0);
    expect(result.stderr).not.toContain("Starting disposable");
  });
});
