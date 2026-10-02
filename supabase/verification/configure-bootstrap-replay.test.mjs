import { describe, expect, it } from "vitest";
import { disableReplayCatalogCache } from "./configure-bootstrap-replay.mjs";

describe("disposable bootstrap replay catalog configuration", () => {
  it("disables only the experimental cache, preserving other enabled sections", () => {
    expect(disableReplayCatalogCache("[db]\nenabled = true\n[experimental.pgdelta]\nenabled = true\n[auth]\nenabled = true\n"))
      .toBe("[db]\nenabled = true\n[experimental.pgdelta]\nenabled = false\n[auth]\nenabled = true\n");
  });
  it("preserves CRLF and an already disabled cache", () => {
    expect(disableReplayCatalogCache("[experimental.pgdelta]\r\nenabled = false\r\n"))
      .toBe("[experimental.pgdelta]\r\nenabled = false\r\n");
  });
  it("rejects missing or duplicate cache settings instead of changing arbitrary TOML", () => {
    expect(() => disableReplayCatalogCache("[db]\nenabled = true\n")).toThrow();
    expect(() => disableReplayCatalogCache("[experimental.pgdelta]\nenabled = true\nenabled = true\n")).toThrow();
  });
});
