import { describe, expect, it, vi } from "vitest";
import { generateMetadata } from "./page";

vi.mock("@/lib/content/public-content", async () => {
  const actual = await vi.importActual<Record<string, unknown>>(
    "@/lib/content/public-content"
  );
  return {
    ...actual,
    getPublishedNoticeByIdentifier: vi.fn(async (slug: string) => {
      if (slug === "test-notice") {
        return {
          slug: "test-notice",
          title: "Test Notice Title",
          summary: "Official test notice summary.",
          publishedAt: "2026-03-01T00:00:00Z",
          category: "General",
        };
      }
      return null;
    }),
  };
});

describe("Notice detail metadata (F8)", () => {
  it("generates truthful metadata and canonical for existing notice", async () => {
    const meta = await generateMetadata({
      params: Promise.resolve({ slug: "test-notice" }),
    });

    expect(meta.title).toContain("Test Notice Title");
    expect(meta.description).toBe("Official test notice summary.");
    expect(meta.alternates?.canonical).toBe("/notices/test-notice");
    expect(meta.openGraph?.title).toBe("Test Notice Title");
  });

  it("handles missing notice gracefully", async () => {
    const meta = await generateMetadata({
      params: Promise.resolve({ slug: "non-existent" }),
    });

    expect(meta.title).toBe("Notice not found");
  });
});
