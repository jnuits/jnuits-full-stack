import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  assertNoCredentials,
  buildManifest,
  hashMigrationBytes,
  parseMigrationFilename,
  verifyManifest,
  writeManifest,
} from "./lib/migration-manifest.cjs";

const scratchDirs = [];

function createRepo(files = {}) {
  const root = mkdtempSync(join(tmpdir(), "jnuits-manifest-"));
  scratchDirs.push(root);
  mkdirSync(join(root, "supabase", "migrations"), { recursive: true });

  for (const [filename, contents] of Object.entries(files)) {
    writeFileSync(join(root, "supabase", "migrations", filename), contents, "utf8");
  }

  return root;
}

function writeMigration(root, filename, contents) {
  writeFileSync(join(root, "supabase", "migrations", filename), contents, "utf8");
}

afterEach(() => {
  while (scratchDirs.length > 0) {
    rmSync(scratchDirs.pop(), { force: true, recursive: true });
  }
});

describe("applied migration manifest", () => {
  it("reports a missing manifest as its own failure state rather than passing", () => {
    const root = createRepo({ "20260101000000_initial.sql": "select 1;\n" });

    const result = verifyManifest(root);

    expect(result.exitCode).toBe(3);
    expect(result.missingManifest).toBe(true);
  });

  it("verifies a freshly generated manifest", () => {
    const root = createRepo({
      "20260101000000_initial.sql": "select 1;\n",
      "20260102000000_second.sql": "select 2;\n",
    });

    writeManifest(root);
    const result = verifyManifest(root);

    expect(result.exitCode).toBe(0);
    expect(result.verifiedCount).toBe(2);
    expect(result.modified).toEqual([]);
  });

  it("fails when an applied migration's SQL is modified", () => {
    const root = createRepo({ "20260101000000_initial.sql": "select 1;\n" });
    writeManifest(root);

    writeMigration(root, "20260101000000_initial.sql", "select 1; drop table members;\n");
    const result = verifyManifest(root);

    expect(result.exitCode).toBe(2);
    expect(result.modified).toHaveLength(1);
    expect(result.modified[0].logicalName).toBe("initial");
    expect(result.modified[0].expectedSha256).not.toBe(result.modified[0].actualSha256);
  });

  it("fails on a newline-only rewrite, so EOL changes cannot mask an edit", () => {
    const root = createRepo({ "20260101000000_initial.sql": "select 1;\nselect 2;\n" });
    writeManifest(root);

    writeMigration(root, "20260101000000_initial.sql", "select 1;\r\nselect 2;\r\n");
    const result = verifyManifest(root);

    expect(result.exitCode).toBe(2);
    expect(result.modified).toHaveLength(1);
  });

  it("fails an unregistered migration, then passes once it is approved and written", () => {
    const root = createRepo({ "20260101000000_initial.sql": "select 1;\n" });
    writeManifest(root);

    writeMigration(root, "20260201000000_forward_fix.sql", "select 3;\n");
    const beforeApproval = verifyManifest(root);

    expect(beforeApproval.exitCode).toBe(2);
    expect(beforeApproval.unregistered).toEqual(["20260201000000_forward_fix.sql"]);

    writeManifest(root);
    const afterApproval = verifyManifest(root);

    expect(afterApproval.exitCode).toBe(0);
    expect(afterApproval.verifiedCount).toBe(2);
  });

  it("fails when a recorded migration disappears from disk", () => {
    const root = createRepo({
      "20260101000000_initial.sql": "select 1;\n",
      "20260102000000_second.sql": "select 2;\n",
    });
    writeManifest(root);

    rmSync(join(root, "supabase", "migrations", "20260102000000_second.sql"));
    const result = verifyManifest(root);

    expect(result.exitCode).toBe(2);
    expect(result.missingFromDisk).toEqual(["20260102000000_second.sql"]);
  });

  it("treats a retimestamped file with identical bytes as legacy reconciliation, not modification", () => {
    const root = createRepo({ "20260525093000_harden_member_invitation_claims.sql": "select 1;\n" });
    writeManifest(root);

    rmSync(join(root, "supabase", "migrations", "20260525093000_harden_member_invitation_claims.sql"));
    writeMigration(root, "20260525033833_harden_member_invitation_claims.sql", "select 1;\n");
    const result = verifyManifest(root);

    expect(result.exitCode).toBe(0);
    expect(result.modified).toEqual([]);
    expect(result.renamed).toEqual([
      {
        from: "20260525093000_harden_member_invitation_claims.sql",
        logicalName: "harden_member_invitation_claims",
        to: "20260525033833_harden_member_invitation_claims.sql",
      },
    ]);
  });

  it("rejects a malformed migration filename when building", () => {
    const root = createRepo({ "not-a-migration.sql": "select 1;\n" });

    expect(() => buildManifest(root)).toThrow(/must match/i);
  });
});

describe("manifest identity and hashing", () => {
  it("separates logical name from the local version", () => {
    expect(parseMigrationFilename("20260724140000_form_publication_and_upload_session_hardening.sql")).toEqual({
      logicalName: "form_publication_and_upload_session_hardening",
      version: "20260724140000",
    });
  });

  it("never claims the remote applied version equals the local version", () => {
    const root = createRepo({
      "20260724140000_form_publication_and_upload_session_hardening.sql": "select 1;\n",
    });
    mkdirSync(join(root, "supabase"), { recursive: true });
    writeFileSync(
      join(root, "supabase", "migration-remote-evidence.json"),
      JSON.stringify({
        evidence: {
          form_publication_and_upload_session_hardening: {
            remoteVersion: "20260726105745",
            state: "applied",
          },
        },
      }),
      "utf8"
    );

    const { manifest } = buildManifest(root);
    const entry = manifest.migrations[0];

    expect(entry.localVersion).toBe("20260724140000");
    expect(entry.remoteAppliedVersion).toBe("20260726105745");
    expect(entry.state).toBe("applied");
    expect(entry.localVersion).not.toBe(entry.remoteAppliedVersion);
  });

  it("records null remote evidence rather than inventing a version", () => {
    const root = createRepo({ "20260101000000_unapplied.sql": "select 1;\n" });

    const { manifest } = buildManifest(root);

    expect(manifest.migrations[0].remoteAppliedVersion).toBeNull();
    expect(manifest.migrations[0].state).toBe("recorded");
  });

  it("produces identical lowercase hex digests for identical bytes in different locations", () => {
    const first = createRepo({ "20260101000000_same.sql": "select 1;\n" });
    const second = createRepo({ "20260101000000_same.sql": "select 1;\n" });

    const firstDigest = buildManifest(first).manifest.migrations[0].sha256;
    const secondDigest = buildManifest(second).manifest.migrations[0].sha256;

    expect(firstDigest).toBe(secondDigest);
    expect(firstDigest).toMatch(/^[0-9a-f]{64}$/);
  });

  it("hashes bytes, so CRLF and LF content differ", () => {
    expect(hashMigrationBytes(Buffer.from("a\nb"))).not.toBe(
      hashMigrationBytes(Buffer.from("a\r\nb"))
    );
  });

  it("generates a manifest containing no credentials or database endpoints", () => {
    const root = createRepo({ "20260101000000_initial.sql": "select 1;\n" });
    writeManifest(root);

    const serialized = readFileSync(join(root, "supabase", "migration-manifest.json"), "utf8");

    expect(() => assertNoCredentials(serialized)).not.toThrow();
    expect(serialized).not.toMatch(/postgres(?:ql)?:\/\//i);
    expect(serialized).not.toMatch(/\.supabase\.co/i);
  });

  it("refuses a manifest that carries a connection string or secret key", () => {
    expect(() => assertNoCredentials('{"url":"postgresql://user:pw@host/db"}')).toThrow();
    expect(() => assertNoCredentials('{"key":"sb_secret_abc123"}')).toThrow();
    expect(() => assertNoCredentials('{"role":"service_role"}')).toThrow();
  });
});
