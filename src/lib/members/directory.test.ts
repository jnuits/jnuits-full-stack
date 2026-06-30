import { describe, expect, it } from "vitest";
import { normalizeDirectoryQuery } from "./directory";

describe("member directory public query normalization", () => {
  it("clamps oversized page and page size requests", () => {
    const query = normalizeDirectoryQuery({ page: "9999", pageSize: "9999" });

    expect(query.page).toBe(500);
    expect(query.pageSize).toBe(48);
  });

  it("sanitizes expensive wildcard search characters and long input", () => {
    const query = normalizeDirectoryQuery({
      search: `${"A".repeat(90)}%,*,` ,
    });

    expect(query.search).toHaveLength(80);
    expect(query.search).not.toContain("%");
    expect(query.search).not.toContain("*");
    expect(query.search).not.toContain(",");
  });

  it("drops invalid enum-style filters", () => {
    const query = normalizeDirectoryQuery({
      department: "../../private",
      letter: "AB",
      sort: "random",
      type: "operator",
    });

    expect(query.department).toBe("");
    expect(query.letter).toBe("");
    expect(query.sort).toBe("name");
    expect(query.type).toBe("all");
  });
});