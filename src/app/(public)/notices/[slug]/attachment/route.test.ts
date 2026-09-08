import { describe, expect, it } from "vitest";

import { mayRenderInline } from "./route";

describe("notice attachment inline allowlist", () => {
  it.each([
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/avif",
  ])("allows passive type %s", (contentType) => {
    expect(mayRenderInline(contentType)).toBe(true);
  });

  it.each([
    "image/svg+xml",
    "application/xml",
    "text/html",
    "image/x-icon",
  ])("forces active or unapproved type %s to download", (contentType) => {
    expect(mayRenderInline(contentType)).toBe(false);
  });
});
