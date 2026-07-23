import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const workflowNames = [
  "e2e-matrix.yml",
  "preproduction-verify.yml",
  "production-readiness.yml",
  "quality-gate.yml",
];

function readWorkflow(name) {
  return readFileSync(resolve(process.cwd(), ".github", "workflows", name), "utf8");
}

describe("GitHub Actions workflows", () => {
  it("pins every external action to an immutable commit SHA", () => {
    for (const name of workflowNames) {
      const workflow = readWorkflow(name);
      const uses = [...workflow.matchAll(/^\s*uses:\s+([^\s@]+)@([^\s#]+)/gm)];

      expect(uses.length, `${name} should contain external actions`).toBeGreaterThan(0);
      for (const [, action, ref] of uses) {
        expect(ref, `${name}: ${action} must use a 40-character SHA`).toMatch(/^[0-9a-f]{40}$/);
      }
    }
  });

  it("makes migration and secret scanning part of the required quality result", () => {
    const workflow = readWorkflow("quality-gate.yml");

    expect(workflow).toContain("migration_integrity:");
    expect(workflow).toContain("secret_scan:");
    expect(workflow).toContain("name: Required CI");
    expect(workflow).toContain("pull-requests: read");
    expect(workflow).toContain("MIGRATION_INTEGRITY_RESULT");
    expect(workflow).toContain("SECRET_SCAN_RESULT");
    expect(workflow).toContain("RESEND_WEBHOOK_SECRET: whsec_ci_placeholder");
    expect(workflow).toContain(
      "RETENTION_MANIFEST_SIGNING_SECRET: ci-placeholder-retention-manifest-signing-secret"
    );
  });

  it("validates Google Drive and retention settings in production readiness", () => {
    const workflow = readWorkflow("production-readiness.yml");

    expect(workflow).toContain("GOOGLE_DRIVE_EXPORTS_FOLDER_ID");
    expect(workflow).toContain("GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL");
    expect(workflow).toContain("GOOGLE_DRIVE_SERVICE_ACCOUNT_PRIVATE_KEY");
    expect(workflow).toContain("GOOGLE_DRIVE_SHARED_DRIVE_ID");
    expect(workflow).toContain("RETENTION_MANIFEST_SIGNING_SECRET");
  });
});
