import { describe, expect, it } from "vitest";
import { sanitizeEventHtml } from "@/lib/content/sanitize-event-html";

describe("sanitizeEventHtml", () => {
  it("removes script tags and event-handler attributes", () => {
    const html = sanitizeEventHtml(
      '<h2 onclick="alert(1)">Schedule</h2><script>alert(2)</script><p>Safe</p>'
    );

    expect(html).toContain("<h2>Schedule</h2>");
    expect(html).toContain("<p>Safe</p>");
    expect(html).not.toContain("script");
    expect(html).not.toContain("onclick");
  });

  it("removes javascript URLs while preserving safe links", () => {
    const html = sanitizeEventHtml(
      '<a href="javascript:alert(1)">Bad</a><a href="https://jnuits.org.bd/events">Good</a>'
    );

    expect(html).toContain(">Bad</a>");
    expect(html).not.toContain("javascript:");
    expect(html).toContain('href="https://jnuits.org.bd/events"');
    expect(html).toContain('rel="noreferrer"');
  });

  it("allows safe https images but removes unsafe image schemes", () => {
    const html = sanitizeEventHtml(
      '<img src="data:text/html;base64,PHNjcmlwdD4=" alt="bad"><img src="https://res.cloudinary.com/demo/image/upload/photo.jpg" alt="good">'
    );

    expect(html).not.toContain("data:text");
    expect(html).toContain("https://res.cloudinary.com/demo/image/upload/photo.jpg");
    expect(html).toContain('alt="good"');
  });
});
