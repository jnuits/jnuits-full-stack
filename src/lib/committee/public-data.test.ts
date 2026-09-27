import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

import { collectSupabasePages } from "./public";

describe("public committee server data access", () => {
  it("collects every page until a short page is returned", async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce({ data: [1, 2], error: null })
      .mockResolvedValueOnce({ data: [3], error: null });

    await expect(collectSupabasePages(fetchPage, 2)).resolves.toEqual([1, 2, 3]);
    expect(fetchPage.mock.calls).toEqual([
      [0, 1],
      [2, 3],
    ]);
  });

  it("requests the terminating empty page when the result ends on a page boundary", async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce({ data: [1, 2], error: null })
      .mockResolvedValueOnce({ data: [3, 4], error: null })
      .mockResolvedValueOnce({ data: [], error: null });

    await expect(collectSupabasePages(fetchPage, 2)).resolves.toEqual([
      1,
      2,
      3,
      4,
    ]);
    expect(fetchPage).toHaveBeenCalledTimes(3);
    expect(fetchPage).toHaveBeenLastCalledWith(4, 5);
  });

  it("propagates database errors instead of returning a partial public roster", async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce({ data: [1, 2], error: null })
      .mockResolvedValueOnce({
        data: null,
        error: { message: "database unavailable" },
      });

    await expect(collectSupabasePages(fetchPage, 2)).rejects.toThrow(
      "Unable to load public committee data."
    );
  });

  it("keeps privileged member reads server-only, explicit, uncapped, and private-field free", () => {
    const source = readFileSync(
      fileURLToPath(new URL("./public.ts", import.meta.url)),
      "utf8"
    );
    const memberSelect = source.match(
      /const PUBLIC_COMMITTEE_MEMBER_SELECT =\s*\n?\s*"([^"]+)"/
    )?.[1];

    expect(source).toContain('import "server-only";');
    expect(source).toContain("createAdminClient");
    expect(source).not.toContain("createPublicClient");
    expect(source).not.toContain(".limit(512)");
    expect(source).toContain("PUBLIC_COMMITTEE_TERM_SELECT");
    expect(source).toContain("PUBLIC_COMMITTEE_POSITION_SELECT");
    expect(source).toContain("PUBLIC_COMMITTEE_ASSIGNMENT_SELECT");
    expect(source).toContain("PUBLIC_COMMITTEE_ROLE_SELECT");
    expect(source).toContain("PUBLIC_COMMITTEE_MEMBER_SELECT");
    expect(source).toContain("PUBLIC_COMMITTEE_DEPARTMENT_SELECT");
    expect(source).toContain("PUBLIC_COMMITTEE_ADVISOR_SELECT");
    expect(memberSelect).toBe(
      "id, jnuits_id, full_name, department_code, avatar_secure_url, facebook_url, linkedin_url, website_url"
    );
    expect(memberSelect).not.toMatch(
      /email|phone|student_id|metadata|notes|user_id|portal_access|claim|invitation/i
    );
  });

  it("uses a unique final key when paging public committee terms", () => {
    const source = readFileSync(
      fileURLToPath(new URL("./public.ts", import.meta.url)),
      "utf8"
    );
    const termLoader = source.slice(
      source.indexOf("async function loadTerms()"),
      source.indexOf("async function loadPositions(")
    );

    expect(termLoader).toContain('.order("id", { ascending: true })');
  });
});
