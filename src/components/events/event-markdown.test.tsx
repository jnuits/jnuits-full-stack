import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EventMarkdown } from "./event-markdown";

describe("EventMarkdown", () => {
  it("sanitizes HTML format at the render boundary", () => {
    const html = renderToStaticMarkup(
      <EventMarkdown
        format="html"
        source={`<h2>Safe</h2><script>alert(1)</script><p onclick="evil()">Text</p><a href="javascript:alert(1)">Bad link</a><img src="data:text/html;base64,abc" onerror="evil()" />`}
      />
    );

    expect(html).toContain("<h2>Safe</h2>");
    expect(html).toContain("<p>Text</p>");
    expect(html).not.toContain("<script");
    expect(html).not.toContain("onclick");
    expect(html).not.toContain("onerror");
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("data:text/html");
  });

  it("keeps markdown links readable and external links safe", () => {
    const html = renderToStaticMarkup(
      <EventMarkdown source="[https://docs.google.com](https://docs.google.com)" />
    );

    expect(html).toContain('href="https://docs.google.com"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noreferrer"');
    expect(html).toContain("Open Google document");
  });
});
