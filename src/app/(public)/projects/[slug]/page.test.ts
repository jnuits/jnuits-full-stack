import { describe, expect, it, vi } from "vitest";
import { generateMetadata } from "./page";

vi.mock("@/lib/content/projects", () => ({
  getProjectBySlug: vi.fn(async (slug: string) => {
    if (slug === "test-project") {
      return {
        slug: "test-project",
        title: "Test Project",
        tagline: "A test project tagline",
        description: "Full description of test project",
        coverImageUrl: "https://example.com/cover.png",
      };
    }
    return null;
  }),
}));

describe("Project detail metadata (F8)", () => {
  it("generates truthful metadata and canonical for existing project", async () => {
    const meta = await generateMetadata({
      params: Promise.resolve({ slug: "test-project" }),
    });

    expect(meta.title).toContain("Test Project");
    expect(meta.description).toBe("A test project tagline");
    expect(meta.alternates?.canonical).toBe("/projects/test-project");
    expect(meta.openGraph?.title).toBe("Test Project");
  });

  it("handles missing project gracefully", async () => {
    const meta = await generateMetadata({
      params: Promise.resolve({ slug: "non-existent" }),
    });

    expect(meta.title).toBe("Project not found");
  });
});
