import { describe, expect, it } from "vitest";

import {
  DEV_TOOLCHAIN_EXCEPTION_EXPIRES_AT,
  evaluateDependencyAudit,
  SHARP_EXCEPTION_EXPIRES_AT,
} from "./check-dependency-audit.mjs";

const BEFORE_EXPIRY = Date.parse("2026-07-23T00:00:00Z");
const DEV_ADVISORY_URL = "https://github.com/advisories/GHSA-mh99-v99m-4gvg";

const allowedReport = {
  vulnerabilities: {
    next: {
      isDirect: true,
      nodes: ["node_modules/next"],
      range: "9.5.6-canary.0 - 10.0.7 || 14.3.0-canary.0 - 16.3.0-preview.7",
      severity: "high",
      via: ["sharp"],
    },
    sharp: {
      isDirect: false,
      nodes: ["node_modules/sharp"],
      range: "<0.35.0",
      severity: "high",
      via: [
        {
          url: "https://github.com/advisories/GHSA-f88m-g3jw-g9cj",
        },
      ],
    },
  },
};

/**
 * Mirrors the real `npm audit --json` output: the development report is a
 * superset of the production one.
 */
const allowedDevReport = {
  vulnerabilities: {
    ...structuredClone(allowedReport.vulnerabilities),
    "@eslint/config-array": {
      isDirect: false,
      nodes: ["node_modules/@eslint/config-array"],
      range: "<=0.22.0",
      severity: "high",
      via: ["minimatch"],
    },
    "brace-expansion": {
      isDirect: false,
      nodes: ["node_modules/brace-expansion"],
      range: "<=5.0.7",
      severity: "high",
      via: [{ url: DEV_ADVISORY_URL }],
    },
    eslint: {
      isDirect: true,
      nodes: ["node_modules/eslint"],
      range: "0.12.0 - 2.0.0-rc.1 || 4.1.0 - 10.0.0-rc.2",
      severity: "high",
      via: ["@eslint/config-array", "@eslint/eslintrc", "minimatch"],
    },
    minimatch: {
      isDirect: false,
      nodes: ["node_modules/minimatch"],
      range: "2.0.0 - 10.0.2",
      severity: "high",
      via: ["brace-expansion"],
    },
  },
};

const allowedLock = {
  packages: {
    "node_modules/next": {
      optionalDependencies: { sharp: "^0.34.5" },
      version: "16.2.11",
    },
    "node_modules/sharp": {
      optional: true,
      version: "0.34.5",
    },
  },
};

const mitigatedConfig = "const nextConfig = { images: { unoptimized: true } };";

function evaluate(overrides = {}) {
  return evaluateDependencyAudit({
    lock: allowedLock,
    nextConfig: mitigatedConfig,
    now: BEFORE_EXPIRY,
    report: allowedReport,
    ...overrides,
  });
}

describe("dependency audit gate", () => {
  it("accepts only the exact mitigated Sharp advisory before expiry", () => {
    expect(evaluate()).toContain("time-limited GHSA-f88m-g3jw-g9cj exception");
  });

  it("rejects every additional reportable production vulnerability with actionable details", () => {
    const report = structuredClone(allowedReport);
    report.vulnerabilities.example = {
      isDirect: true,
      nodes: ["node_modules/example"],
      range: "<2.0.0",
      severity: "moderate",
      via: [
        {
          url: "https://github.com/advisories/GHSA-example",
        },
      ],
    };

    expect(() => evaluate({ report })).toThrow(
      "example (moderate; range <2.0.0; via https://github.com/advisories/GHSA-example; nodes node_modules/example)"
    );
  });

  it("rejects the exception after its deadline", () => {
    expect(() => evaluate({ now: SHARP_EXCEPTION_EXPIRES_AT })).toThrow(
      "Sharp security exception expired"
    );
  });

  it("rejects re-enabled Next image optimization", () => {
    expect(() =>
      evaluate({ nextConfig: "const nextConfig = { images: { unoptimized: false } };" })
    ).toThrow("Next image optimization must remain disabled");
  });

  it("passes a clean audit without an exception", () => {
    expect(
      evaluateDependencyAudit({
        lock: {},
        nextConfig: "",
        now: SHARP_EXCEPTION_EXPIRES_AT,
        report: { vulnerabilities: {} },
      })
    ).toContain("no moderate, high, or critical production vulnerabilities");
  });

  it("accepts the known development-only linter advisories before expiry", () => {
    const summary = evaluate({ devReport: allowedDevReport });

    expect(summary).toContain("time-limited GHSA-f88m-g3jw-g9cj exception");
    expect(summary).toContain("development-only linter advisories accepted");
    expect(summary).toContain("no production dependency is affected");
  });

  it("rejects a development advisory in a package outside the linter toolchain", () => {
    const devReport = structuredClone(allowedDevReport);
    devReport.vulnerabilities["unrelated-tool"] = {
      isDirect: false,
      nodes: ["node_modules/unrelated-tool"],
      range: "<1.2.3",
      severity: "high",
      via: [{ url: "https://github.com/advisories/GHSA-unrelated" }],
    };

    expect(() => evaluate({ devReport })).toThrow(
      "unrelated-tool (high; range <1.2.3; via https://github.com/advisories/GHSA-unrelated; nodes node_modules/unrelated-tool)"
    );
  });

  it("rejects a different advisory inside an allowed linter package", () => {
    const devReport = structuredClone(allowedDevReport);
    devReport.vulnerabilities["brace-expansion"].via = [
      { url: "https://github.com/advisories/GHSA-some-other-issue" },
    ];

    expect(() => evaluate({ devReport })).toThrow(
      "Development advisory chain changed for brace-expansion"
    );
  });

  it("rejects a critical escalation inside an allowed linter package", () => {
    const devReport = structuredClone(allowedDevReport);
    devReport.vulnerabilities.minimatch.severity = "critical";

    expect(() => evaluate({ devReport })).toThrow(
      "Development advisory severity changed for minimatch: expected high; received critical."
    );
  });

  it("accepts the development exception right up to its deadline and rejects it after", () => {
    expect(() =>
      evaluate({
        devReport: allowedDevReport,
        now: DEV_TOOLCHAIN_EXCEPTION_EXPIRES_AT - 1,
      })
    ).not.toThrow();

    expect(() =>
      evaluate({ devReport: allowedDevReport, now: DEV_TOOLCHAIN_EXCEPTION_EXPIRES_AT })
    ).toThrow("expired");
  });

  it("still reports a production advisory even when development noise is present", () => {
    const report = structuredClone(allowedReport);
    report.vulnerabilities["runtime-package"] = {
      isDirect: true,
      nodes: ["node_modules/runtime-package"],
      range: "<3.0.0",
      severity: "high",
      via: [{ url: "https://github.com/advisories/GHSA-runtime" }],
    };

    expect(() => evaluate({ devReport: allowedDevReport, report })).toThrow(
      "Unexpected production dependency vulnerabilities"
    );
  });
});
