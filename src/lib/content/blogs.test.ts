import { describe, expect, it } from "vitest";
import {
  BLOG_CARD_TEASER_LENGTH,
  getBlogPublishValidationError,
  decodeBlogIdentifier,
  getContentPostRevalidationPaths,
  getBlogFallbackVisual,
  getBlogHref,
  makeBlogTeaser,
  resolveBlogPostStatusForIntent,
  stripMarkdownForTeaser,
} from "@/lib/content/blogs";

describe("blog content helpers", () => {
  it("strips markdown syntax before teaser clamping", () => {
    const teaser = stripMarkdownForTeaser(
      "## শিরোনাম\n\nThis is **bold** with [a link](/blogs/demo), `code`, and ![alt text](https://example.com/a.jpg)."
    );

    expect(teaser).toBe(
      "শিরোনাম This is bold with a link, code, and alt text."
    );
  });

  it("uses summary/excerpt/body priority and clamps long card text", () => {
    const teaser = makeBlogTeaser(
      {
        body: "body text",
        excerpt: "excerpt text",
        summary: "summary ".repeat(80),
      },
      BLOG_CARD_TEASER_LENGTH
    );

    expect(teaser).toMatch(/^summary summary/);
    expect(Array.from(teaser).length).toBeLessThanOrEqual(BLOG_CARD_TEASER_LENGTH);
    expect(teaser.endsWith("...")).toBe(true);
  });

  it("requires public blog fields only when publishing", () => {
    expect(
      getBlogPublishValidationError({
        body: "",
        publishedAt: "",
        slug: "",
        status: "draft",
        summary: "",
        title: "",
      })
    ).toBeNull();

    expect(
      getBlogPublishValidationError({
        body: "Body",
        publishedAt: "",
        slug: "slug",
        status: "published",
        summary: "Summary",
        title: "Title",
      })
    ).toBe("Published blogs require a publish date.");
  });

  it("includes listing, current slug, and old slug revalidation paths for blogs", () => {
    expect(
      getContentPostRevalidationPaths({
        contentType: "blog",
        previousSlug: "old-title",
        slug: "new-title",
      })
    ).toEqual([
      "/admin/content",
      "/admin/content/blogs",
      "/blogs",
      "/blogs/new-title",
      "/blogs/old-title",
    ]);
  });

  it("encodes and decodes Unicode blog detail identifiers safely", () => {
    const slug = "jnu-it-society-নতুন-নেতৃত্ব";
    const href = getBlogHref(slug);

    expect(href).toBe("/blogs/jnu-it-society-%E0%A6%A8%E0%A6%A4%E0%A7%81%E0%A6%A8-%E0%A6%A8%E0%A7%87%E0%A6%A4%E0%A7%83%E0%A6%A4%E0%A7%8D%E0%A6%AC");
    expect(decodeBlogIdentifier(href.replace("/blogs/", ""))).toBe(slug);
    expect(decodeBlogIdentifier("%E0%")).toBe("%E0%");
  });

  it("generates deterministic fallback cover metadata", () => {
    const first = getBlogFallbackVisual({
      category: "Election",
      title: "JnUITS 6th Election 2025",
    });
    const second = getBlogFallbackVisual({
      category: "Election",
      title: "JnUITS 6th Election 2025",
    });

    expect(second).toEqual(first);
    expect(first.categoryLabel).toBe("Election");
    expect(first.initials).toBe("J6");
    expect(["blue", "gold", "green", "slate"]).toContain(first.tone);
  });

  it("resolves explicit blog save intents without accidental publishing", () => {
    expect(
      resolveBlogPostStatusForIntent({
        intent: "save",
        isExistingPost: false,
        previousStatus: null,
        submittedStatus: "published",
      })
    ).toBe("draft");

    expect(
      resolveBlogPostStatusForIntent({
        intent: "publish",
        isExistingPost: false,
        previousStatus: null,
        submittedStatus: "draft",
      })
    ).toBe("published");

    expect(
      resolveBlogPostStatusForIntent({
        intent: "archive",
        isExistingPost: true,
        previousStatus: "published",
        submittedStatus: "published",
      })
    ).toBe("archived");

    expect(
      resolveBlogPostStatusForIntent({
        intent: "save",
        isExistingPost: true,
        previousStatus: "published",
        submittedStatus: "draft",
      })
    ).toBe("published");

    expect(
      resolveBlogPostStatusForIntent({
        intent: "save",
        isExistingPost: true,
        previousStatus: "draft",
        submittedStatus: "published",
      })
    ).toBe("draft");
  });
});
