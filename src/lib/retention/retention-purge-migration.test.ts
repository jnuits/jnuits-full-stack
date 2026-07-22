import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("retention purge migration", () => {
  it("atomically redacts unique event emails only after archive approval", () => {
    const sql = readFileSync(
      join(
        process.cwd(),
        "supabase/migrations/20260722150000_retention_purge_rpc.sql"
      ),
      "utf8"
    );

    expect(sql).toContain("status = 'purge_approved'");
    expect(sql).toContain("manifest_checksum_sha256 is not null");
    expect(sql).toContain("'purged-' || registration.id::text || '@retained.invalid'");
    expect(sql).toContain("answers = '{}'::jsonb");
    expect(sql).toContain("cloudinary_originals_retained");
    expect(sql).toContain("grant execute on function public.purge_retention_job");
    expect(sql).toContain("to service_role");
  });
});
