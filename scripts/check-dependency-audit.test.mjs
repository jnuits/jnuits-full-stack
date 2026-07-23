import { describe, expect, it } from "vitest";

import {
  evaluateDependencyAudit,
  SHARP_EXCEPTION_EXPIRES_AT,
} from "./check-dependency-audit.mjs";

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

describe("dependency audit gate", () => {
  it("accepts only the exact mitigated Sharp advisory before expiry", () => {
    expect(
      evaluateDependencyAudit({
        lock: allowedLock,
        nextConfig: mitigatedConfig,
        now: Date.parse("2026-07-23T00:00:00Z"),
        report: allowedReport,
      })
    ).toContain("time-limited GHSA-f88m-g3jw-g9cj exception");
  });

  it("rejects every additional reportable vulnerability", () => {
    const report = structuredClone(allowedReport);
    report.vulnerabilities.example = {
      isDirect: true,
      nodes: ["node_modules/example"],
      range: "<2.0.0",
      severity: "moderate",
      via: [],
    };

    expect(() =>
      evaluateDependencyAudit({
        lock: allowedLock,
        nextConfig: mitigatedConfig,
        now: Date.parse("2026-07-23T00:00:00Z"),
        report,
      })
    ).toThrow("Unexpected dependency vulnerabilities");
  });

  it("rejects the exception after its deadline", () => {
    expect(() =>
      evaluateDependencyAudit({
        lock: allowedLock,
        nextConfig: mitigatedConfig,
        now: SHARP_EXCEPTION_EXPIRES_AT,
        report: allowedReport,
      })
    ).toThrow("Sharp security exception expired");
  });

  it("rejects re-enabled Next image optimization", () => {
    expect(() =>
      evaluateDependencyAudit({
        lock: allowedLock,
        nextConfig: "const nextConfig = { images: { unoptimized: false } };",
        now: Date.parse("2026-07-23T00:00:00Z"),
        report: allowedReport,
      })
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
    ).toContain("no moderate, high, or critical vulnerabilities");
  });
});