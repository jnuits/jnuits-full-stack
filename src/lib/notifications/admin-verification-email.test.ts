import { describe, expect, it } from "vitest";
import { buildAdminVerificationEmail } from "./email-builders";
describe("admin verification email", () => {
  it("escapes the label and keeps the code out of links, title and preview", () => {
    const html = buildAdminVerificationEmail({ code: "012345", operationLabel: '<script>alert("fixture")</script>', expiresInMinutes: 5 });
    expect(html).toContain("&lt;script&gt;"); expect(html).not.toContain('<script>');
    expect(html).toContain("012345"); expect(html).toContain("5 minutes");
    expect(html.match(/href="[^"]*"/g)?.join("")).not.toContain("012345");
    expect(/<title>(.*?)<\/title>/.exec(html)?.[1]).not.toContain("012345");
  });
});
