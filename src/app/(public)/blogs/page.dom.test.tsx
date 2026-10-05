import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import BlogsPage from "./page";

// Mock public-content
const mockBlogs = Array.from({ length: 30 }, (_, index) => ({
  slug: `blog-${index + 1}`,
  title: `Blog Post ${index + 1}`,
  category: index % 2 === 0 ? "Tech" : "Activities",
  summary: `Summary for blog post ${index + 1}`,
  excerpt: `Excerpt for blog post ${index + 1}`,
  publishedAt: `2026-03-${String((index % 28) + 1).padStart(2, "0")}T00:00:00Z`,
  readTime: "5 min read",
  authorLabel: "Author",
  sourceLabel: "Source",
  imageSrc: "/images/home-group.jpg",
}));

const mockGetPublishedBlogArchive = vi.fn();

vi.mock("@/lib/content/public-content", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    getPublishedBlogs: vi.fn(async () => mockBlogs),
    getPublishedBlogArchive: (...args: unknown[]) =>
      mockGetPublishedBlogArchive(...args),
  };
});

describe("Blog archive page (F7)", () => {
  it("renders page 1 with featured post and pagination controls using archive query", async () => {
    mockGetPublishedBlogArchive.mockResolvedValueOnce({
      items: mockBlogs.slice(0, 24),
      categories: ["Activities", "Tech"],
      page: 1,
      pageSize: 24,
      totalItems: 30,
      totalPages: 2,
    });

    const ui = await BlogsPage({
      searchParams: Promise.resolve({ page: "1" }),
    });
    render(ui);

    expect(mockGetPublishedBlogArchive).toHaveBeenCalledWith({
      category: "",
      page: 1,
    });
    expect(screen.getByText("Blog Post 1")).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "Blog pages" })
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Next" })).toBeInTheDocument();
  });

  it("renders page 2 without featured post and includes all items in grid", async () => {
    mockGetPublishedBlogArchive.mockResolvedValueOnce({
      items: mockBlogs.slice(24),
      categories: ["Activities", "Tech"],
      page: 2,
      pageSize: 24,
      totalItems: 30,
      totalPages: 2,
    });

    const ui = await BlogsPage({
      searchParams: Promise.resolve({ page: "2" }),
    });
    render(ui);

    expect(mockGetPublishedBlogArchive).toHaveBeenCalledWith({
      category: "",
      page: 2,
    });
    // Page 2 should include item 25 without dropping it
    expect(screen.getByText("Blog Post 25")).toBeInTheDocument();
    expect(
      screen.getByText("All articles (Page 2 of 2)")
    ).toBeInTheDocument();
  });

  it("filters by category and preserves category across pagination links", async () => {
    mockGetPublishedBlogArchive.mockResolvedValueOnce({
      items: mockBlogs.filter((b) => b.category === "Tech").slice(0, 24),
      categories: ["Activities", "Tech"],
      page: 1,
      pageSize: 24,
      totalItems: 15,
      totalPages: 2,
    });

    const ui = await BlogsPage({
      searchParams: Promise.resolve({ category: "Tech", page: "1" }),
    });
    render(ui);

    expect(mockGetPublishedBlogArchive).toHaveBeenCalledWith({
      category: "Tech",
      page: 1,
    });
    const nextLink = screen.getByRole("link", { name: "Next" });
    expect(nextLink).toHaveAttribute("href", "/blogs?category=Tech&page=2");
  });

  it("displays empty state when category has no matching posts", async () => {
    mockGetPublishedBlogArchive.mockResolvedValueOnce({
      items: [],
      categories: ["Activities", "Tech"],
      page: 1,
      pageSize: 24,
      totalItems: 0,
      totalPages: 1,
    });

    const ui = await BlogsPage({
      searchParams: Promise.resolve({ category: "NonExistent" }),
    });
    render(ui);

    expect(
      screen.getByRole("heading", { name: "No published blog posts found" })
    ).toBeInTheDocument();
  });

  it("bubbles backend query failure to let the error boundary catch it", async () => {
    mockGetPublishedBlogArchive.mockRejectedValueOnce(
      new Error("The blog archive could not be loaded.")
    );

    await expect(
      BlogsPage({
        searchParams: Promise.resolve({ page: "1" }),
      })
    ).rejects.toThrow("The blog archive could not be loaded.");
  });
});
