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

function listLatestFiles(directoryPath, top = 5) {
  if (!fs.existsSync(directoryPath)) {
    return [];
  }

  return fs
    .readdirSync(directoryPath)
    .map((name) => path.join(directoryPath, name))
    .filter((filePath) => fs.statSync(filePath).isFile())
    .sort((left, right) => fs.statSync(right).mtimeMs - fs.statSync(left).mtimeMs)
    .slice(0, top)
    .map((filePath) => ({
      file: path.relative(process.cwd(), filePath).replace(/\\/g, "/"),
      modifiedAt: fs.statSync(filePath).mtime.toISOString(),
      size: fs.statSync(filePath).size,
    }));
}

function listScreenshots() {
  const root = path.join(process.cwd(), "artifacts");
  if (!fs.existsSync(root)) {
    return [];
  }

  return fs
    .readdirSync(root)
    .filter((name) => name.toLowerCase().endsWith(".png"))
    .map((name) => path.join(root, name))
    .sort((left, right) => fs.statSync(right).mtimeMs - fs.statSync(left).mtimeMs)
    .map((filePath) => ({
      file: path.relative(process.cwd(), filePath).replace(/\\/g, "/"),
      modifiedAt: fs.statSync(filePath).mtime.toISOString(),
      size: fs.statSync(filePath).size,
    }));
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const reportPath = resolveReportPath(
    "rehearsal",
    "cutover-evidence-pack",
    options.report
  );

  const reportsRoot = path.join(process.cwd(), "artifacts", "reports");
  const evidence = {
    generatedAt: new Date().toISOString(),
    sections: {
      certificates: listLatestFiles(path.join(reportsRoot, "certificates"), 6),
      committee: listLatestFiles(path.join(reportsRoot, "committee"), 6),
      content: listLatestFiles(path.join(reportsRoot, "content"), 6),
      membership: listLatestFiles(path.join(reportsRoot, "membership"), 10),
      rehearsal: listLatestFiles(path.join(reportsRoot, "rehearsal"), 10),
      screenshots: listScreenshots(),
    },
    checklist: {
      certificatesEvidencePresent:
        listLatestFiles(path.join(reportsRoot, "certificates"), 1).length > 0,
      membershipEvidencePresent:
        listLatestFiles(path.join(reportsRoot, "membership"), 1).length > 0,
      rehearsalEvidencePresent:
        listLatestFiles(path.join(reportsRoot, "rehearsal"), 1).length > 0,
      rollbackDrillDocumented:
        listLatestFiles(path.join(reportsRoot, "rehearsal"), 10).some((entry) =>
          entry.file.includes("rollback")
        ),
      screenshotEvidencePresent: listScreenshots().length > 0,
    },
  };

  writeJsonReport(reportPath, evidence);

  console.log("");
  console.log("Cutover evidence pack generated.");
  console.log(`Report: ${reportPath}`);
}

main().catch((error) => {
  console.error("Unable to build cutover evidence pack.");
  console.error(String(error));
  process.exitCode = 1;
});
