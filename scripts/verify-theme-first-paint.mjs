import { spawn, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.THEME_EVIDENCE_PORT || 3210);
if (!Number.isInteger(PORT) || PORT < 1024 || PORT > 65535) throw new Error("Invalid evidence port");
const timestamp = new Date().toISOString();
const evidenceDir = path.join(projectRoot, "artifacts", "reports", "theme-first-paint-" + timestamp.replace(/[:.]/g, "-"));
fs.mkdirSync(evidenceDir, { recursive: true });
const ciEnv = {
  ...process.env,
  APP_BASE_URL: "https://jnuits.org.bd",
  APP_MAC_SECRET: "ci-placeholder-application-mac-secret-000000000000",
  AUTH_CAPTCHA_REQUIRED: "true",
  CLOUDINARY_API_KEY: "ci-placeholder-cloudinary-api-key",
  CLOUDINARY_API_SECRET: "ci-placeholder-cloudinary-api-secret",
  CLOUDINARY_CLOUD_NAME: "ci-placeholder-cloudinary-cloud",
  GOOGLE_DRIVE_EXPORTS_FOLDER_ID: "ci-placeholder-exports-folder",
  GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL: "ci@example.test",
  GOOGLE_DRIVE_SERVICE_ACCOUNT_PRIVATE_KEY: "ci-placeholder-private-key",
  GOOGLE_DRIVE_SHARED_DRIVE_ID: "ci-placeholder-shared-drive",
  NEXT_PUBLIC_SENTRY_DSN: "https://public@example.ingest.sentry.io/123",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "ci-placeholder-publishable-key",
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: "ci-placeholder-turnstile-site-key",
  RATE_LIMIT_BACKEND: "supabase",
  RATE_LIMIT_SECRET_SALT: "ci-placeholder-rate-limit-secret-salt-000000",
  RESEND_API_KEY: "re_ci_placeholder",
  RESEND_FROM_EMAIL: "JnUITS <no-reply@example.test>",
  RESEND_WEBHOOK_SECRET: "whsec_ci_placeholder",
  RETENTION_MANIFEST_SIGNING_SECRET: "ci-placeholder-retention-manifest-signing-secret",
  SUPABASE_SECRET_KEY: "ci-placeholder-supabase-secret-key",
  TURNSTILE_SECRET_KEY: "ci-placeholder-turnstile-secret-key",
  PORT: String(PORT),
};


// The runner owns a fresh build and isolated fixture server. Never reuse an
// unidentified server or overwrite the preserved AGY evidence pack.
Object.assign(ciEnv, {
  CI: "1", PLAYWRIGHT_PORT: String(PORT), PLAYWRIGHT_FULL_MATRIX: "1",
  JNUITS_PUBLIC_BROWSER_FIXTURES: "1", JNUITS_CONTENT_BROWSER_FIXTURES: "1",
  NODE_OPTIONS: "--import=./e2e/fixtures/public-database.mjs",
  PLAYWRIGHT_JSON_OUTPUT_NAME: path.join(evidenceDir, "playwright-results.json"),
});
delete ciEnv.PLAYWRIGHT_BASE_URL;
delete ciEnv.PLAYWRIGHT_REUSE_EXISTING_SERVER;

function git(...args) {
  return execFileSync("git", args, { cwd: projectRoot, encoding: "utf8" }).trim();
}
const revision = {
  head: git("rev-parse", "HEAD"), tree: git("rev-parse", "HEAD^{tree}"),
  branch: git("branch", "--show-current"),
  trackedDiffSha256: createHash("sha256").update(git("diff", "HEAD", "--binary")).digest("hex"),
  status: git("status", "--short", "--untracked-files=no"),
};
const commands = [];
async function run(label, args) {
  const log = fs.openSync(path.join(evidenceDir, label + ".log"), "w");
  try {
    const child = spawn(process.execPath, args, {
      cwd: projectRoot, env: ciEnv, windowsHide: true, stdio: ["ignore", log, log],
    });
    const exitCode = await new Promise((resolve, reject) => {
      child.once("error", reject);
      child.once("exit", (code, signal) => resolve(code ?? (signal ? 1 : 0)));
    });
    commands.push({ label, args, exitCode });
    console.log(label + ": exit " + exitCode);
    if (exitCode !== 0) throw new Error(label + " failed; inspect its preserved log");
  } finally {
    fs.closeSync(log);
  }
}

let complete = false;
try {
  try {
    await fetch("http://127.0.0.1:" + PORT + "/", { signal: AbortSignal.timeout(1000) });
    throw new Error("Evidence port is already occupied; choose THEME_EVIDENCE_PORT");
  } catch (error) {
    if (!String(error).includes("fetch failed") && error.name !== "TimeoutError") throw error;
    // A timeout is ambiguous: fail closed instead of reusing that server.
    if (error.name === "TimeoutError") throw new Error("Evidence port did not resolve safely");
  }
  await run("environment-validation", ["scripts/validate-env.mjs", "--production"]);
  await run("production-build", ["node_modules/next/dist/bin/next", "build"]);
  if (revision.head !== git("rev-parse", "HEAD") || revision.trackedDiffSha256 !==
    createHash("sha256").update(git("diff", "HEAD", "--binary")).digest("hex")) {
    throw new Error("Tracked source changed during the build");
  }
  await run("browser-matrix", ["node_modules/@playwright/test/cli.js", "test",
    "e2e/theme-first-paint.spec.ts", "--output=" + path.join(evidenceDir, "browser-artifacts"),
    "--reporter=json,line", ...process.argv.slice(2)]);
  if (revision.head !== git("rev-parse", "HEAD") || revision.trackedDiffSha256 !==
    createHash("sha256").update(git("diff", "HEAD", "--binary")).digest("hex")) {
    throw new Error("Tracked source changed during browser verification");
  }
  complete = true;
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  fs.writeFileSync(path.join(evidenceDir, "receipt.json"), JSON.stringify({
    timestamp, revision, buildId: fs.existsSync(path.join(projectRoot, ".next", "BUILD_ID"))
      ? fs.readFileSync(path.join(projectRoot, ".next", "BUILD_ID"), "utf8").trim() : null,
    baseURL: "http://127.0.0.1:" + PORT, complete, commands,
    limitation: "Local fixture acceptance only. See each browser attachment for Paint Timing support; visible-frame observations are not a universal zero-millisecond claim.",
  }, null, 2));
  console.log("Preserved evidence: " + evidenceDir);
}
