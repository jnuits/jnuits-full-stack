import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BlogMarkdown } from "@/components/blogs/blog-markdown";

describe("BlogMarkdown", () => {
  it("renders GFM tables and safe external link attributes", () => {
    const html = renderToStaticMarkup(
      <BlogMarkdown
        source={`| A | B |
| - | - |
| 1 | 2 |

[external](https://example.com) and [internal](/blogs/demo)`}
      />
    );

    expect(html).toContain("<table>");
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noreferrer"');
    expect(html).toContain('href="/blogs/demo"');
  });

  it("does not render raw HTML from blog markdown", () => {
    const html = renderToStaticMarkup(
      <BlogMarkdown source={'<script>alert(1)</script><strong onclick="x()">safe</strong>'} />
    );

    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<strong onclick");
    expect(html).toContain("&lt;script&gt;");
  });

  it("normalizes body-level h1 markdown to section heading markup", () => {
    const html = renderToStaticMarkup(
      <BlogMarkdown source={"# Imported body title\n\n## Section title"} />
    );

    expect(html).not.toContain("<h1");
    expect(html).toContain("blog-markdown__heading--from-h1");
    expect(html).toContain("blog-markdown__heading--h2");
  });
});
