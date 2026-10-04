import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import { checkMigrationIntegrity } from "./check-migration-integrity.mjs";

const roots = [];
const oldPath = "supabase/migrations/20260101000000_initial.sql";
const oldSql = "select 1;\n";
function fixture() {
  const cwd = mkdtempSync(join(tmpdir(), "jnuits-migration-integrity-"));
  roots.push(cwd);
  const git = (...args) => execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
  git("init", "-q"); git("config", "user.name", "Migration fixture");
  git("config", "user.email", "fixture@example.test"); git("config", "core.autocrlf", "false");
  mkdirSync(join(cwd, "supabase/migrations"), { recursive: true });
  writeFileSync(join(cwd, oldPath), oldSql);
  git("add", "."); git("commit", "-qm", "Fixture baseline");
  const anchor = git("rev-parse", "HEAD");
  const manifest = { version: 1, anchorCommit: anchor, migrations: [{
    path: oldPath, blob: git("rev-parse", anchor + ":" + oldPath),
    sha256: createHash("sha256").update(oldSql).digest("hex"),
  }] };
  writeFileSync(join(cwd, "supabase/migration-integrity.json"), JSON.stringify(manifest));
  git("add", "."); git("commit", "-qm", "Seal fixture manifest");
  return { cwd, git, anchor, manifest };
}
afterEach(() => {
  for (const cwd of roots.splice(0)) {
    const within = relative(resolve(tmpdir()), resolve(cwd));
    if (within.startsWith("..") || !within.startsWith("jnuits-migration-integrity-")) throw new Error("Unexpected cleanup target");
    rmSync(cwd, { recursive: true, force: true });
  }
});
describe("immutable migration SQL", { timeout: 30000 }, () => {
  it("accepts unchanged sealed history and appended forward SQL", () => {
    const f = fixture();
    writeFileSync(join(f.cwd, "supabase/migrations/20260102000000_next.sql"), "select 2;");
    expect(checkMigrationIntegrity({ ...f, baseRef: f.anchor })).toEqual([]);
  });
  it("detects one-byte edits under an existing version", () => {
    const f = fixture(); writeFileSync(join(f.cwd, oldPath), "select 2;\n");
    expect(checkMigrationIntegrity({ ...f, baseRef: f.anchor }).join(" ")).toContain(oldPath);
  });
  it("rejects a committed SQL edit concealed by restoring the working file", () => {
    const f=fixture();
    writeFileSync(join(f.cwd,oldPath),"select 2;\n");f.git("add",".");f.git("commit","-qm","Concealed historical rewrite");
    writeFileSync(join(f.cwd,oldPath),oldSql);
    expect(checkMigrationIntegrity({...f,baseRef:f.anchor}).join(" ")).toContain(oldPath);
  });
  it("does not trust EOL filters that make modified working bytes hash identically", () => {
    const f=fixture();
    writeFileSync(join(f.cwd,".gitattributes"),"supabase/migrations/*.sql text\n");
    writeFileSync(join(f.cwd,oldPath),"select 1;\r\n");
    expect(checkMigrationIntegrity({...f,baseRef:f.anchor}).join(" ")).toContain(oldPath);
  });
  it("ignores an active clean filter returning approved bytes for changed SQL", () => {
    const f=fixture();
    writeFileSync(join(f.cwd,"fixture-clean.cjs"),"process.stdout.write("+JSON.stringify(oldSql)+");");
    writeFileSync(join(f.cwd,".gitattributes"),"supabase/migrations/*.sql filter=mask\n");
    f.git("config","filter.mask.clean","node fixture-clean.cjs");
    writeFileSync(join(f.cwd,oldPath),"select 2;\n");
    expect(f.git("hash-object","--path="+oldPath,"--",oldPath)).toBe(f.manifest.migrations[0].blob);
    expect(checkMigrationIntegrity({...f,baseRef:f.anchor}).join(" ")).toContain(oldPath);
  });
  it("rejects a committed manifest rewrite concealed by working-tree restoration", () => {
    const f=fixture();
    writeFileSync(join(f.cwd,"supabase/migration-integrity.json"),JSON.stringify({...f.manifest,version:2}));
    f.git("add",".");f.git("commit","-qm","Concealed manifest rewrite");
    writeFileSync(join(f.cwd,"supabase/migration-integrity.json"),JSON.stringify(f.manifest));
    expect(checkMigrationIntegrity({...f,baseRef:f.anchor}).join(" ")).toContain("sealed manifest");
  });
  it("rejects deletion", () => {
    const f = fixture(); rmSync(join(f.cwd, oldPath));
    expect(checkMigrationIntegrity({ ...f, baseRef: f.anchor }).join(" ")).toContain(oldPath);
  });
  it("rejects changing the manifest together with historical SQL", () => {
    const f = fixture(); writeFileSync(join(f.cwd, oldPath), "select 2;\n");
    f.manifest.migrations[0].sha256 = createHash("sha256").update("select 2;\n").digest("hex");
    writeFileSync(join(f.cwd, "supabase/migration-integrity.json"), JSON.stringify(f.manifest));
    expect(checkMigrationIntegrity({ ...f, baseRef: f.anchor }).join(" ")).toContain("sealed manifest");
  });
  it("protects migrations merged after the original sealed baseline", () => {
    const f = fixture(); const next = "supabase/migrations/20260102000000_next.sql";
    writeFileSync(join(f.cwd, next), "select 2;"); f.git("add", "."); f.git("commit", "-qm", "Applied forward");
    const baseRef = f.git("rev-parse", "HEAD");
    writeFileSync(join(f.cwd, next), "select 3;");
    expect(checkMigrationIntegrity({ ...f, baseRef }).join(" ")).toContain(next);
  });
  it("does not accept a reconciliation receipt introduced by the current change", () => {
    const f = fixture(); const next = "supabase/migrations/20260102000000_initial.sql";
    rmSync(join(f.cwd, oldPath)); writeFileSync(join(f.cwd, next), oldSql);
    writeFileSync(join(f.cwd, "supabase/migration-reconciliation-receipts.json"), JSON.stringify([{
      oldPath, newPath: next, projectId: "fsirdkjgrcocowxqjhjg", hostedVersion: "20260102000000",
      sha256: f.manifest.migrations[0].sha256, verifiedAt: "2026-10-04T00:00:00Z",
    }]));
    expect(checkMigrationIntegrity({ ...f, baseRef: f.anchor }).length).toBeGreaterThan(0);
  });
});
