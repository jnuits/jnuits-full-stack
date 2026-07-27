import { describe, expect, it } from "vitest";

describe("migration dependency checker module loading", () => {
  it("loads through Vite on Windows checkouts", async () => {
    await expect(import("./check-migration-dependencies.mjs")).resolves.toHaveProperty(
      "analyzeMigrations"
    );
  });
});
