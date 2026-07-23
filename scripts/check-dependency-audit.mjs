import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const SHARP_EXCEPTION_EXPIRES_AT = Date.parse("2026-09-01T00:00:00Z");

const ALLOWED_ADVISORY_URL =
  "https://github.com/advisories/GHSA-f88m-g3jw-g9cj";
const MINIMUM_SAFE_NEXT_VERSION = [16, 2, 11];
const REPORTABLE_SEVERITIES = new Set(["moderate", "high", "critical"]);

function fail(message) {
  throw new Error(message);
}

function compareVersions(left, right) {
  const parts = String(left)
    .split(".")
    .slice(0, 3)
    .map((value) => Number.parseInt(value, 10));

  if (parts.length !== 3 || parts.some((value) => !Number.isInteger(value))) {
    fail(`Unsupported Next.js version in lockfile: ${left}`);
  }

  for (let index = 0; index < right.length; index += 1) {
    if (parts[index] !== right[index]) {
      return parts[index] - right[index];
    }
  }

  return 0;
}

function expectOnly(values, expected, label) {
  const actual = [...values].sort();
  const wanted = [...expected].sort();

  if (JSON.stringify(actual) !== JSON.stringify(wanted)) {
    fail(`${label}: expected ${wanted.join(", ")}; received ${actual.join(", ") || "none"}.`);
  }
}

export function evaluateDependencyAudit({
  lock,
  nextConfig,
  now = Date.now(),
  report,
}) {
  if (report?.error) {
    fail(`npm audit failed: ${report.error.summary || "unknown audit error"}`);
  }

  const reportable = Object.entries(report?.vulnerabilities || {}).filter(
    ([, vulnerability]) => REPORTABLE_SEVERITIES.has(vulnerability.severity)
  );

  if (reportable.length === 0) {
    return "Dependency audit passed: no moderate, high, or critical vulnerabilities.";
  }

  expectOnly(
    reportable.map(([name]) => name),
    ["next", "sharp"],
    "Unexpected dependency vulnerabilities"
  );

  if (now >= SHARP_EXCEPTION_EXPIRES_AT) {
    fail("Sharp security exception expired. Upgrade stable Next.js and remove the exception.");
  }

  const nextVulnerability = report.vulnerabilities.next;
  const sharpVulnerability = report.vulnerabilities.sharp;

  if (
    nextVulnerability.severity !== "high" ||
    nextVulnerability.isDirect !== true ||
    nextVulnerability.range !==
      "9.5.6-canary.0 - 10.0.7 || 14.3.0-canary.0 - 16.3.0-preview.7"
  ) {
    fail("Next.js advisory shape changed; review required.");
  }

  expectOnly(nextVulnerability.via, ["sharp"], "Unexpected Next.js advisory chain");
  expectOnly(nextVulnerability.nodes, ["node_modules/next"], "Unexpected Next.js audit nodes");

  const sharpAdvisoryUrls = sharpVulnerability.via.map((advisory) =>
    typeof advisory === "string" ? advisory : advisory.url
  );

  if (
    sharpVulnerability.severity !== "high" ||
    sharpVulnerability.isDirect !== false ||
    sharpVulnerability.range !== "<0.35.0"
  ) {
    fail("Sharp advisory shape changed; review required.");
  }

  expectOnly(sharpAdvisoryUrls, [ALLOWED_ADVISORY_URL], "Unexpected Sharp advisories");
  expectOnly(sharpVulnerability.nodes, ["node_modules/sharp"], "Unexpected Sharp audit nodes");

  const lockedNext = lock?.packages?.["node_modules/next"];
  const lockedSharp = lock?.packages?.["node_modules/sharp"];

  if (!lockedNext || compareVersions(lockedNext.version, MINIMUM_SAFE_NEXT_VERSION) < 0) {
    fail("Next.js must remain at 16.2.11 or newer.");
  }

  if (lockedNext.optionalDependencies?.sharp !== "^0.34.5") {
    fail("Next.js Sharp dependency range changed; remove or reassess the exception.");
  }

  if (lockedSharp?.version !== "0.34.5" || lockedSharp.optional !== true) {
    fail("Sharp lockfile state changed; review required.");
  }

  if (!/images:\s*\{[\s\S]*?unoptimized:\s*true/.test(nextConfig)) {
    fail("Next image optimization must remain disabled while Sharp is excepted.");
  }

  return "Dependency audit passed with time-limited GHSA-f88m-g3jw-g9cj exception; Next image optimizer is disabled.";
}

export function runDependencyAudit() {
  const audit =
    process.platform === "win32"
      ? spawnSync(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", "npm audit --json"], {
          cwd: process.cwd(),
          encoding: "utf8",
          maxBuffer: 5 * 1024 * 1024,
        })
      : spawnSync("npm", ["audit", "--json"], {
          cwd: process.cwd(),
          encoding: "utf8",
          maxBuffer: 5 * 1024 * 1024,
        });

  if (audit.error) {
    fail(`Unable to run npm audit: ${audit.error.message}`);
  }

  if (!audit.stdout?.trim()) {
    fail("npm audit returned no JSON output.");
  }

  const report = JSON.parse(audit.stdout);
  const lock = JSON.parse(readFileSync(resolve(process.cwd(), "package-lock.json"), "utf8"));
  const nextConfig = readFileSync(resolve(process.cwd(), "next.config.ts"), "utf8");

  return evaluateDependencyAudit({ lock, nextConfig, report });
}

const invokedPath = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : "";

if (import.meta.url === invokedPath) {
  try {
    console.log(runDependencyAudit());
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Dependency audit failed.");
    process.exitCode = 1;
  }
}