import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const route = readFileSync(
  resolve(process.cwd(), "src/app/api/events/[eventId]/register/route.ts"),
  "utf8"
);
const sessionMigration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260723233000_form_upload_sessions.sql"),
  "utf8"
);

describe("event upload replay protection", () => {
  it("binds event uploads to the exact published form version", () => {
    expect(route).toContain("expectedFormDefinitionId: formDefinitionId");
    expect(route).toContain("expectedFormVersionId: formVersionId!");
    expect(route).toContain("verifyAssetAnswerBindings");
    expect(route).toContain("hashFormUploadManifest(proof.uploads)");
  });

  it("consumes the server-owned session before registration persistence", () => {
    const consumeAt = route.indexOf("await consumeFormUploadSession");
    const rpcAt = route.indexOf("asFlexibleClient(admin).rpc");

    expect(consumeAt).toBeGreaterThan(-1);
    expect(rpcAt).toBeGreaterThan(consumeAt);
    expect(route).toContain("if (!consumed)");
    expect(route).toContain("Please upload files again before submitting.");
  });

  it("uses an atomic database compare-and-set for single-use sessions", () => {
    expect(sessionMigration).toContain("consumed_at is null");
    expect(sessionMigration).toContain("expires_at > now()");
    expect(sessionMigration).toContain("set consumed_at = now()");
    expect(sessionMigration).toContain("manifest_sha256 = p_manifest_sha256");
  });
});
