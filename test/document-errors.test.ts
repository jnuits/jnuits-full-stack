import { EventEmitter } from "node:events";
import type { Page } from "@playwright/test";
import { describe, expect, it, vi } from "vitest";
import { isRetiredDocumentPrefetch, trackDocumentErrors } from "../e2e/fixtures/document-errors";

function nativeError(url = "https://fixture.invalid/notices?_rsc=fixture") {
  const error = new Error(url.replace(/^https?:\//, "") + " due to access control checks.");
  error.name = "Fetch API cannot load https";
  error.stack = `Fetch API cannot load ${url} due to access control checks.\n    at prefetch (https://fixture.invalid/_next/chunk.js:1:1)`;
  return error;
}

describe("retired-document browser diagnostics", () => {
  it("recognizes the reproduced WebKit native prefetch diagnostic only during document retirement", () => {
    expect(isRetiredDocumentPrefetch(nativeError(), "webkit", "https://fixture.invalid")).toBe(true);
  });
  it("keeps identical errors from an active document and other engines", () => {
    expect(isRetiredDocumentPrefetch(nativeError(), "webkit", null)).toBe(false);
    expect(isRetiredDocumentPrefetch(nativeError(), "chromium", "https://fixture.invalid")).toBe(false);
  });
  it("keeps cross-origin access-control failures and ordinary fetches", () => {
    expect(isRetiredDocumentPrefetch(nativeError("https://other.invalid/notices?_rsc=x"), "webkit", "https://fixture.invalid")).toBe(false);
    expect(isRetiredDocumentPrefetch(nativeError("https://fixture.invalid/api/profile"), "webkit", "https://fixture.invalid")).toBe(false);
  });
  it("never classifies a JavaScript exception as a native network diagnostic", () => {
    const error = nativeError(); error.name = "TypeError";
    expect(isRetiredDocumentPrefetch(error, "webkit", "https://fixture.invalid")).toBe(false);
    expect(isRetiredDocumentPrefetch(new Error("Application failed"), "webkit", "https://fixture.invalid")).toBe(false);
  });
  it("ends the exception at the new main-document commit and preserves application errors", async () => {
    const page = new EventEmitter(); const frame = {};
    const reload = vi.fn(async () => {
      page.emit("pageerror", nativeError());
      page.emit("pageerror", new TypeError("Real application failure"));
      page.emit("framenavigated", frame);
      page.emit("pageerror", nativeError());
      return null;
    });
    Object.assign(page, { mainFrame: () => frame, url: () => "https://fixture.invalid/certificates", reload });
    const tracker = trackDocumentErrors(page as unknown as Page, "webkit");
    await tracker.reload();
    expect(tracker.retirementDiagnostics).toHaveLength(1);
    expect(tracker.errors).toEqual(["Real application failure", nativeError().message]);
  });
  it("does not open the exception for an iframe navigation or ordinary page use", async () => {
    const page = new EventEmitter(); const frame = {};
    Object.assign(page, { mainFrame: () => frame, url: () => "https://fixture.invalid/certificates", reload: async () => {
      page.emit("framenavigated", {});
      page.emit("pageerror", nativeError());
      return null;
    } });
    const tracker = trackDocumentErrors(page as unknown as Page, "webkit");
    page.emit("pageerror", nativeError());
    await tracker.reload();
    page.emit("pageerror", nativeError());
    expect(tracker.errors).toHaveLength(2);
    expect(tracker.retirementDiagnostics).toHaveLength(1);
  });
  it("closes the scope when navigation itself fails", async () => {
    const page = new EventEmitter();
    Object.assign(page, { mainFrame: () => ({}), url: () => "https://fixture.invalid/certificates", reload: async () => { throw new Error("Navigation failed"); } });
    const tracker = trackDocumentErrors(page as unknown as Page, "webkit");
    await expect(tracker.reload()).rejects.toThrow("Navigation failed");
    page.emit("pageerror", nativeError());
    expect(tracker.errors).toEqual([nativeError().message]);
  });
});
