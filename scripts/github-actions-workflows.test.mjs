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

function readAction(name) {
  return readFileSync(resolve(process.cwd(), ".github", "actions", name, "action.yml"), "utf8");
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
    expect(workflow).toContain("node scripts/check-dependency-audit.mjs");
    expect(workflow).toContain("MIGRATION_INTEGRITY_RESULT");
    expect(workflow).toContain("SECRET_SCAN_RESULT");
    expect(workflow).toContain("RESEND_WEBHOOK_SECRET: whsec_ci_placeholder");
    expect(workflow).toContain(
      "RETENTION_MANIFEST_SIGNING_SECRET: ci-placeholder-retention-manifest-signing-secret"
    );
  });

  it("uses a verified local Gitleaks installer on self-hosted runners", () => {
    const workflow = readWorkflow("quality-gate.yml");
    const action = readAction("setup-gitleaks");

    expect(workflow).toContain("uses: ./.github/actions/setup-gitleaks");
    expect(workflow).toContain(
      'run: gitleaks git --redact=100 --verbose --log-opts="--all" .'
    );
    expect(workflow).not.toContain("gitleaks/gitleaks-action@");

    expect(action).toContain(
      "9991e0b2903da4c8f6122b5c3186448b927a5da4deef1fe45271c3793f4ee29c"
    );
    expect(action).toContain('archive_dir="$HOME/.cache/jnuits-gitleaks"');
    expect(action).toContain('downloaded_digest="$(archive_digest "$archive.part")"');
    expect(action).toContain('rm -rf -- "$install_dir"');
    expect(action).not.toContain("/tmp/gitleaks");
  });

  it("runs the repository-wide migration dependency scan in strict mode", () => {
    // Promoted on 2026-07-27, after a Linux run reported zero findings across
    // all 95 migrations. Report-only mode exits zero on a finding, so leaving
    // it in place would make the job decorative.
    const workflow = readWorkflow("quality-gate.yml");

    expect(workflow).toContain("migration_dependencies:");
    expect(workflow).toContain("run: npm run migration:check-order:strict");
    expect(workflow).not.toMatch(/run: npm run migration:check-order$/m);
  });

  it("requires the migration dependency scan in the aggregate gate", () => {
    const workflow = readWorkflow("quality-gate.yml");
    const aggregateStart = workflow.indexOf("application_quality:");
    const aggregateEnd = workflow.indexOf("\n  secret_scan:", aggregateStart);

    expect(aggregateStart).toBeGreaterThan(-1);
    expect(aggregateEnd).toBeGreaterThan(aggregateStart);

    const aggregate = workflow.slice(aggregateStart, aggregateEnd);

    // In the needs list.
    expect(aggregate).toContain("migration_dependencies,");
    // Result exposed to the step.
    expect(aggregate).toContain(
      "MIGRATION_DEPENDENCIES_RESULT: ${{ needs.migration_dependencies.result }}"
    );
    // Printed alongside the other shards, so a no-log failure stays diagnosable.
    expect(aggregate).toContain('echo "migration_dependencies=$MIGRATION_DEPENDENCIES_RESULT"');
    // And actually asserted, not merely echoed.
    expect(aggregate).toContain('test "$MIGRATION_DEPENDENCIES_RESULT" = "success"');
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
