import { readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("anniversary lifecycle release artifact", () => {
  it("ships one non-empty forward migration after the intake publishing dependency", () => {
    const directory = resolve("supabase/migrations");
    const files = readdirSync(directory);
    const migrations = files.filter((file) => file.endsWith("_membership_anniversary_lifecycle.sql"));
    expect(migrations).toHaveLength(1);
    expect(migrations[0].slice(0, 14) > "20261001090000").toBe(true);
    expect(statSync(resolve(directory, migrations[0])).size).toBeGreaterThan(0);
  });
});

// The authoritative schema/privilege/state-machine contracts are executed by
// assert-membership-anniversary.sql on every clean bootstrap replay, not by
// matching source strings that could pass despite broken SQL behavior.
