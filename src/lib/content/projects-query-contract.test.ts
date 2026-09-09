import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "src/lib/content/projects.ts"), "utf8");

describe("public project query contract", () => {
  it("does not silently truncate the public project catalogue", () => {
    const publicQuery = source.slice(
      source.indexOf("export const getPublishedProjects"),
      source.indexOf("export const getProjectBySlug"),
    );

    expect(publicQuery).not.toContain(".limit(60)");
  });

  it("filters archived projects even though detail loading uses the admin client", () => {
    const detailQuery = source.slice(
      source.indexOf("export const getProjectBySlug"),
      source.indexOf("export const getMemberProjects"),
    );

    expect(detailQuery).toContain('.neq("status", "archived")');
  });
});
