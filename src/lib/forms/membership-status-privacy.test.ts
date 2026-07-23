import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const route = fs.readFileSync(
  path.join(process.cwd(), "src/app/api/membership-form/status/route.ts"),
  "utf8"
);

describe("membership application status privacy", () => {
  it("returns no application identity or form answers", () => {
    expect(route).toContain('.select("status, updated_at")');
    expect(route).not.toContain("student_id");
    expect(route).not.toContain("full_name");
    expect(route).not.toContain("answers");
  });

  it("rate limits the lookup and equalizes timing paths", () => {
    expect(route).toContain("RATE_LIMITS.membershipStatus");
    expect(route).toContain("antiEnumerationDelay");
  });
});
