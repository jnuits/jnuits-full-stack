import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const SHARP_EXCEPTION_EXPIRES_AT = Date.parse("2026-09-01T00:00:00Z");

/**
 * Development-only linter toolchain advisories are tolerated until the same
 * date as the Sharp exception, so a single upgrade window closes both.
 */
export const DEV_TOOLCHAIN_EXCEPTION_EXPIRES_AT = Date.parse("2026-09-01T00:00:00Z");

const ALLOWED_ADVISORY_URL =
  "https://github.com/advisories/GHSA-f88m-g3jw-g9cj";

/**
 * GHSA-mh99-v99m-4gvg / CVE-2026-14257: brace-expansion <= 5.0.7 denial of
 * service via memory exhaustion.
 *
 * Historical exception: the 1.x linter copy originally had no patched release.
 * The 2026-10 CI repair updates it to 1.1.21 and the 5.x copies to 5.0.12.
 * The expired exception below remains fail-closed and is not renewed.
 *
 *   - minimatch 3 calls the dependency as `expand(...)`, while 5.x exports
 *     `{ expand }`, so forcing 5.x breaks ESLint outright.
 *   - Upgrading ESLint core does not help: eslint-plugin-import,
 *     eslint-plugin-jsx-a11y and eslint-plugin-react each pin minimatch ^3.1.2
 *     independently, and cap their eslint peer range at ^9.
 *
 * Reachability: the only input to expand() here is the project's own glob
 * patterns from its own ESLint config, evaluated on developer machines and in
 * CI. No runtime request path reaches this code.
 */
const DEV_TOOLCHAIN_ADVISORY_URL =
  "https://github.com/advisories/GHSA-mh99-v99m-4gvg";

const ALLOWED_DEV_TOOLCHAIN_PACKAGES = new Set([
  "@eslint/config-array",
  "@eslint/eslintrc",
  "brace-expansion",
  "eslint",
  "eslint-config-next",
  "eslint-plugin-import",
  "eslint-plugin-jsx-a11y",
  "eslint-plugin-react",
  "minimatch",
]);

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

function viaEntries(vulnerability) {
  return (vulnerability.via || []).map((advisory) => {
    if (typeof advisory === "string") return advisory;
    return advisory.url || advisory.title || "unknown-advisory";
  });
}

function describeAuditEntry([name, vulnerability]) {
  const via = viaEntries(vulnerability);

  return `${name} (${vulnerability.severity}; range ${vulnerability.range}; via ${
    via.join(", ") || "none"
  }; nodes ${(vulnerability.nodes || []).join(", ") || "none"})`;
}

function reportableEntries(report) {
  return Object.entries(report?.vulnerabilities || {}).filter(
    ([, vulnerability]) => REPORTABLE_SEVERITIES.has(vulnerability.severity)
  );
}

/**
 * Production dependencies get no tolerance beyond the documented Sharp
 * exception. Anything else reaching the runtime tree fails the build.
 */
function evaluateProductionAudit({ lock, nextConfig, now, report }) {
  if (report?.error) {
    fail(`npm audit failed: ${report.error.summary || "unknown audit error"}`);
  }

  const reportable = reportableEntries(report);

  if (reportable.length === 0) {
    return "Dependency audit passed: no moderate, high, or critical production vulnerabilities.";
  }

  const reportableNames = reportable.map(([name]) => name);
  const expectedNames = ["next", "sharp"];
  if (
    JSON.stringify([...reportableNames].sort()) !==
    JSON.stringify([...expectedNames].sort())
  ) {
    fail(
      `Unexpected production dependency vulnerabilities: ${reportable
        .map(describeAuditEntry)
        .join("; ")}.`
    );
  }

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

  const sharpAdvisoryUrls = viaEntries(sharpVulnerability);

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

/**
 * Advisories that appear only once devDependencies are included. Each must be a
 * known linter-toolchain package, high severity, and traceable to the
 * brace-expansion/minimatch chain. A different advisory in the same packages,
 * or a critical escalation, still fails the gate.
 */
function evaluateDevelopmentAudit({ devReport, now, productionNames }) {
  if (devReport?.error) {
    fail(`npm audit failed: ${devReport.error.summary || "unknown audit error"}`);
  }

  const devOnly = reportableEntries(devReport).filter(
    ([name]) => !productionNames.has(name)
  );

  if (devOnly.length === 0) {
    return "No development-only advisories.";
  }

  const unexpected = devOnly.filter(
    ([name]) => !ALLOWED_DEV_TOOLCHAIN_PACKAGES.has(name)
  );

  if (unexpected.length > 0) {
    fail(
      `Unexpected development dependency vulnerabilities: ${unexpected
        .map(describeAuditEntry)
        .join("; ")}.`
    );
  }

  if (now >= DEV_TOOLCHAIN_EXCEPTION_EXPIRES_AT) {
    fail(
      "Development linter toolchain exception expired. Complete the ESLint upgrade and remove the exception."
    );
  }

  for (const [name, vulnerability] of devOnly) {
    if (vulnerability.severity !== "high") {
      fail(
        `Development advisory severity changed for ${name}: expected high; received ${vulnerability.severity}.`
      );
    }

    const chain = viaEntries(vulnerability);
    const foreign = chain.filter(
      (entry) =>
        entry !== DEV_TOOLCHAIN_ADVISORY_URL &&
        !ALLOWED_DEV_TOOLCHAIN_PACKAGES.has(entry)
    );

    if (foreign.length > 0) {
      fail(
        `Development advisory chain changed for ${name}: unexpected ${foreign.join(", ")}.`
      );
    }
  }

  return `${devOnly.length} development-only linter advisories accepted under the time-limited GHSA-mh99-v99m-4gvg exception; no production dependency is affected.`;
}

export function evaluateDependencyAudit({
  devReport,
  lock,
  nextConfig,
  now = Date.now(),
  report,
}) {
  const productionSummary = evaluateProductionAudit({ lock, nextConfig, now, report });

  if (!devReport) {
    return productionSummary;
  }

  const productionNames = new Set(reportableEntries(report).map(([name]) => name));
  const developmentSummary = evaluateDevelopmentAudit({
    devReport,
    now,
    productionNames,
  });

  return `${productionSummary}\n${developmentSummary}`;
}

function runNpmAudit(extraArgs = []) {
  const command = ["npm", "audit", "--json", ...extraArgs];
  const audit =
    process.platform === "win32"
      ? spawnSync(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", command.join(" ")], {
          cwd: process.cwd(),
          encoding: "utf8",
          maxBuffer: 5 * 1024 * 1024,
        })
      : spawnSync(command[0], command.slice(1), {
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

  return JSON.parse(audit.stdout);
}

export function runDependencyAudit() {
  const report = runNpmAudit(["--omit=dev"]);
  const devReport = runNpmAudit();
  const lock = JSON.parse(readFileSync(resolve(process.cwd(), "package-lock.json"), "utf8"));
  const nextConfig = readFileSync(resolve(process.cwd(), "next.config.ts"), "utf8");

  return evaluateDependencyAudit({ devReport, lock, nextConfig, report });
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
