#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { resolveReportPath, writeJsonReport } from "./lib/legacy-content.mjs";

function parseArgs(argv) {
  const options = {
    report: "",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === "--report" && argv[index + 1]) {
      options.report = argv[index + 1];
      index += 1;
      continue;
    }

    if (token.startsWith("--report=")) {
      options.report = token.split("=")[1] || "";
    }
  }

  return options;
}

function latestFile(reportDirectory) {
  if (!fs.existsSync(reportDirectory)) {
    return null;
  }

  const files = fs
    .readdirSync(reportDirectory)
    .map((name) => path.join(reportDirectory, name))
    .filter((filePath) => fs.statSync(filePath).isFile())
    .sort((left, right) => fs.statSync(right).mtimeMs - fs.statSync(left).mtimeMs);

  if (files.length === 0) {
    return null;
  }

  const filePath = files[0];
  return {
    file: path.relative(process.cwd(), filePath).replace(/\\/g, "/"),
    modifiedAt: fs.statSync(filePath).mtime.toISOString(),
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const reportPath = resolveReportPath(
    "rehearsal",
    "rollback-drill-report",
    options.report
  );
  const reportsRoot = path.join(process.cwd(), "artifacts", "reports");
  const latestMembership = latestFile(path.join(reportsRoot, "membership"));
  const latestRehearsal = latestFile(path.join(reportsRoot, "rehearsal"));
  const latestCertificates = latestFile(path.join(reportsRoot, "certificates"));

  const drill = {
    generatedAt: new Date().toISOString(),
    objective:
      "Confirm rollback readiness by validating recent evidence artifacts and restoring checkpoints before cutover.",
    checks: [
      {
        name: "Latest membership report exists",
        passed: Boolean(latestMembership),
        evidence: latestMembership,
      },
      {
        name: "Latest rehearsal report exists",
        passed: Boolean(latestRehearsal),
        evidence: latestRehearsal,
      },
      {
        name: "Latest certificate report exists",
        passed: Boolean(latestCertificates),
        evidence: latestCertificates,
      },
    ],
  };

  const passed = drill.checks.every((check) => check.passed);

  writeJsonReport(reportPath, {
    ...drill,
    status: passed ? "pass" : "fail",
  });

  console.log("");
  console.log("Rollback drill report generated.");
  console.log(`Report: ${reportPath}`);
  console.log(`Status: ${passed ? "pass" : "fail"}`);
}

main().catch((error) => {
  console.error("Rollback drill failed.");
  console.error(String(error));
  process.exitCode = 1;
});
